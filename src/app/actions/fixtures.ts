"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { requireAuth } from "@/lib/auth";
import { checkPermission, getMembership, hasPermission } from "@/lib/membership";
import { buildFixturesBoard, groupTables, pointsOf, type FixtureCompetitionOption, type FixturesBoard } from "@/lib/competition/board";
import { drawModesFor, planDraw } from "@/lib/competition/draw";
import { seedKnockoutPhase } from "@/lib/competition/groups";
import { liveSportKeyFor } from "@/lib/competition/live-link";
import { entryDisplayName } from "@/lib/competition/names";
import {
  detectDrawMode,
  groupDrawShape,
  groupOfSlot,
  isDrawMode,
  isKnockoutPhaseRound,
  roundLabel,
} from "@/lib/competition/phase";
import { scheduleFixtures } from "@/lib/competition/schedule";
import { applyFixtureResult, FixtureResultError, lockCompetition, STALE_FIXTURE } from "@/lib/competition/result-server";
import { createLiveMatch } from "@/app/actions/live-scoring";

/**
 * TRIQ Compete fixtures: draws, scheduling, results and standings (flags `events` + `fixtures`).
 * Every write that touches a competition takes the same per-competition advisory lock as
 * src/app/actions/competitions.ts, and every fixture write checks and bumps `version`, so a stale
 * screen can't overwrite a newer result. All pure logic lives in src/lib/competition/.
 */

type Fail = { success: false; error: string; confirm?: boolean; needsSport?: boolean };
const OFF: Fail = { success: false, error: "Fixtures aren't enabled for this academy yet." };
const STALE = STALE_FIXTURE;

class ActionError extends FixtureResultError {}

function fail(e: unknown, fallback: string): Fail {
  if (e instanceof FixtureResultError) return { success: false, error: e.message };
  if (e && typeof e === "object" && "digest" in e) throw e; // Next.js redirect / notFound
  console.error(`[fixtures] ${fallback}:`, e instanceof Error ? e.message : e);
  return { success: false, error: fallback };
}

const enabled = () => FEATURES.events && FEATURES.fixtures;

async function manager() {
  if (!enabled()) return { ok: false as const, error: OFF.error };
  return checkPermission("competitions.manage");
}

const decided = (s: string) => s === "COMPLETED" || s === "BYE" || s === "CANCELLED";

// ───────────────────────────── reads ─────────────────────────────

export async function listFixtureCompetitions(): Promise<{ success: true; competitions: FixtureCompetitionOption[] } | Fail> {
  const auth = await manager();
  if (!auth.ok) return { success: false, error: auth.error };
  const rows = await db.competition.findMany({
    where: { orgId: auth.session.orgId, status: { in: ["OPEN", "SCHEDULED", "COMPLETED"] } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      format: true,
      status: true,
      _count: { select: { entries: { where: { status: "REGISTERED" } }, fixtures: true } },
    },
  });
  return {
    success: true,
    competitions: rows.map((c) => ({ id: c.id, name: c.name, format: c.format, status: c.status, entries: c._count.entries, fixtures: c._count.fixtures })),
  };
}

