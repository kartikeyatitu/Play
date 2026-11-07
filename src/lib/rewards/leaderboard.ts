// TRIQ Rewards: leaderboards (spec §6). Pure.
//
// Per batch and per age group, never across ages. First name + last initial only. Opted-in children
// only (separate from photo consent). Ranks by XP, shows the attendance streak. Never the points balance
// (spending must not read as failing), never photos, never wellbeing or medical data: the input type
// only has the fields below and the output is rebuilt field by field.

export type LeaderboardEntry = {
  studentId: string;
  name: string;
  dob: Date | string | null;
  optedIn: boolean;
  xp: number;
  streak: number;
};

export type LeaderboardRow = { rank: number; name: string; xp: number; streak: number; mine: boolean };
export type LeaderboardGroup = { ageGroup: string; rows: LeaderboardRow[] };

/** "Aarav Kumar Sharma" → "Aarav S."; "Aarav" → "Aarav". */
export function leaderboardName(full: string): string {
  const parts = String(full ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Player";
  const first = parts[0].slice(0, 20);
  if (parts.length === 1) return first;
  const initial = Array.from(parts[parts.length - 1])[0]?.toUpperCase() ?? "";
  return initial ? `${first} ${initial}.` : first;
}

export const AGE_GROUPS = ["U8", "U10", "U12", "U14", "U16", "U18", "18+"] as const;

/** Age group from date of birth (age on `now`, UTC). Null without a valid dob: such a child isn't ranked. */
export function ageGroup(dob: Date | string | null | undefined, now: Date): string | null {
  if (dob == null) return null;
  const d = dob instanceof Date ? dob : new Date(dob);
  if (!Number.isFinite(d.getTime()) || d > now) return null;
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  if (now.getUTCMonth() < d.getUTCMonth() || (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())) age--;
  if (age < 3 || age > 99) return null;
  if (age >= 18) return "18+";
  const band = Math.max(8, age % 2 === 0 ? age + 2 : age + 1);
  return `U${band}`;
}

/**
 * Groups and ranks one batch. `viewerChildIds` (a parent) limits the output to the age groups their own
 * children are in, and marks their rows. Staff pass null and see every group of the batch.
 */
export function buildLeaderboard(entries: ReadonlyArray<LeaderboardEntry>, now: Date, viewerChildIds: ReadonlySet<string> | null): LeaderboardGroup[] {
  const groups = new Map<string, LeaderboardEntry[]>();
  for (const e of entries) {
    if (!e.optedIn) continue;
    const g = ageGroup(e.dob, now);
    if (!g) continue;
    groups.set(g, [...(groups.get(g) ?? []), e]);
  }
  const out: LeaderboardGroup[] = [];
  for (const g of AGE_GROUPS) {
    const list = groups.get(g);
    if (!list?.length) continue;
    if (viewerChildIds && !list.some((e) => viewerChildIds.has(e.studentId))) continue;
    const sorted = [...list].sort((a, b) => b.xp - a.xp || b.streak - a.streak || leaderboardName(a.name).localeCompare(leaderboardName(b.name)));
    let rank = 0;
    let prev: { xp: number } | null = null;
    const rows = sorted.map((e, i) => {
      if (!prev || prev.xp !== e.xp) rank = i + 1;
      prev = e;
      return {
        rank,
        name: leaderboardName(e.name),
        xp: Math.max(0, Math.trunc(e.xp)),
        streak: Math.max(0, Math.trunc(e.streak)),
        mine: viewerChildIds?.has(e.studentId) ?? false,
      };
    });
    out.push({ ageGroup: g, rows });
  }
  return out;
}
