"use server";

import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { requireMember } from "@/lib/membership";
import {
  buildLiveConfig,
  hasOpponent,
  isDecided,
  liveOutcome,
  liveSport,
  parseLiveEvent,
  playerStatLine,
  readLiveConfig,
  replayLive,
  summaryLine,
  type CricketLiveConfig,
  type LiveOptions,
  type LiveSide,
  type LiveView,
  type PerformanceConfig,
} from "@/lib/live-match";
import type { GoalsConfig } from "@/lib/scoring/goals";
import { isPersonalBest } from "@/lib/scoring/performance";
import { canScoreAs, getLiveViewForViewer, loadLiveLog, viewForMatch } from "@/lib/live-match-data";
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
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { success: false, error: "That name is already in this match." };
  console.error(`[live-scoring] ${fallback}:`, e instanceof Error ? e.message : e);
  return { success: false, error: fallback };
}

const PLAYERS = { orderBy: { createdAt: "asc" as const }, select: { side: true, studentId: true, displayName: true } };

/** Replays the log, stores the snapshot on the match and returns the scorer's view. */
async function persistState(tx: Prisma.TransactionClient, matchId: string, extra: Prisma.LiveMatchUpdateInput = {}) {
  const m = await tx.liveMatch.findUniqueOrThrow({ where: { id: matchId } });
  const def = liveSport(m.sport)!;
  const cfg = readLiveConfig(m.sport, m.config)!;
  const { events } = await loadLiveLog(tx, m.id, m.sport, m.config);
  const finishing = extra.status === "COMPLETED";
  const state = replayLive(def.family, cfg, events, finishing || m.status === "COMPLETED");
  const battingFirst = (cfg as CricketLiveConfig).battingFirst ?? "home";
  const updated = await tx.liveMatch.update({
    where: { id: m.id },
    data: {
      state: {
        line: summaryLine(state, cfg, { home: m.homeName, away: m.awayName || "" }),
        outcome: liveOutcome(state, battingFirst),
        points: events.length,
      },
      version: { increment: 1 },
      ...extra,
    },
    include: { players: PLAYERS },
  });
  return (await viewForMatch(tx, updated, { canScore: true, staff: true }))!;
}

async function currentView(matchId: string) {
  return (await getLiveViewForViewer(matchId)) ?? undefined;
}

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.trim().replace(/\s+/g, " ").slice(0, max) : "");

// ── Create ──────────────────────────────────────────────────────────────────

