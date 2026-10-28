"use server";

import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { requireMember } from "@/lib/membership";
import {
  athleteStatForSide,
  buildLiveConfig,
  buildLiveView,
  liveSport,
  parseLiveEvent,
  readLiveConfig,
  replayLive,
  liveWinner,
  scoreboard,
  scoreLine,
  type LiveView,
} from "@/lib/live-match";
import { canScoreAs, getLiveViewForViewer, loadLiveEvents } from "@/lib/live-match-data";
import { isMissingTableError } from "@/lib/schema-pending";

/**
 * Live scoring actions (docs/specs/live-scoring.md). Every write takes a per-match advisory lock and
 * replays the event log, so the stored state is always what the engine says. Taps carry a clientId
 * (a retry after a dropped connection is a no-op) and the version the scorer last saw (a second
 * device can't silently score on top of a stale screen).
 */

type Fail = { success: false; error: string; view?: LiveView };
type Ok<T = {}> = { success: true } & T;

class ActionError extends Error {}
const OFF = "Live scoring isn't enabled for this academy yet.";
const STALE = "Someone else scored on this match. The score has been refreshed.";

async function scorer() {
  if (!FEATURES.liveScoring) throw new ActionError(OFF);
  let ctx;
  try {
    ctx = await requireMember(["ADMIN", "COACH"]);
  } catch (e: any) {
    if (typeof e?.message === "string" && !e.digest) throw new ActionError(e.message);
    throw e;
  }
  if (!canScoreAs(ctx.membership)) throw new ActionError("You don't have permission to score matches.");
  return ctx;
}