export async function getFixturesBoard(
  competitionId: string
): Promise<{ success: true; board: FixturesBoard; liveScoring: boolean; entrySeeds: { id: string; seed: number | null; createdAt: string }[] } | Fail> {
  const auth = await manager();
  if (!auth.ok) return { success: false, error: auth.error };
  const orgId = auth.session.orgId;
  const c = await db.competition.findFirst({ where: { id: String(competitionId ?? ""), orgId } });
  if (!c) return { success: false, error: "Competition not found." };
  const [entries, fixtures] = await Promise.all([
    db.competitionEntry.findMany({ where: { competitionId: c.id, orgId }, orderBy: { createdAt: "asc" } }),
    db.fixture.findMany({ where: { competitionId: c.id, orgId } }),
  ]);
  let live: { id: string; fixtureId: string | null; status: string }[] = [];
  if (FEATURES.liveScoring && fixtures.length) {
    try {
      live = await db.liveMatch.findMany({
        where: { orgId, fixtureId: { in: fixtures.map((f) => f.id) } },
        select: { id: true, fixtureId: true, status: true },
        orderBy: { createdAt: "asc" },
      });
    } catch (e) {
      console.warn("[fixtures] live matches unavailable:", e instanceof Error ? e.message : e);
    }
  }
  return {
    success: true,
    board: buildFixturesBoard(c, entries, fixtures, live),
    liveScoring: FEATURES.liveScoring,
    // Seeds and registration order only (no names), so the screen can preview a draw exactly.
    entrySeeds: entries.filter((e) => e.status === "REGISTERED").map((e) => ({ id: e.id, seed: e.seed, createdAt: e.createdAt.toISOString() })),
  };
}

// ───────────────────────────── draw ─────────────────────────────

/**
 * Writes the draw into Fixture (scheduledAt left empty). The first draw needs the competition to be
 * open for registration and moves it to "in progress". If fixtures already exist the organiser must
 * confirm (`regenerate: true`), and a redraw is refused once any result or live match exists.
 */
export async function generateDraw(
  competitionId: string,
  input: { mode: string; double?: boolean; groups?: number; advance?: number; regenerate?: boolean }
): Promise<{ success: true; created: number } | Fail> {
  const auth = await manager();
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const orgId = session.orgId;
  const mode = input?.mode;
  if (!isDrawMode(mode)) return { success: false, error: "Pick a draw type." };

  try {
    const created = await db.$transaction(
      async (tx) => {
        await lockCompetition(tx, String(competitionId));
        const c = await tx.competition.findFirst({ where: { id: String(competitionId), orgId } });
        if (!c) throw new ActionError("Competition not found.");
        if (!drawModesFor(c.format).includes(mode)) throw new ActionError("That draw type doesn't fit this competition's format.");
        const existing = await tx.fixture.findMany({ where: { competitionId: c.id }, select: { id: true, status: true } });

        if (existing.length === 0) {
          if (c.status === "DRAFT") throw new ActionError("Open registration first, then make the draw.");
          if (c.status !== "OPEN") throw new ActionError("The draw can only be made while registration is open.");
        } else {
          if (c.status !== "SCHEDULED") throw new ActionError("This competition isn't running, so its draw can't change.");
          if (!input?.regenerate) throw new ActionError("CONFIRM");
          if (existing.some((f) => f.status === "COMPLETED")) throw new ActionError("Results have been recorded, so the draw can't be made again.");
          const linked = await tx.liveMatch.count({ where: { orgId, fixtureId: { in: existing.map((f) => f.id) }, status: { not: "ABANDONED" } } });
          if (linked) throw new ActionError("A fixture is being scored live, so the draw can't be made again.");
        }

        const entries = await tx.competitionEntry.findMany({
          where: { competitionId: c.id, status: "REGISTERED" },
          select: { id: true, seed: true, createdAt: true },
        });
        const plan = planDraw(entries, {
          mode,
          double: mode === "KNOCKOUT" ? false : input?.double ?? c.legs === 2,
          groups: Number(input?.groups),
          advance: Number(input?.advance),
        });
        if (!plan.ok) throw new ActionError(plan.error);

        if (existing.length) await tx.fixture.deleteMany({ where: { competitionId: c.id } });
        await tx.fixture.createMany({
          data: plan.plan.fixtures.map((f) => ({ ...f, orgId, competitionId: c.id, venue: c.venue, scheduledAt: null })),
        });
        if (c.status === "OPEN") await tx.competition.update({ where: { id: c.id }, data: { status: "SCHEDULED" } });
        await tx.auditLog.create({
          data: {
            userId: session.id,
            orgId,
            action: existing.length ? "COMPETITION_DRAW_REGENERATED" : "COMPETITION_DRAW_GENERATED",
            details: JSON.stringify({ competitionId: c.id, mode, entries: entries.length, fixtures: plan.plan.fixtures.length, groups: input?.groups ?? null, advance: input?.advance ?? null }),
          },
        });
        return plan.plan.fixtures.length;
      },
      { timeout: 30_000 }
    );
    revalidatePath("/org/fixtures");
    return { success: true, created };
  } catch (e) {
    if (e instanceof ActionError && e.message === "CONFIRM") {
      return { success: false, confirm: true, error: "Fixtures already exist. Make the draw again? The current fixtures and their times will be replaced." };
    }
    return fail(e, "Couldn't make the draw.");
  }
}

