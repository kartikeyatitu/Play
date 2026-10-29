import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getMembership, hasPermission } from "@/lib/membership";
import {
  buildLiveView,
  canViewMatch,
  liveSport,
  parseLiveEvent,
  publicName,
  readLiveConfig,
  type LiveEvent,
  type LiveMatchRecord,
  type LiveView,
  type RosterEntry,
} from "@/lib/live-match";
import { isMissingTableError } from "@/lib/schema-pending";
import type { Prisma } from "@prisma/client";

type Client = Prisma.TransactionClient | typeof db;

/** Non-voided events in order, parsed for the match's family (anything malformed is skipped), plus when the last period started. */
export async function loadLiveLog(client: Client, matchId: string, sport: string, config?: unknown) {
  const def = liveSport(sport);
  if (!def) return { events: [] as LiveEvent[], periodStartedAt: null as Date | null };
  const cfg = readLiveConfig(sport, config);
  const rows = await client.liveMatchEvent.findMany({
    where: { matchId, voidedAt: null },
    orderBy: { seq: "asc" },
    select: { payload: true, createdAt: true },
  });
  const events: LiveEvent[] = [];
  let periodStartedAt: Date | null = null;
  for (const r of rows) {
    const p = parseLiveEvent(def.family, r.payload, cfg);
    if (!p.ok) continue;
    events.push(p.event);
    if (p.event.type === "period_start") periodStartedAt = r.createdAt;
    if (p.event.type === "period_end") periodStartedAt = null;
  }
  return { events, periodStartedAt };
}

export async function loadLiveEvents(client: Client, matchId: string, sport: string, config?: unknown): Promise<LiveEvent[]> {
  return (await loadLiveLog(client, matchId, sport, config)).events;
}

/** Coaches score; owners/managers need competitions.manage. */
export function canScoreAs(membership: { role: string; staffRole?: string | null; permissions?: string | null }): boolean {
  return membership.role === "COACH" || hasPermission(membership, "competitions.manage");
}

type PlayerRow = { side: string; studentId: string | null; displayName: string };

function rosterOf(players: PlayerRow[]): RosterEntry[] {
  return players.map((p) => ({ name: p.displayName, side: p.side === "away" ? "away" : p.side === "field" ? "field" : "home", academy: !!p.studentId }));
}

/** Builds the view for a match row (used by actions after a write, and by the viewer). */
export async function viewForMatch(
  client: Client,
  match: LiveMatchRecord & { players: PlayerRow[] },
  opts: { canScore: boolean; staff: boolean; publicNames?: boolean },
): Promise<LiveView | null> {
  const { events, periodStartedAt } = await loadLiveLog(client, match.id, match.sport, match.config);
  let sideNames: { home: string; away: string } | undefined;
  if (opts.publicNames) {
    const side = (s: string, fallback: string) => {
      const linked = match.players.filter((p) => p.side === s && p.studentId);
      return linked.length ? linked.map((p) => publicName(p.displayName)).join(" / ") : fallback;
    };
    sideNames = { home: side("home", match.homeName), away: side("away", match.awayName || "Opponent") };
  }
  return buildLiveView(match, events, {
    canScore: opts.canScore && (match.status === "LIVE" || match.status === "SCHEDULED"),
    staff: opts.staff,
    publicNames: opts.publicNames,
    roster: rosterOf(match.players),
    periodStartedAt,
    sideNames,
  });
}

/**
 * The match as the current viewer may see it, or null (not found, or not allowed — the two look the
 * same from outside so match ids can't be probed). `token` is the share-link token from the URL.
 */
export async function getLiveViewForViewer(matchId: string, token?: string | null): Promise<LiveView | null> {
  let match;
  try {
    match = await db.liveMatch.findUnique({ where: { id: matchId }, include: { players: { select: { side: true, studentId: true, displayName: true }, orderBy: { createdAt: "asc" } } } });
  } catch (e) {
    if (isMissingTableError(e)) return null;
    throw e;
  }
  if (!match) return null;

  const session = await getSession();
  let staffOfOrg = false;
  let canScore = false;
  let parentOfPlayer = false;
  if (session?.id) {
    const membership = await getMembership(String(session.id), match.orgId);
    if (membership) {
      staffOfOrg = true;
      canScore = canScoreAs(membership);
    } else {
      const ids = match.players.map((p) => p.studentId).filter((x): x is string => !!x);
      if (ids.length) {
        parentOfPlayer = (await db.student.count({ where: { id: { in: ids }, parentId: String(session.id), orgId: match.orgId } })) > 0;
      }
    }
  }
  if (!canViewMatch(match, { staffOfOrg, parentOfPlayer, token })) return null;

  // Outsiders on a share link see every person as first name + initial.
  return viewForMatch(db, match, { canScore, staff: staffOfOrg, publicNames: !staffOfOrg && !parentOfPlayer });
}

export type LiveMatchRow = { id: string; title: string; sport: string; status: string; homeName: string; awayName: string | null; line: string; updatedAt: string };

/** Recent matches for the academy's match list (newest first). */
export async function listLiveMatches(orgId: string, limit = 20): Promise<LiveMatchRow[]> {
  try {
    const rows = await db.liveMatch.findMany({
      where: { orgId, status: { not: "ABANDONED" } },
      orderBy: [{ updatedAt: "desc" }],
      take: limit,
      select: { id: true, title: true, sport: true, status: true, homeName: true, awayName: true, state: true, updatedAt: true },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      sport: r.sport,
      status: r.status,
      homeName: r.homeName,
      awayName: r.awayName,
      line: r.state && typeof r.state === "object" && typeof (r.state as any).line === "string" ? (r.state as any).line : "",
      updatedAt: r.updatedAt.toISOString(),
    }));
  } catch (e) {
    if (isMissingTableError(e)) return [];
    throw e;
  }
}