async function lock(tx: Prisma.TransactionClient, matchId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"live:" + matchId}))`;
}

function fail(e: unknown, fallback: string): Fail {
  if (e instanceof ActionError) return { success: false, error: e.message };
  if (isMissingTableError(e)) return { success: false, error: OFF };
  if (e && typeof e === "object" && "digest" in e) throw e; // Next.js redirect / notFound
  console.error(`[live-scoring] ${fallback}:`, e instanceof Error ? e.message : e);
  return { success: false, error: fallback };
}

/** Replays the log, stores the snapshot on the match and returns the scorer's view. */
async function persistState(tx: Prisma.TransactionClient, matchId: string, extra: Prisma.LiveMatchUpdateInput = {}) {
  const m = await tx.liveMatch.findUniqueOrThrow({ where: { id: matchId } });
  const def = liveSport(m.sport)!;
  const cfg = readLiveConfig(m.sport, m.config)!;
  const events = await loadLiveEvents(tx, m.id, m.sport);
  const state = replayLive(def.family, cfg, events);
  const board = scoreboard(state);
  const updated = await tx.liveMatch.update({
    where: { id: m.id },
    data: {
      state: { line: scoreLine(board), winner: board.winner, periodsWon: board.periodsWon, points: events.length },
      version: { increment: 1 },
      ...extra,
    },
  });
  return buildLiveView(updated, events, { canScore: updated.status === "LIVE" || updated.status === "SCHEDULED", staff: true })!;
}

async function currentView(matchId: string) {
  return (await getLiveViewForViewer(matchId)) ?? undefined;
}

// ── Create ──────────────────────────────────────────────────────────────────

export async function createLiveMatch(input: {
  sport: string;
  bestOf?: number;
  title?: string;
  homeName?: string;
  awayName?: string;
  homeStudentIds?: string[];
  awayStudentIds?: string[];
  venue?: string;
}): Promise<Ok<{ id: string }> | Fail> {
  try {
    const { session } = await scorer();
    const orgId = session.orgId;
    const def = liveSport(String(input.sport || ""));
    if (!def) throw new ActionError("Pick a sport");
    const config = buildLiveConfig(def.key, Number(input.bestOf) || undefined)!;

    const clean = (s: unknown, max: number) => (typeof s === "string" ? s.trim().slice(0, max) : "");
    const homeIds = [...new Set((input.homeStudentIds ?? []).filter((x) => typeof x === "string"))].slice(0, 12);
    const awayIds = [...new Set((input.awayStudentIds ?? []).filter((x) => typeof x === "string"))].slice(0, 12);
    if (homeIds.some((id) => awayIds.includes(id))) throw new ActionError("A player can't be on both sides");
    const students = homeIds.length + awayIds.length
      ? await db.student.findMany({ where: { orgId, id: { in: [...homeIds, ...awayIds] } }, select: { id: true, name: true } })
      : [];
    if (students.length !== homeIds.length + awayIds.length) throw new ActionError("Some players aren't in this academy");
    const nameOf = (id: string) => students.find((s) => s.id === id)!.name;

    const homeName = clean(input.homeName, 60) || homeIds.map(nameOf).join(" / ");
    const awayName = clean(input.awayName, 60) || awayIds.map(nameOf).join(" / ");
    if (!homeName) throw new ActionError("Add a name or player for the first side");
    if (!awayName) throw new ActionError("Add a name or player for the second side");
    const title = clean(input.title, 80) || `${def.label}: ${homeName} vs ${awayName}`;

    const match = await db.liveMatch.create({
      data: {
        orgId,
        sport: def.key,
        family: def.family,
        config: config as unknown as Prisma.InputJsonValue,
        title,
        homeName,
        awayName,
        venue: clean(input.venue, 80) || null,
        createdById: String(session.id),
        scorerUserId: String(session.id),
        state: { line: "", winner: null, points: 0 },
        players: {
          create: [
            ...homeIds.map((id) => ({ orgId, side: "home", studentId: id, displayName: nameOf(id) })),
            ...awayIds.map((id) => ({ orgId, side: "away", studentId: id, displayName: nameOf(id) })),
          ],
        },
      },
      select: { id: true },
    });
    revalidatePath("/coach");
    return { success: true, id: match.id };
  } catch (e) {
    return fail(e, "Couldn't create the match");
  }
}

// ── Score ───────────────────────────────────────────────────────────────────

export async function recordLiveEvent(input: { matchId: string; version: number; clientId: string; event: unknown }): Promise<Ok<{ view: LiveView }> | Fail> {
  try {
    const { session } = await scorer();
    const clientId = String(input.clientId || "").slice(0, 64);
    if (!clientId) throw new ActionError("Missing tap id");
    const view = await db.$transaction(async (tx) => {
      await lock(tx, input.matchId);
      const m = await tx.liveMatch.findFirst({ where: { id: input.matchId, orgId: session.orgId } });
      if (!m) throw new ActionError("Match not found");
      const def = liveSport(m.sport);
      if (!def) throw new ActionError("This sport can't be scored live yet");

      const dup = await tx.liveMatchEvent.findUnique({ where: { matchId_clientId: { matchId: m.id, clientId } }, select: { id: true } });
      if (dup) {
        const events = await loadLiveEvents(tx, m.id, m.sport);
        return buildLiveView(m, events, { canScore: true, staff: true })!;
      }
      if (m.status === "COMPLETED" || m.status === "ABANDONED") throw new ActionError("This match has finished");
      if (m.version !== Number(input.version)) throw new ActionError(STALE);

      const parsed = parseLiveEvent(def.family, input.event);
      if (!parsed.ok) throw new ActionError(parsed.error);
      const cfg = readLiveConfig(m.sport, m.config)!;
      const before = await loadLiveEvents(tx, m.id, m.sport);
      if (liveWinner(replayLive(def.family, cfg, before))) throw new ActionError("The match is decided. Finish it, or undo the last point.");

      const last = await tx.liveMatchEvent.findFirst({ where: { matchId: m.id }, orderBy: { seq: "desc" }, select: { seq: true } });
      await tx.liveMatchEvent.create({
        data: {
          orgId: m.orgId,
          matchId: m.id,
          seq: (last?.seq ?? 0) + 1,
          type: parsed.event.type,
          payload: parsed.event as unknown as Prisma.InputJsonValue,
          clientId,
          createdById: String(session.id),
        },
      });
      return persistState(tx, m.id, m.status === "SCHEDULED" ? { status: "LIVE", startedAt: new Date() } : {});
    });
    return { success: true, view };
  } catch (e) {
    const r = fail(e, "Couldn't save that point");
    if (e instanceof ActionError) r.view = await currentView(input.matchId).catch(() => undefined);
    return r;
  }
}

export async function undoLiveEvent(input: { matchId: string; version: number }): Promise<Ok<{ view: LiveView }> | Fail> {
  try {
    const { session } = await scorer();
    const view = await db.$transaction(async (tx) => {
      await lock(tx, input.matchId);
      const m = await tx.liveMatch.findFirst({ where: { id: input.matchId, orgId: session.orgId } });
      if (!m) throw new ActionError("Match not found");
      if (m.status === "COMPLETED" || m.status === "ABANDONED") throw new ActionError("This match has finished");
      if (m.version !== Number(input.version)) throw new ActionError(STALE);
      const last = await tx.liveMatchEvent.findFirst({ where: { matchId: m.id, voidedAt: null }, orderBy: { seq: "desc" } });
      if (!last) throw new ActionError("Nothing to undo");
      await tx.liveMatchEvent.update({ where: { id: last.id }, data: { voidedAt: new Date(), voidedById: String(session.id) } });
      return persistState(tx, m.id);
    });
    return { success: true, view };
  } catch (e) {
    const r = fail(e, "Couldn't undo");
    if (e instanceof ActionError) r.view = await currentView(input.matchId).catch(() => undefined);
    return r;
  }
}

// ── Finish / abandon ─────────────────────────────────────────────────────────

/** Ends the match and writes one AthleteMatchStat per linked player (feeds athlete profiles later). */
export async function finishLiveMatch(input: { matchId: string; abandon?: boolean }): Promise<Ok<{ view: LiveView }> | Fail> {
  try {
    const { session } = await scorer();
    const view = await db.$transaction(async (tx) => {
      await lock(tx, input.matchId);
      const m = await tx.liveMatch.findFirst({ where: { id: input.matchId, orgId: session.orgId }, include: { players: true } });
      if (!m) throw new ActionError("Match not found");
      if (m.status === "COMPLETED" || m.status === "ABANDONED") throw new ActionError("This match has already finished");
      const def = liveSport(m.sport)!;
      const cfg = readLiveConfig(m.sport, m.config)!;
      const events = await loadLiveEvents(tx, m.id, m.sport);
      if (!input.abandon && events.length === 0) throw new ActionError("No points scored yet. Abandon the match instead?");
      const state = replayLive(def.family, cfg, events);
      const endedAt = new Date();
      if (!input.abandon) {
        for (const p of m.players) {
          if (!p.studentId || (p.side !== "home" && p.side !== "away")) continue;
          const stats = athleteStatForSide(state, events, p.side);
          await tx.athleteMatchStat.upsert({
            where: { matchId_studentId: { matchId: m.id, studentId: p.studentId } },
            create: { orgId: m.orgId, matchId: m.id, studentId: p.studentId, sport: m.sport, stats, playedAt: m.startedAt ?? endedAt },
            update: { stats, playedAt: m.startedAt ?? endedAt },
          });
        }
      }
      return persistState(tx, m.id, { status: input.abandon ? "ABANDONED" : "COMPLETED", endedAt });
    });
    revalidatePath("/coach");
    return { success: true, view };
  } catch (e) {
    return fail(e, "Couldn't finish the match");
  }
}

// ── Sharing ──────────────────────────────────────────────────────────────────

/** Turns the public link on (new random token) or off (back to academy-only; the old link stops working). */
export async function setLiveMatchSharing(input: { matchId: string; share: boolean }): Promise<Ok<{ token: string | null }> | Fail> {
  try {
    const { session } = await scorer();
    const m = await db.liveMatch.findFirst({ where: { id: input.matchId, orgId: session.orgId }, select: { id: true } });
    if (!m) throw new ActionError("Match not found");
    const token = input.share ? crypto.randomBytes(12).toString("base64url") : null;
    await db.liveMatch.update({ where: { id: m.id }, data: { visibility: input.share ? "LINK" : "ACADEMY", shareToken: token } });
    return { success: true, token };
  } catch (e) {
    return fail(e, "Couldn't change sharing");
  }
}

/** Polled by the live screens. Same visibility rules as the page. */
export async function getLiveMatchView(input: { matchId: string; token?: string | null }): Promise<Ok<{ view: LiveView }> | Fail> {
  try {
    if (!FEATURES.liveScoring) throw new ActionError(OFF);
    const view = await getLiveViewForViewer(String(input.matchId), input.token ?? null);
    if (!view) throw new ActionError("Match not found");
    return { success: true, view };
  } catch (e) {
    return fail(e, "Couldn't load the match");
  }
}
