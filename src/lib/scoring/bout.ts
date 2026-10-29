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
  /** `deduct`: points taken off the penalised side (boxing: off every judge's card for that boxer). */
  | { type: "penalty"; side: Side; awardOpponent?: number; deduct?: number; round: number }
  | { type: "judge_card"; judge: string; round: number; home: number; away: number }
  | { type: "stoppage"; winner: Side; method: "KO" | "TKO" | "RSC" | "DQ" | "pin" | "submission" | "injury" };

export type BoutState = {
  points: Record<Side, number>;
  penalties: Record<Side, number>;
  /** Points deducted from each side by penalties. */
  deductions: Record<Side, number>;
  /** Each judge's running total, before deductions. */
  judges: Record<string, Record<Side, number>>;
  winner: Side | null;
  method: string | null;
};

/** A judge's totals with the referee's deductions taken off (never below zero). */
export function judgeTotals(st: Pick<BoutState, "judges" | "deductions">): Record<string, Record<Side, number>> {
  return Object.fromEntries(
    Object.entries(st.judges).map(([j, s]) => [j, { home: Math.max(0, s.home - st.deductions.home), away: Math.max(0, s.away - st.deductions.away) }]),
  );
}

export function scoreBout(events: ReadonlyArray<BoutEvent>, cfg: BoutConfig, finished = false): BoutState {
  const st: BoutState = { points: { home: 0, away: 0 }, penalties: { home: 0, away: 0 }, deductions: { home: 0, away: 0 }, judges: {}, winner: null, method: null };
  // Judges are keyed by a typed name, so a Map keeps names like "__proto__" from touching Object.prototype.
  const judges = new Map<string, Record<Side, number>>();
  const deducted = () => ({ home: Math.max(0, st.points.home - st.deductions.home), away: Math.max(0, st.points.away - st.deductions.away) });
  for (const e of events) {
    if (st.winner) break;
    if (e.type === "score") st.points[e.side] += Math.max(0, e.points);
    else if (e.type === "penalty") {
      st.penalties[e.side]++;
      if (e.awardOpponent) st.points[e.side === "home" ? "away" : "home"] += e.awardOpponent;
      if (e.deduct) st.deductions[e.side] += Math.max(0, e.deduct);
    } else if (e.type === "judge_card") {
      let j = judges.get(e.judge);
      if (!j) judges.set(e.judge, (j = { home: 0, away: 0 }));
      j.home += e.home;
      j.away += e.away;
    } else if (e.type === "stoppage") {
      st.winner = e.winner;
      st.method = e.method;
    }
    if (!st.winner && cfg.mercyLead != null) {
      const p = deducted();
      const diff = p.home - p.away;
      if (Math.abs(diff) >= cfg.mercyLead) {
        st.winner = diff > 0 ? "home" : "away";
        st.method = "Point gap";
      }
    }
  }
  st.judges = Object.fromEntries(judges);
  if (!st.winner && finished) {
    const cards = Object.values(judgeTotals(st));
    const pts = deducted();
    if (cards.length > 0) {
      const homeCards = cards.filter((j) => j.home > j.away).length;
      const awayCards = cards.filter((j) => j.away > j.home).length;
      if (homeCards !== awayCards) {
        st.winner = homeCards > awayCards ? "home" : "away";
        st.method = `Decision ${Math.max(homeCards, awayCards)}–${Math.min(homeCards, awayCards)}`;
      }
    } else if (pts.home !== pts.away) {
      st.winner = pts.home > pts.away ? "home" : "away";
      st.method = "Points";
    }
  }
  return st;
}
