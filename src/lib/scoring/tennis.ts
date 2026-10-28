/** Tennis — points, games, sets, deuce (or no-ad) and tiebreaks. Pure. */
export type Side = "home" | "away";
export type TennisConfig = { setsToWin: number; gamesPerSet: number; tiebreakAt: number; tiebreakPoints: number; noAd?: boolean; finalSetTiebreak?: boolean };
export const TENNIS_DEFAULT: TennisConfig = { setsToWin: 2, gamesPerSet: 6, tiebreakAt: 6, tiebreakPoints: 7, finalSetTiebreak: true };

export type TennisEvent = { type: "point"; side: Side };
export type TennisState = { sets: Record<Side, number>[]; setsWon: Record<Side, number>; games: Record<Side, number>; points: Record<Side, number>; tiebreak: boolean; winner: Side | null; display: string };

const CALL = ["0", "15", "30", "40"];
const opp = (s: Side): Side => (s === "home" ? "away" : "home");

export function scoreTennis(events: ReadonlyArray<TennisEvent>, cfg: TennisConfig = TENNIS_DEFAULT): TennisState {
  const st: TennisState = { sets: [], setsWon: { home: 0, away: 0 }, games: { home: 0, away: 0 }, points: { home: 0, away: 0 }, tiebreak: false, winner: null, display: "0–0" };
  const winGame = (s: Side) => {
    st.games[s]++;
    st.points = { home: 0, away: 0 };
    const finalSet = st.sets.length === cfg.setsToWin * 2 - 2;
    const g = st.games[s];
    const o = st.games[opp(s)];
    if ((g >= cfg.gamesPerSet && g - o >= 2) || (st.tiebreak && g > o)) {
      st.sets.push({ ...st.games });
      st.setsWon[s]++;
      st.games = { home: 0, away: 0 };
      st.tiebreak = false;
      if (st.setsWon[s] >= cfg.setsToWin) st.winner = s;
    } else if (st.games.home === cfg.tiebreakAt && st.games.away === cfg.tiebreakAt && (!finalSet || cfg.finalSetTiebreak !== false)) {
      st.tiebreak = true;
    }
  };
  for (const e of events) {
    if (st.winner) break;
    const s = e.side;
    const o = opp(s);
    st.points[s]++;
    if (st.tiebreak) {
      if (st.points[s] >= cfg.tiebreakPoints && st.points[s] - st.points[o] >= 2) winGame(s);
      continue;
    }
    if (cfg.noAd) {
      if (st.points[s] >= 4) winGame(s);
    } else if (st.points[s] >= 4 && st.points[s] - st.points[o] >= 2) {
      winGame(s);
    }
  }
  const p = st.points;
  if (st.tiebreak) st.display = `${p.home}–${p.away} (tiebreak)`;
  else if (p.home >= 3 && p.away >= 3 && !cfg.noAd) st.display = p.home === p.away ? "Deuce" : `Advantage ${p.home > p.away ? "home" : "away"}`;
  else st.display = `${CALL[Math.min(p.home, 3)]}–${CALL[Math.min(p.away, 3)]}`;
  return st;
}