// ───────────────────────────── scheduling ─────────────────────────────

/**
 * Gives every undecided fixture a date, time and court. Times are academy local time (IST, same
 * convention as parseFixtureTime). Postponed fixtures that get a new slot go back to scheduled.
 */
export async function autoScheduleFixtures(
  competitionId: string,
  input: { startDate: string; weekdays?: number[]; days?: number | null; slotsPerDay: number; firstSlotTime: string; slotMinutes: number; courts: number; courtNames?: string[] }
): Promise<{ success: true; scheduled: number; matchDays: number; lastDate: string | null } | Fail> {
  const auth = await manager();
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const orgId = session.orgId;
  const opts = {
    startDate: String(input?.startDate ?? ""),
    weekdays: Array.isArray(input?.weekdays) ? input.weekdays.map(Number) : undefined,
    days: input?.days === null || input?.days === undefined || String(input.days) === "" ? undefined : Number(input.days),
    slotsPerDay: Number(input?.slotsPerDay),
    firstSlotTime: String(input?.firstSlotTime ?? ""),
    slotMinutes: Number(input?.slotMinutes),
    courts: Number(input?.courts),
    courtNames: Array.isArray(input?.courtNames) ? input.courtNames.map((n) => String(n ?? "").trim().slice(0, 40)) : undefined,
  };

  try {
    const result = await db.$transaction(
      async (tx) => {
        await lockCompetition(tx, String(competitionId));
        const c = await tx.competition.findFirst({ where: { id: String(competitionId), orgId } });
        if (!c) throw new ActionError("Competition not found.");
        if (c.status !== "SCHEDULED") throw new ActionError("Make the draw first.");
        const all = await tx.fixture.findMany({ where: { competitionId: c.id } });
        const todo = all.filter((f) => !decided(f.status));
        if (!todo.length) throw new ActionError("Every fixture already has a result.");
        const mode = detectDrawMode(c.format, all);
        const plan = scheduleFixtures(todo, { ...opts, knockout: mode === "KNOCKOUT" });
        if (!plan.ok) throw new ActionError(plan.error);

        const byId = new Map(todo.map((f) => [f.id, f]));
        for (const s of plan.slots) {
          const f = byId.get(s.fixtureId)!;
          const venue = (c.venue ? `${c.venue} · ${s.courtName}` : s.courtName).slice(0, 120);
          const res = await tx.fixture.updateMany({
            where: { id: f.id, version: f.version },
            data: {
              scheduledAt: new Date(`${s.date}T${s.time}:00+05:30`),
              venue,
              ...(f.status === "POSTPONED" ? { status: "SCHEDULED" } : {}),
              version: { increment: 1 },
            },
          });
          if (res.count === 0) throw new ActionError(STALE);
        }
        await tx.auditLog.create({
          data: { userId: session.id, orgId, action: "COMPETITION_FIXTURES_SCHEDULED", details: JSON.stringify({ competitionId: c.id, fixtures: plan.slots.length, ...opts }) },
        });
        return { scheduled: plan.slots.length, matchDays: plan.matchDays, lastDate: plan.lastDate };
      },
      { timeout: 60_000 }
    );
    revalidatePath("/org/fixtures");
    return { success: true, ...result };
  } catch (e) {
    return fail(e, "Couldn't schedule the fixtures.");
  }
}

