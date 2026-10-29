import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getMembership, hasPermission } from "@/lib/membership";
import {
  buildLiveView,
  canViewMatch,
  liveSport,
  parseLiveEvent,
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
  opts: { canScore: boolean; staff: boolean; publicNames?: boolean; ownNames?: ReadonlySet<string> },
): Promise<LiveView | null> {
  const { events, periodStartedAt } = await loadLiveLog(client, match.id, match.sport, match.config);
  // Names are masked inside buildLiveView (side labels and title included), so no side labels are built here.
  return buildLiveView(match, events, {
    canScore: opts.canScore && (match.status === "LIVE" || match.status === "SCHEDULED"),
    staff: opts.staff,
    publicNames: opts.publicNames,
    ownNames: opts.ownNames,
    roster: rosterOf(match.players),
    periodStartedAt,
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
  // A parent's own children in this match (their displayNames); everyone else is masked for them.
  const ownNames = new Set<string>();
  if (session?.id) {
    const membership = await getMembership(String(session.id), match.orgId);
    if (membership) {
      staffOfOrg = true;
      canScore = canScoreAs(membership);
    } else {
      const linked = match.players.filter((p) => p.studentId);
      if (linked.length) {
        const own = await db.student.findMany({
          where: { id: { in: linked.map((p) => p.studentId as string) }, parentId: String(session.id), orgId: match.orgId },
          select: { id: true },
        });
        const ownIds = new Set(own.map((s) => s.id));
        for (const p of linked) if (ownIds.has(p.studentId as string)) ownNames.add(p.displayName);
        parentOfPlayer = ownIds.size > 0;
      }
    }
  }
  if (!canViewMatch(match, { staffOfOrg, parentOfPlayer, token })) return null;

  if (staffOfOrg) return viewForMatch(db, match, { canScore, staff: true });
  // Parents see their own children by name; outsiders on a share link see no names at all.
  if (parentOfPlayer) return viewForMatch(db, match, { canScore: false, staff: false, ownNames });
  return viewForMatch(db, match, { canScore: false, staff: false, publicNames: true });
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
