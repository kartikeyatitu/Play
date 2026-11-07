// TRIQ Rewards: badge rules (spec §4). Pure.
//
// Auto badges are awarded from the XP ledger (plus the attendance history for "in a row"). Each badge has a
// fixed key, name, icon and rule so parents can understand it. Coach badges have no rule; a coach awards
// them with a reason, at most one per child per term. Never reads wellbeing or medical data.

import { attendedSession } from "@/lib/athlete/points-rules";
import { parseXpReason, type XpRow } from "./levels";

export type BadgeRule =
  | { type: "SESSIONS_TOTAL"; count: number }
  | { type: "SESSIONS_STREAK"; count: number }
  | { type: "WINS"; count: number }
  | { type: "PERSONAL_BESTS"; count: number }
  | { type: "TAG"; tag: BadgeTag; count: number };

/** Sport-specific match tags the match-log hook may pass with MATCH_PLAYED (stored on the XP row note). */
export const BADGE_TAGS = ["CLEAN_SHEET", "ALL_ROUND"] as const;
export type BadgeTag = (typeof BADGE_TAGS)[number];
export const isBadgeTag = (v: unknown): v is BadgeTag => typeof v === "string" && (BADGE_TAGS as readonly string[]).includes(v);

export type BadgeDef = { key: string; name: string; description: string; icon: string; rule: BadgeRule | null };

/** The TRIQ library (BadgeDefinition rows with orgId null). Keys are stable; never rename. */
export const GLOBAL_BADGES: ReadonlyArray<BadgeDef> = [
  { key: "first-session", name: "First session", description: "Came to a first session.", icon: "footprints", rule: { type: "SESSIONS_TOTAL", count: 1 } },
  { key: "ten-in-a-row", name: "10 in a row", description: "Attended 10 sessions in a row.", icon: "flame", rule: { type: "SESSIONS_STREAK", count: 10 } },
  { key: "fifty-sessions", name: "50 sessions", description: "Attended 50 sessions.", icon: "calendar-check", rule: { type: "SESSIONS_TOTAL", count: 50 } },
  { key: "first-win", name: "First win", description: "Won a first match.", icon: "trophy", rule: { type: "WINS", count: 1 } },
  { key: "personal-best", name: "Personal best", description: "Set a personal best.", icon: "timer", rule: { type: "PERSONAL_BESTS", count: 1 } },
  { key: "clean-sheet", name: "Clean sheet", description: "Kept a clean sheet in a match.", icon: "shield", rule: { type: "TAG", tag: "CLEAN_SHEET", count: 1 } },
  { key: "all-round", name: "All-round match", description: "Contributed across the game in one match.", icon: "sparkles", rule: { type: "TAG", tag: "ALL_ROUND", count: 1 } },
  { key: "team-player", name: "Team player", description: "Awarded by a coach for putting the team first.", icon: "users", rule: null },
  { key: "most-improved", name: "Most improved", description: "Awarded by a coach for the biggest improvement.", icon: "trending-up", rule: null },
];

export const COACH_BADGE_KEYS = GLOBAL_BADGES.filter((b) => b.rule == null).map((b) => b.key);

export function parseBadgeRule(v: unknown): BadgeRule | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const count = typeof o.count === "number" && Number.isInteger(o.count) && o.count >= 1 && o.count <= 10000 ? o.count : null;
  if (count == null) return null;
  switch (o.type) {
    case "SESSIONS_TOTAL":
    case "SESSIONS_STREAK":
    case "WINS":
    case "PERSONAL_BESTS":
      return { type: o.type, count };
    case "TAG":
      return isBadgeTag(o.tag) ? { type: "TAG", tag: o.tag, count } : null;
    default:
      return null;
  }
}

// ── Stats from the ledger ───────────────────────────────────────────────────

export type BadgeStats = { sessions: number; bestStreak: number; wins: number; personalBests: number; tags: Record<BadgeTag, number> };

/** Tag note written on an XP row, e.g. "tags=CLEAN_SHEET,ALL_ROUND". */
export function tagsNote(tags: ReadonlyArray<string> | undefined): string | null {
  const ok = (tags ?? []).filter(isBadgeTag);
  return ok.length ? `tags=${[...new Set(ok)].join(",")}` : null;
}