// ───────────────────────────── results ─────────────────────────────

/**
 * Records or corrects a score. Allowed for holders of competitions.manage, or the official assigned
 * to the fixture. Knockout winners move into the next round in the same transaction; a knockout
 * result can't change once the next round's fixture has been played, and a group result can't change
 * once the knockout has been seeded from the group tables.
 */
export async function recordResult(
  fixtureId: string,
  input: { homeScore: unknown; awayScore: unknown; winnerEntryId?: string | null; expectedVersion: number }
): Promise<{ success: true } | Fail> {
  if (!enabled()) return OFF;
  const session = await requireAuth(["ADMIN", "COACH", "STAFF"]);
  if (!session.orgId) return { success: false, error: "No academy found" };
  const orgId = session.orgId;
  const membership = await getMembership(session.id, orgId);
  if (!membership) return { success: false, error: "You are not an active member of this academy" };
  const canManage = hasPermission(membership, "competitions.manage");

  try {
    const f0 = await db.fixture.findFirst({ where: { id: String(fixtureId), orgId }, select: { competitionId: true, officialUserId: true } });
    if (!f0) return { success: false, error: "Fixture not found." };
    if (!canManage && f0.officialUserId !== session.id) return { success: false, error: "Only the organiser or this match's official can record the result." };

    await applyFixtureResult({
      orgId,
      fixtureId: String(fixtureId),
      competitionId: f0.competitionId,
      homeScore: input?.homeScore,
      awayScore: input?.awayScore,
      winnerEntryId: input?.winnerEntryId,
      expectedVersion: Number(input?.expectedVersion),
      actorId: session.id,
      asOfficial: !canManage,
    });
    revalidatePath("/org/fixtures");
    return { success: true };
  } catch (e) {
    return fail(e, "Couldn't save the result.");
  }
}

/**
 * Group stage over: fills the knockout bracket from the group tables (top N per group, group winners
 * get any byes, group-mates kept apart in round one where possible). Can be run again until a
 * knockout result is recorded, e.g. after correcting a group result.
 */
export async function seedKnockoutFromGroups(competitionId: string): Promise<{ success: true; qualifiers: number } | Fail> {
  const auth = await manager();
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const orgId = session.orgId;
  try {
    const qualifiers = await db.$transaction(async (tx) => {
      await lockCompetition(tx, String(competitionId));
      const c = await tx.competition.findFirst({ where: { id: String(competitionId), orgId } });
      if (!c) throw new ActionError("Competition not found.");
      if (c.status !== "SCHEDULED") throw new ActionError("This competition isn't running.");
      const fixtures = await tx.fixture.findMany({ where: { competitionId: c.id } });
      if (detectDrawMode(c.format, fixtures) !== "GROUPS") throw new ActionError("This competition has no group stage.");
      const group = fixtures.filter((f) => !isKnockoutPhaseRound(f.round));
      const ko = fixtures.filter((f) => isKnockoutPhaseRound(f.round));
      if (!group.every((f) => decided(f.status))) throw new ActionError("Finish every group fixture first.");
      if (ko.some((f) => f.status === "COMPLETED")) throw new ActionError("Knockout results exist, so the bracket can't be drawn again.");
      const linked = await tx.liveMatch.count({ where: { orgId, fixtureId: { in: ko.map((f) => f.id) }, status: { not: "ABANDONED" } } });
      if (linked) throw new ActionError("A knockout fixture is being scored live, so the bracket can't be drawn again.");

      const { advance } = groupDrawShape(fixtures);
      const entries = await tx.competitionEntry.findMany({ where: { competitionId: c.id }, select: { id: true, name: true } });
      const tables = groupTables(entries, group, pointsOf(c)).map((t) => t.rows.map((r) => r.entryId));
      const seeded = seedKnockoutPhase(tables, advance);
      const byPos = new Map(ko.map((f) => [`${f.round}:${f.slot}`, f]));
      if (seeded.length !== ko.length || seeded.some((s) => !byPos.has(`${s.round}:${s.slot}`))) {
        throw new ActionError("The knockout bracket doesn't match the groups. Make the draw again.");
      }
      for (const s of seeded) {
        const f = byPos.get(`${s.round}:${s.slot}`)!;
        const res = await tx.fixture.updateMany({
          where: { id: f.id, version: f.version },
          data: {
            homeEntryId: s.homeEntryId,
            awayEntryId: s.awayEntryId,
            status: s.status,
            winnerEntryId: s.winnerEntryId,
            homeScore: null,
            awayScore: null,
            version: { increment: 1 },
          },
        });
        if (res.count === 0) throw new ActionError(STALE);
      }
      await tx.auditLog.create({
        data: { userId: session.id, orgId, action: "COMPETITION_KNOCKOUT_SEEDED", details: JSON.stringify({ competitionId: c.id, groups: tables.length, advance }) },
      });
      return tables.reduce((n, t) => n + Math.min(advance, t.length), 0);
    });
    revalidatePath("/org/fixtures");
    return { success: true, qualifiers };
  } catch (e) {
    return fail(e, "Couldn't draw the knockout.");
  }
}

