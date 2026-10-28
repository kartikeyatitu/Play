/** Bouts and judged sports — karate, taekwondo, wrestling, boxing, judo. Pure. */
export type Side = "home" | "away";
export type BoutConfig = { sport: string; rounds: number; mercyLead?: number };
export const BOUT_SPORTS: Record<string, BoutConfig> = {
  karate: { sport: "Karate", rounds: 1, mercyLead: 8 },
  taekwondo: { sport: "Taekwondo", rounds: 3, mercyLead: 20 },
  wrestling: { sport: "Wrestling", rounds: 2, mercyLead: 10 },
  boxing: { sport: "Boxing", rounds: 3 },
};

export type BoutEvent =
  | { type: "score"; side: Side; points: number; technique?: string; round: number }
  | { type: "penalty"; side: Side; awardOpponent?: number; round: number }
  | { type: "judge_card"; judge: string; round: number; home: number; away: number }
  | { type: "stoppage"; winner: Side; method: "KO" | "TKO" | "RSC" | "DQ" | "pin" | "submission" | "injury" };

export type BoutState = { points: Record<Side, number>; penalties: Record<Side, number>; judges: Record<string, Record<Side, number>>; winner: Side | null; method: string | null };

export function scoreBout(events: ReadonlyArray<BoutEvent>, cfg: BoutConfig, finished = false): BoutState {
  const st: BoutState = { points: { home: 0, away: 0 }, penalties: { home: 0, away: 0 }, judges: {}, winner: null, method: null };
  for (const e of events) {
    if (st.winner) break;
    if (e.type === "score") st.points[e.side] += Math.max(0, e.points);
    else if (e.type === "penalty") {
      st.penalties[e.side]++;
      if (e.awardOpponent) st.points[e.side === "home" ? "away" : "home"] += e.awardOpponent;
    } else if (e.type === "judge_card") {
      const j = (st.judges[e.judge] ??= { home: 0, away: 0 });
      j.home += e.home;
      j.away += e.away;
    } else if (e.type === "stoppage") {
      st.winner = e.winner;
      st.method = e.method;
    }
    if (!st.winner && cfg.mercyLead != null) {
      const diff = st.points.home - st.points.away;
      if (Math.abs(diff) >= cfg.mercyLead) {
        st.winner = diff > 0 ? "home" : "away";
        st.method = "Point gap";
      }
    }
  }
  if (!st.winner && finished) {
    const judges = Object.values(st.judges);
    if (judges.length > 0) {
      const homeCards = judges.filter((j) => j.home > j.away).length;
      const awayCards = judges.filter((j) => j.away > j.home).length;
      if (homeCards !== awayCards) {
        st.winner = homeCards > awayCards ? "home" : "away";
        st.method = `Decision ${Math.max(homeCards, awayCards)}–${Math.min(homeCards, awayCards)}`;
      }
    } else if (st.points.home !== st.points.away) {
      st.winner = st.points.home > st.points.away ? "home" : "away";
      st.method = "Points";
    }
  }
  return st;
}
