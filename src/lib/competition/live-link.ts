// Maps a competition's free-text sport to a live-scoring sport. Pure, client-safe.
import { LIVE_SPORTS, type LiveSportDef } from "@/lib/live-match";

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, "_");

/** Head-to-head live sports (performance events like athletics have no home and away). */
export function headToHeadLiveSports(): LiveSportDef[] {
  return LIVE_SPORTS.filter((s) => s.family !== "performance");
}

/** The live sport key for a competition's sport text ("Table Tennis" → "table_tennis"), or null. */
export function liveSportKeyFor(sport: string | null | undefined): string | null {
  if (!sport) return null;
  const n = norm(sport);
  const hit = headToHeadLiveSports().find((s) => s.key === n || norm(s.label) === n);
  return hit?.key ?? null;
}