// ───────────────────────────── live scoring ─────────────────────────────

/**
 * Opens live scoring for a fixture: reuses the fixture's live match if there is one, otherwise
 * creates one with the live-scoring create action and links it through LiveMatch.fixtureId.
 * Individual entries are named first name + last initial.
 */
export async function scoreFixtureLive(fixtureId: string, input?: { sport?: string }): Promise<{ success: true; matchId: string } | Fail> {
  const auth = await manager();
  if (!auth.ok) return { success: false, error: auth.error };
  if (!FEATURES.liveScoring) return { success: false, error: "Live scoring isn't enabled for this academy yet." };
  const orgId = auth.session.orgId;
  try {
    const f = await db.fixture.findFirst({
      where: { id: String(fixtureId), orgId },
      include: { competition: true, home: { select: { name: true } }, away: { select: { name: true } } },
    });
    if (!f) return { success: false, error: "Fixture not found." };
    if (!f.home || !f.away || f.status === "BYE" || f.status === "CANCELLED") return { success: false, error: "Both sides must be known before scoring live." };
    if (f.status === "COMPLETED") return { success: false, error: "This fixture already has a result." };
    const existing = await db.liveMatch.findFirst({
      where: { orgId, fixtureId: f.id, status: { not: "ABANDONED" } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (existing) return { success: true, matchId: existing.id };

    const sport = liveSportKeyFor(input?.sport) ?? liveSportKeyFor(f.competition.sport);
    if (!sport) return { success: false, needsSport: true, error: "Pick the sport to score." };
    const c = f.competition;
    const homeName = entryDisplayName(f.home.name, c.entryType).slice(0, 60);
    const awayName = entryDisplayName(f.away.name, c.entryType).slice(0, 60);
    const shape = await db.fixture.findMany({ where: { competitionId: c.id }, select: { round: true } });
    const mode = detectDrawMode(c.format, shape);
    const label = mode === "GROUPS" && !isKnockoutPhaseRound(f.round) ? `Group ${String.fromCharCode(65 + groupOfSlot(f.slot))}` : roundLabel(mode, f.round, shape);
    const created = await createLiveMatch({
      sport,
      title: `${c.name} · ${label}: ${homeName} vs ${awayName}`.slice(0, 80),
      homeName,
      awayName,
      venue: f.venue ?? c.venue ?? undefined,
    });
    if (!created.success) return { success: false, error: created.error };
    await db.liveMatch.updateMany({ where: { id: created.id, orgId, fixtureId: null }, data: { fixtureId: f.id, scheduledAt: f.scheduledAt } });
    revalidatePath("/org/fixtures");
    return { success: true, matchId: created.id };
  } catch (e) {
    return fail(e, "Couldn't start live scoring.");
  }
}