export async function createLiveMatch(input: {
  sport: string;
  bestOf?: number;
  overs?: number;
  battingFirst?: LiveSide;
  periodMinutes?: number;
  eventName?: string;
  measure?: string;
  attempts?: number;
  title?: string;
  homeName?: string;
  awayName?: string;
  homeStudentIds?: string[];
  awayStudentIds?: string[];
  /** Players who aren't academy students (opposition, guests), one name each. */
  homePlayerNames?: string[];
  awayPlayerNames?: string[];
  venue?: string;
}): Promise<Ok<{ id: string }> | Fail> {
  try {
    const { session } = await scorer();
    const orgId = session.orgId;
    const def = liveSport(String(input.sport || ""));
    if (!def) throw new ActionError("Pick a sport");
    const options: LiveOptions = {
      bestOf: Number(input.bestOf) || undefined,
      overs: Number(input.overs) || undefined,
      battingFirst: input.battingFirst === "away" ? "away" : "home",
      periodMinutes: Number(input.periodMinutes) || undefined,
      eventName: clean(input.eventName, 60),
      measure: input.measure as LiveOptions["measure"],
      attempts: Number(input.attempts) || undefined,
    };
    const config = buildLiveConfig(def.key, options)!;
    const opponent = hasOpponent(def.family);

    const ids = (v: unknown) => [...new Set((Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string"))];
    const names = (v: unknown) => [...new Set((Array.isArray(v) ? v : []).map((x) => clean(x, 60)).filter(Boolean))];
    const homeIds = ids(input.homeStudentIds);
    const awayIds = opponent ? ids(input.awayStudentIds) : [];
    const homeExtra = names(input.homePlayerNames);
    const awayExtra = opponent ? names(input.awayPlayerNames) : [];
    if (homeIds.some((id) => awayIds.includes(id))) throw new ActionError("A player can't be on both sides");
    if (homeIds.length + homeExtra.length > def.maxPerSide || awayIds.length + awayExtra.length > def.maxPerSide) {
      throw new ActionError(`${def.label} allows up to ${def.maxPerSide} ${def.family === "performance" ? "athletes" : "players per side"}`);
    }
    const students = homeIds.length + awayIds.length
      ? await db.student.findMany({ where: { orgId, id: { in: [...homeIds, ...awayIds] } }, select: { id: true, name: true } })
      : [];
    if (students.length !== homeIds.length + awayIds.length) throw new ActionError("Some players aren't in this academy");
    const nameOf = (id: string) => students.find((s) => s.id === id)!.name.trim().replace(/\s+/g, " ").slice(0, 60);

    // Names identify players inside the match, so they must be unique across both sides.
    const all = [...homeIds.map(nameOf), ...homeExtra, ...awayIds.map(nameOf), ...awayExtra];
    const dupe = all.find((n, i) => all.findIndex((m) => m.toLowerCase() === n.toLowerCase()) !== i);
    if (dupe) throw new ActionError(`"${dupe}" appears twice. Add a surname or initial so each player is unique.`);

    const sideLabel = (pickedIds: string[], extra: string[], max: number) =>
      max <= 2 ? [...pickedIds.map(nameOf), ...extra].join(" / ") : "";
    let homeName = clean(input.homeName, 60);
    let awayName = clean(input.awayName, 60);
    if (def.family === "performance") {
      homeName = (config as PerformanceConfig).eventName;
      awayName = "";
      if (homeIds.length + homeExtra.length < 1) throw new ActionError("Add at least one athlete");
    } else {
      homeName ||= sideLabel(homeIds, homeExtra, def.maxPerSide);
      awayName ||= sideLabel(awayIds, awayExtra, def.maxPerSide);
      if (!homeName) throw new ActionError(def.maxPerSide <= 2 ? "Add a player for the first side" : "Name your team");
      if (!awayName) throw new ActionError(def.maxPerSide <= 2 ? "Add a player or name for the opponent" : "Name the opposing team");
    }
    const title =
      clean(input.title, 80) ||
      (def.family === "performance" ? `${def.label}: ${homeName}` : `${def.label}: ${homeName} vs ${awayName}`);
    const fieldSide = def.family === "performance" ? "field" : "home";

    const match = await db.liveMatch.create({
      data: {
        orgId,
        sport: def.key,
        family: def.family,
        config: config as unknown as Prisma.InputJsonValue,
        title,
        homeName,
        awayName: awayName || null,
        venue: clean(input.venue, 80) || null,
        createdById: String(session.id),
        scorerUserId: String(session.id),
        state: { line: "", outcome: null, points: 0 },
        players: {
          create: [
            ...homeIds.map((id) => ({ orgId, side: fieldSide, studentId: id, displayName: nameOf(id) })),
            ...homeExtra.map((n) => ({ orgId, side: fieldSide, displayName: n })),
            ...awayIds.map((id) => ({ orgId, side: "away", studentId: id, displayName: nameOf(id) })),
            ...awayExtra.map((n) => ({ orgId, side: "away", displayName: n })),
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

/** Adds a player during the match (a new batter or bowler for the opposition, a substitute, a late entry). */
export async function addLivePlayer(input: { matchId: string; side: "home" | "away" | "field"; name: string }): Promise<Ok<{ view: LiveView }> | Fail> {
  try {
    const { session } = await scorer();
    const n = clean(input.name, 60);
    if (!n) throw new ActionError("Type a name");
    const view = await db.$transaction(async (tx) => {
      await lock(tx, input.matchId);
      const m = await tx.liveMatch.findFirst({ where: { id: input.matchId, orgId: session.orgId }, include: { players: PLAYERS } });
      if (!m) throw new ActionError("Match not found");
      if (m.status === "COMPLETED" || m.status === "ABANDONED") throw new ActionError("This match has finished");
      const def = liveSport(m.sport)!;
      const side = def.family === "performance" ? "field" : input.side === "away" ? "away" : "home";
      if (m.players.some((p) => p.displayName.toLowerCase() === n.toLowerCase())) throw new ActionError(`"${n}" is already in this match`);
      if (m.players.filter((p) => p.side === side).length >= def.maxPerSide + 10) throw new ActionError("That side is full");
      await tx.liveMatchPlayer.create({ data: { orgId: m.orgId, matchId: m.id, side, displayName: n } });
      return persistState(tx, m.id);
    });
    return { success: true, view };
  } catch (e) {
    return fail(e, "Couldn't add the player");
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
      const m = await tx.liveMatch.findFirst({ where: { id: input.matchId, orgId: session.orgId }, include: { players: PLAYERS } });
      if (!m) throw new ActionError("Match not found");
      const def = liveSport(m.sport);
      if (!def) throw new ActionError("This sport can't be scored live yet");

      const dup = await tx.liveMatchEvent.findUnique({ where: { matchId_clientId: { matchId: m.id, clientId } }, select: { id: true } });
      if (dup) return (await viewForMatch(tx, m, { canScore: true, staff: true }))!;
      if (m.status === "COMPLETED" || m.status === "ABANDONED") throw new ActionError("This match has finished");
      if (m.version !== Number(input.version)) throw new ActionError(STALE);

      const cfg = readLiveConfig(m.sport, m.config)!;
      const parsed = parseLiveEvent(def.family, input.event, cfg);
      if (!parsed.ok) throw new ActionError(parsed.error);
      let event = parsed.event;
      const { events: before, periodStartedAt } = await loadLiveLog(tx, m.id, m.sport, m.config);
      const state = replayLive(def.family, cfg, before);
      const battingFirst = (cfg as CricketLiveConfig).battingFirst ?? "home";
      if (isDecided(state, battingFirst)) {
        throw new ActionError(def.family === "goals" ? "Full time. Finish the match, or undo the last action." : "The match is decided. Finish it, or undo the last entry.");
      }

      if (def.family === "goals" && state.family === "goals") {
        const g = state.goals;
        if (event.type === "period_start") {
          if (g.live) throw new ActionError(`${(cfg as GoalsConfig).periodLabel} ${g.period} is still on. End it first.`);
          if (event.period !== g.period + 1) throw new ActionError(`Next is ${(cfg as GoalsConfig).periodLabel.toLowerCase()} ${g.period + 1}`);
        } else if (event.type === "period_end") {
          if (!g.live || event.period !== g.period) throw new ActionError("No period is running");
        } else if (!g.live) {
          throw new ActionError(`Start ${(cfg as GoalsConfig).periodLabel.toLowerCase()} ${g.period + 1} first`);
        }
        // Server clock: minute of play from when the period started, unless the scorer typed one.
        if ((event.type === "score" || event.type === "card" || event.type === "sub" || event.type === "foul") && (event as { minute?: number }).minute == null && periodStartedAt) {
          const per = (cfg as GoalsConfig).periodMinutes ?? 0;
          const elapsed = Math.floor((Date.now() - periodStartedAt.getTime()) / 60000) + 1;
          event = { ...event, minute: Math.min(200, (g.period - 1) * per + Math.max(1, elapsed)) };
        }
      }
      if (def.family === "performance" && event.type === "result" && "athlete" in event) {
        const athlete = event.athlete;
        if (!m.players.some((p) => p.displayName === athlete)) throw new ActionError("Add the athlete to this event first");
        const done = before.filter((e) => e.type === "result" && "athlete" in e && e.athlete === athlete).length;
        const max = (cfg as PerformanceConfig).attempts;
        if (done >= max) throw new ActionError(max === 1 ? `${athlete} already has a result. Undo it to change it.` : `${athlete} has used all ${max} attempts`);
        event = { ...event, attempt: done + 1 };
      }

      const last = await tx.liveMatchEvent.findFirst({ where: { matchId: m.id }, orderBy: { seq: "desc" }, select: { seq: true } });
      await tx.liveMatchEvent.create({
        data: {
          orgId: m.orgId,
          matchId: m.id,
          seq: (last?.seq ?? 0) + 1,
          type: event.type,
          payload: event as unknown as Prisma.InputJsonValue,
          clientId,
          createdById: String(session.id),
        },
      });
      return persistState(tx, m.id, m.status === "SCHEDULED" ? { status: "LIVE", startedAt: new Date() } : {});
    });
    return { success: true, view };
  } catch (e) {
    const r = fail(e, "Couldn't save that");
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

/**
 * Ends the match and writes one AthleteMatchStat per academy athlete in it. Timed and measured events
 * also write a PerformanceResult per athlete (best mark, personal-best flag).
 */
export async function finishLiveMatch(input: { matchId: string; abandon?: boolean }): Promise<Ok<{ view: LiveView }> | Fail> {
  try {
    const { session } = await scorer();
    const view = await db.$transaction(
      async (tx) => {
        await lock(tx, input.matchId);
        const m = await tx.liveMatch.findFirst({ where: { id: input.matchId, orgId: session.orgId }, include: { players: true } });
        if (!m) throw new ActionError("Match not found");
        if (m.status === "COMPLETED" || m.status === "ABANDONED") throw new ActionError("This match has already finished");
        const def = liveSport(m.sport)!;
        const cfg = readLiveConfig(m.sport, m.config)!;
        const { events } = await loadLiveLog(tx, m.id, m.sport, m.config);
        if (!input.abandon && events.length === 0) throw new ActionError("Nothing scored yet. Cancel the match instead?");
        const state = replayLive(def.family, cfg, events, true);
        const endedAt = new Date();
        const playedAt = m.startedAt ?? endedAt;
        if (!input.abandon) {
          for (const p of m.players) {
            if (!p.studentId) continue;
            const side = p.side === "away" ? "away" : p.side === "field" ? "field" : "home";
            const stats = playerStatLine(def.family, state, events, cfg, p.displayName, side);
            if (!stats) continue;
            await tx.athleteMatchStat.upsert({
              where: { matchId_studentId: { matchId: m.id, studentId: p.studentId } },
              create: { orgId: m.orgId, matchId: m.id, studentId: p.studentId, sport: m.sport, stats: stats as Prisma.InputJsonValue, playedAt },
              update: { stats: stats as Prisma.InputJsonValue, playedAt },
            });
            if (state.family === "performance") {
              const pc = cfg as PerformanceConfig;
              const r = state.ranked.find((x) => x.athlete === p.displayName);
              if (!r) continue;
              let pb = false;
              if (r.best != null) {
                const prev = await tx.performanceResult.findFirst({
                  where: { studentId: p.studentId, sport: m.sport, eventName: pc.eventName, measure: pc.measure, status: "OK", value: { not: null } },
                  orderBy: { value: pc.measure === "time" ? "asc" : "desc" },
                  select: { value: true },
                });
                pb = isPersonalBest(r.best, prev?.value ?? null, pc.measure);
              }
              await tx.performanceResult.deleteMany({ where: { matchId: m.id, studentId: p.studentId } });
              await tx.performanceResult.create({
                data: {
                  orgId: m.orgId,
                  matchId: m.id,
                  studentId: p.studentId,
                  sport: m.sport,
                  eventName: pc.eventName,
                  measure: pc.measure,
                  value: r.best,
                  status: r.status,
                  isPersonalBest: pb,
                  recordedById: String(session.id),
                  recordedAt: playedAt,
                },
              });
            }
          }
        }
        return persistState(tx, m.id, { status: input.abandon ? "ABANDONED" : "COMPLETED", endedAt });
      },
      { timeout: 20000 },
    );
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
