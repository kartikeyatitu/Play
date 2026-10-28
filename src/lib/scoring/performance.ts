/**
 * Timed and measured events — swimming, athletics (track and field), skating, cycling. Pure.
 * Results are stored in base units: time in milliseconds, distance/height in centimetres.
 */
export type MeasureKind = "time" | "distance" | "height" | "points";
export type PerfResult = { athlete: string; value: number | null; status?: "OK" | "DNS" | "DNF" | "DQ"; attempt?: number };
export type RankedResult = { athlete: string; best: number | null; rank: number | null; status: "OK" | "DNS" | "DNF" | "DQ" };

/** Lower is better for time; higher for distance, height and points. */
export function betterIsLower(kind: MeasureKind): boolean {
  return kind === "time";
}

/** Best valid mark per athlete (field events have several attempts), then rank with ties sharing a place. */
export function rankResults(results: ReadonlyArray<PerfResult>, kind: MeasureKind): RankedResult[] {
  const lower = betterIsLower(kind);
  const by = new Map<string, { best: number | null; status: RankedResult["status"] }>();
  for (const r of results) {
    const cur = by.get(r.athlete) ?? { best: null, status: (r.status ?? "OK") as RankedResult["status"] };
    if ((r.status ?? "OK") === "OK" && r.value != null && Number.isFinite(r.value)) {
      if (cur.best == null || (lower ? r.value < cur.best : r.value > cur.best)) cur.best = r.value;
      cur.status = "OK";
    } else if (cur.best == null) {
      cur.status = (r.status ?? "OK") as RankedResult["status"];
    }
    by.set(r.athlete, cur);
  }
  const valid = [...by.entries()].filter(([, v]) => v.best != null).sort((a, b) => (lower ? a[1].best! - b[1].best! : b[1].best! - a[1].best!));
  const out: RankedResult[] = [];
  let lastBest: number | null = null;
  let lastRank = 0;
  valid.forEach(([athlete, v], i) => {
    const rank = v.best === lastBest ? lastRank : i + 1;
    lastBest = v.best;
    lastRank = rank;
    out.push({ athlete, best: v.best, rank, status: "OK" });
  });
  for (const [athlete, v] of by) if (v.best == null) out.push({ athlete, best: null, rank: null, status: v.status === "OK" ? "DNS" : v.status });
  return out;
}

/** True when `value` beats the athlete's previous best (personal best). */
export function isPersonalBest(value: number, previousBest: number | null, kind: MeasureKind): boolean {
  if (previousBest == null) return true;
  return betterIsLower(kind) ? value < previousBest : value > previousBest;
}

/** 63450 → "1:03.45"; 9580 → "9.58". */
export function formatTime(ms: number): string {
  const totalCs = Math.round(ms / 10);
  const cs = totalCs % 100;
  const totalS = Math.floor(totalCs / 100);
  const s = totalS % 60;
  const m = Math.floor(totalS / 60);
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}` : `${s}.${String(cs).padStart(2, "0")}`;
}

/** 645 cm → "6.45 m". */
export function formatDistance(cm: number): string {
  return `${(cm / 100).toFixed(2)} m`;
}