export function parseTagsNote(note: string | null | undefined): BadgeTag[] {
  const m = /(?:^|\s)tags=([A-Z_,]+)/.exec(note ?? "");
  return m ? m[1].split(",").filter(isBadgeTag) : [];
}

export type AttendanceRow = { isPresent: boolean; status: string | null; date: Date | string; sessionStatus?: string | null };

/**
 * Longest run of attended sessions. Cancelled sessions and excused absences are skipped (neutral),
 * like the passport. A plain absence ends a run, but this only ever decides whether a badge is EARNED;
 * a badge is never taken away and no XP or points are ever reduced for a missed session.
 */
export function bestAttendanceStreak(rows: ReadonlyArray<AttendanceRow>): number {
  const ordered = rows
    .filter((r) => r.sessionStatus !== "CANCELLED" && r.status !== "EXCUSED")
    .map((r) => ({ at: new Date(r.date).getTime(), present: attendedSession(r) }))
    .filter((r) => Number.isFinite(r.at))
    .sort((a, b) => a.at - b.at);
  let best = 0;
  let run = 0;
  for (const r of ordered) {
    run = r.present ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

export function badgeStats(xpRows: ReadonlyArray<XpRow & { note?: string | null }>, attendance: ReadonlyArray<AttendanceRow>): BadgeStats {
  const tags: Record<BadgeTag, number> = { CLEAN_SHEET: 0, ALL_ROUND: 0 };
  let sessions = 0;
  let wins = 0;
  let personalBests = 0;
  for (const r of xpRows) {
    if (r.delta <= 0) continue;
    const { trigger } = parseXpReason(r.reasonCode);
    if (trigger === "SESSION_ATTENDED") sessions++;
    else if (trigger === "MATCH_WON") wins++;
    else if (trigger === "PERSONAL_BEST") personalBests++;
    for (const t of parseTagsNote(r.note)) tags[t]++;
  }
  return { sessions, bestStreak: bestAttendanceStreak(attendance), wins, personalBests, tags };
}

export function ruleMet(rule: BadgeRule, s: BadgeStats): boolean {
  switch (rule.type) {
    case "SESSIONS_TOTAL":
      return s.sessions >= rule.count;
    case "SESSIONS_STREAK":
      return s.bestStreak >= rule.count;
    case "WINS":
      return s.wins >= rule.count;
    case "PERSONAL_BESTS":
      return s.personalBests >= rule.count;
    case "TAG":
      return (s.tags[rule.tag] ?? 0) >= rule.count;
  }
}

/** Auto badges newly earned: rule met and not already held. Manual (rule-less) badges never auto-award. */
export function badgesToAward<T extends { key: string; rule: unknown }>(defs: ReadonlyArray<T>, stats: BadgeStats, held: ReadonlySet<string>): T[] {
  return defs.filter((d) => {
    if (held.has(d.key)) return false;
    const rule = parseBadgeRule(d.rule);
    return rule != null && ruleMet(rule, stats);
  });
}

// ── Coach badges: one per child per term ────────────────────────────────────

/** Terms are calendar thirds (Jan–Apr, May–Aug, Sep–Dec) until academies can set their own. */
export function termOf(d: Date): { key: string; start: Date; end: Date } {
  const y = d.getUTCFullYear();
  const t = Math.floor(d.getUTCMonth() / 4);
  return { key: `${y}-T${t + 1}`, start: new Date(Date.UTC(y, t * 4, 1)), end: new Date(Date.UTC(y, t * 4 + 4, 1)) };
}

export function canCoachAwardBadge(input: {
  badgeKey: string;
  reason: string;
  coachAwardedThisTerm: number;
  alreadyHeld: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (!COACH_BADGE_KEYS.includes(input.badgeKey)) return { ok: false, error: "That badge can't be awarded by a coach" };
  if (input.reason.trim().length < 3) return { ok: false, error: "Add a short reason" };
  if (input.alreadyHeld) return { ok: false, error: "This player already has that badge" };
  if (input.coachAwardedThisTerm >= 1) return { ok: false, error: "Only one coach badge per player per term" };
  return { ok: true };
}
