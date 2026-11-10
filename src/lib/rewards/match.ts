/**
 * What a finished match earns one academy athlete, worked out from their stored stat line
 * (AthleteMatchStat.stats). Pure, so it can be tested without a database.
 */
import type { BadgeTag } from "./badges";

type Line = Record<string, unknown> | null | undefined;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : null);

export function matchRewardFor(stats: Line, sport?: string | null): { played: boolean; won: boolean; tags: BadgeTag[] } {
  if (!stats) return { played: false, won: false, tags: [] };
  const tags: BadgeTag[] = [];
  const won = stats.result === "W";

  if (stats.family === "goals") {
    // Clean sheet: the team let nothing in. Only meaningful in low-scoring sports, where 0 against is a real feat.
    if (stats.teamAgainst === 0 && (!sport || CLEAN_SHEET_SPORTS.has(sport))) tags.push("CLEAN_SHEET");
    if (num(stats.points) > 0 && num(stats.assists) > 0) tags.push("ALL_ROUND");
  }

  if (stats.family === "cricket") {
    const bat = obj(stats.batting);
    const bowl = obj(stats.bowling);
    const parts = [
      num(bat?.runs) >= 10,
      num(bowl?.wickets) >= 1,
      num(stats.catches) + num(stats.runOuts) + num(stats.stumpings) >= 1,
    ].filter(Boolean).length;
    if (parts >= 2) tags.push("ALL_ROUND");
  }

  return { played: true, won, tags };
}

/** Sports where a clean sheet is a real achievement (not basketball, where 0 against never happens). */
export const CLEAN_SHEET_SPORTS = new Set(["football", "futsal", "hockey", "handball"]);
