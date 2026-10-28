/**
 * Rally-point set sports — badminton, table tennis, volleyball, squash, pickleball. Pure.
 * Tennis has its own engine (games/sets/deuce/tiebreak).
 */
export type Side = "home" | "away";
export type RallyConfig = { sport: string; pointsToWin: number; winBy: number; cap?: number; setsToWin: number; decidingSetPoints?: number };

export const RALLY_SPORTS: Record<string, RallyConfig> = {
  badminton: { sport: "Badminton", pointsToWin: 21, winBy: 2, cap: 30, setsToWin: 2 },
  table_tennis: { sport: "Table tennis", pointsToWin: 11, winBy: 2, setsToWin: 3 },
  volleyball: { sport: "Volleyball", pointsToWin: 25, winBy: 2, setsToWin: 3, decidingSetPoints: 15 },
  squash: { sport: "Squash", pointsToWin: 11, winBy: 2, setsToWin: 3 },
  pickleball: { sport: "Pickleball", pointsToWin: 11, winBy: 2, setsToWin: 2 },
};

export type RallyEvent = { type: "point"; side: Side; player?: string } | { type: "undo_hint" };
export type RallyState = { sets: Record<Side, number>[]; setsWon: Record<Side, number>; current: Record<Side, number>; winner: Side | null; pointsByPlayer: Record<string, number> };

function setTarget(cfg: RallyConfig, setIndex: number): number {
  const deciding = setIndex === cfg.setsToWin * 2 - 2;
  return deciding && cfg.decidingSetPoints ? cfg.decidingSetPoints : cfg.pointsToWin;
}

export function setWon(a: number, b: number, target: number, winBy: number, cap?: number): boolean {
  if (cap != null && a >= cap) return true;
  return a >= target && a - b >= winBy;
}

export function scoreRally(events: ReadonlyArray<RallyEvent>, cfg: RallyConfig): RallyState {
  const st: RallyState = { sets: [], setsWon: { home: 0, away: 0 }, current: { home: 0, away: 0 }, winner: null, pointsByPlayer: {} };
  for (const e of events) {
    if (st.winner || e.type !== "point") continue;
    st.current[e.side]++;
    if (e.player) st.pointsByPlayer[e.player] = (st.pointsByPlayer[e.player] ?? 0) + 1;
    const other: Side = e.side === "home" ? "away" : "home";
    const target = setTarget(cfg, st.sets.length);
    if (setWon(st.current[e.side], st.current[other], target, cfg.winBy, cfg.cap)) {
      st.sets.push({ ...st.current });
      st.setsWon[e.side]++;
      st.current = { home: 0, away: 0 };
      if (st.setsWon[e.side] >= cfg.setsToWin) st.winner = e.side;
    }
  }
  return st;
}
