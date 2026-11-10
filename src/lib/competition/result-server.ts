// Server-only: saving a fixture result. Shared by the organiser's result form (actions/fixtures) and
// live scoring (a finished live match fills in its fixture). Not a "use server" file on purpose:
// callers do their own permission checks before calling in.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { canCorrectKnockoutResult, validateResult } from "@/lib/competition";
import { detectDrawMode, isKnockoutPhaseRound, nextKnockoutPosition } from "@/lib/competition/phase";

export const STALE_FIXTURE = "This match was updated by someone else. Reload and try again.";

/** A refusal with a message that is safe to show. */
export class FixtureResultError extends Error {}

export async function lockCompetition(tx: Prisma.TransactionClient, competitionId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"competition:" + competitionId}))`;
}

export type ApplyResultInput = {
  orgId: string;
  fixtureId: string;
  competitionId: string;
  homeScore: unknown;
  awayScore: unknown;
  winnerEntryId?: string | null;
  expectedVersion: number;
  actorId: string;
  asOfficial: boolean;
  /** Live scoring never overwrites a result someone already recorded. */
  onlyIfOpen?: boolean;
  source?: "FORM" | "LIVE";
  liveMatchId?: string;
};

/** Validates, advances the knockout winner, writes the result and an audit row. Throws FixtureResultError. */
export async function applyFixtureResult(a: ApplyResultInput): Promise<{ skipped?: "ALREADY_RECORDED" }> {
  return db.$transaction(async (tx) => {
    await lockCompetition(tx, a.competitionId);
    const f = await tx.fixture.findFirst({ where: { id: a.fixtureId, orgId: a.orgId }, include: { competition: true } });
    if (!f) throw new FixtureResultError("Fixture not found.");
    if (a.onlyIfOpen && f.status === "COMPLETED") return { skipped: "ALREADY_RECORDED" as const };
    const c = f.competition;
    if (c.status !== "SCHEDULED") throw new FixtureResultError("Results can only be recorded while the competition is running.");
    if (f.version !== Number(a.expectedVersion)) throw new FixtureResultError(STALE_FIXTURE);
    if (f.status === "POSTPONED") throw new FixtureResultError("Reschedule this fixture before recording a result.");

    const shape = await tx.fixture.findMany({ where: { competitionId: c.id }, select: { round: true, slot: true, homeEntryId: true, awayEntryId: true } });
    const mode = detectDrawMode(c.format, shape);
    const knockout = mode === "KNOCKOUT" || (mode === "GROUPS" && isKnockoutPhaseRound(f.round));
    const v = validateResult(
      { homeScore: a.homeScore, awayScore: a.awayScore, winnerEntryId: a.winnerEntryId },
      { format: knockout ? "KNOCKOUT" : "LEAGUE", allowDraws: c.allowDraws, status: f.status, homeEntryId: f.homeEntryId, awayEntryId: f.awayEntryId },
    );
    if (!v.ok) throw new FixtureResultError(v.error);
    const correcting = f.status === "COMPLETED";

    if (mode === "GROUPS" && !knockout && correcting) {
      const seeded = shape.some((x) => isKnockoutPhaseRound(x.round) && (x.homeEntryId || x.awayEntryId));
      if (seeded) throw new FixtureResultError("The knockout has been drawn from the group tables, so group results can't change.");
    }

    if (knockout) {
      const koRounds = [...new Set(shape.map((x) => x.round))];
      const next = nextKnockoutPosition(f.round, f.slot, koRounds);
      if (next) {
        const nf = await tx.fixture.findFirst({ where: { competitionId: c.id, round: next.round, slot: next.slot } });
        if (!nf) throw new FixtureResultError("Bracket is incomplete. Contact support.");
        if (!canCorrectKnockoutResult(nf.status)) throw new FixtureResultError("The next round has already been played with this winner, so this result can't change.");
        const field = next.side === "home" ? "homeEntryId" : "awayEntryId";
        if (nf[field] !== v.winnerEntryId) {
          await tx.fixture.update({ where: { id: nf.id }, data: { [field]: v.winnerEntryId, version: { increment: 1 } } });
        }
      }
    }

    const res = await tx.fixture.updateMany({
      where: { id: f.id, orgId: a.orgId, version: f.version },
      data: {
        homeScore: v.homeScore,
        awayScore: v.awayScore,
        winnerEntryId: v.winnerEntryId,
        status: "COMPLETED",
        resultById: a.actorId,
        resultAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (res.count === 0) throw new FixtureResultError(STALE_FIXTURE);
    await tx.auditLog.create({
      data: {
        userId: a.actorId,
        orgId: a.orgId,
        action: correcting ? "FIXTURE_RESULT_CORRECTED" : "FIXTURE_RESULT_RECORDED",
        details: JSON.stringify({
          fixtureId: f.id,
          competitionId: c.id,
          before: correcting ? { home: f.homeScore, away: f.awayScore, winner: f.winnerEntryId } : null,
          after: { home: v.homeScore, away: v.awayScore, winner: v.winnerEntryId },
          asOfficial: a.asOfficial,
          source: a.source ?? "FORM",
          ...(a.liveMatchId ? { liveMatchId: a.liveMatchId } : {}),
        }),
      },
    });
    return {};
  });
}
