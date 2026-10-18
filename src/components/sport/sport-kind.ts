/** Map free-text sport names ("U-14 Cricket", "Badminton", "Swim") to an illustration kind. */
export type SportKind = "badminton" | "cricket" | "football" | "tennis" | "swimming" | "basketball" | "multi";

export const SPORT_KINDS: SportKind[] = ["badminton", "cricket", "football", "tennis", "swimming", "basketball", "multi"];

export function sportKind(input?: string | null): SportKind {
  const s = (input || "").toLowerCase();
  if (!s) return "multi";
  if (s.includes("badminton") || s.includes("shuttle")) return "badminton";
  if (s.includes("cricket")) return "cricket";
  if (s.includes("basket")) return "basketball";
  if (s.includes("table tennis") || s.includes("ping")) return "multi";
  if (s.includes("tennis") || s.includes("pickle")) return "tennis";
  if (s.includes("foot") || s.includes("soccer") || s.includes("futsal")) return "football";
  if (s.includes("swim") || s.includes("aqua")) return "swimming";
  return "multi";
}

/** The academy's main sport: explicit org sport, else the most common batch sport. */
export function primarySport(orgSport: string | null | undefined, batches: { sport?: string | null }[] = []): SportKind {
  const fromOrg = sportKind(orgSport);
  if (fromOrg !== "multi") return fromOrg;
  const counts = new Map<SportKind, number>();
  for (const b of batches) {
    const k = sportKind(b.sport);
    if (k !== "multi") counts.set(k, (counts.get(k) || 0) + 1);
  }
  if (counts.size === 0) return "multi";
  if (counts.size > 1) {
    // Several sports with no clear leader reads as a multi-sport academy
    const sorted = [...counts.values()].sort((a, b) => b - a);
    if (sorted[0] === sorted[1]) return "multi";
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
