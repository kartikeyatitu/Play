/**
 * Goals / points in timed periods — football, hockey, futsal, handball, basketball, kabaddi. Pure.
 * A sport is a config: its periods and what each scoring event is worth.
 */
export type Side = "home" | "away";
export type GoalsConfig = {
  sport: string;
  periods: number;
  periodLabel: string; // "Half", "Quarter"
  scoreTypes: Record<string, number>; // e.g. { goal: 1 } or { "3pt": 3, "2pt": 2, ft: 1 }
  /** Score types credited to the opponent (e.g. own goal). */
  creditOpponent?: string[];
  /** Minutes per period (senior default; academies often play shorter). Used for the match clock. */
  periodMinutes?: number;
};

export const GOALS_SPORTS: Record<string, GoalsConfig> = {
  football: { sport: "Football", periods: 2, periodLabel: "Half", scoreTypes: { goal: 1, penalty: 1, own_goal: 1 }, creditOpponent: ["own_goal"], periodMinutes: 45 },
  futsal: { sport: "Futsal", periods: 2, periodLabel: "Half", scoreTypes: { goal: 1, penalty: 1, own_goal: 1 }, creditOpponent: ["own_goal"], periodMinutes: 20 },
  hockey: { sport: "Hockey", periods: 4, periodLabel: "Quarter", scoreTypes: { field_goal: 1, penalty_corner: 1, penalty_stroke: 1 }, periodMinutes: 15 },
  handball: { sport: "Handball", periods: 2, periodLabel: "Half", scoreTypes: { goal: 1, seven_metre: 1 }, periodMinutes: 30 },
  basketball: { sport: "Basketball", periods: 4, periodLabel: "Quarter", scoreTypes: { "3pt": 3, "2pt": 2, ft: 1 }, periodMinutes: 10 },
  kabaddi: { sport: "Kabaddi", periods: 2, periodLabel: "Half", scoreTypes: { raid_touch: 1, bonus: 1, tackle: 1, super_tackle: 2, all_out: 2 }, periodMinutes: 20 },
};

export type GoalsEvent =
  | { type: "period_start"; period: number }
  | { type: "period_end"; period: number }
  | { type: "score"; side: Side; kind: string; player?: string; assist?: string; minute?: number }
  | { type: "card"; side: Side; colour: "yellow" | "red" | "green"; player: string; minute?: number }
  | { type: "foul"; side: Side; player?: string; minute?: number }
  | { type: "sub"; side: Side; playerIn: string; playerOut: string; minute?: number };

export type PlayerLine = { player: string; side: Side; points: number; scores: Record<string, number>; assists: number; yellow: number; red: number; fouls: number };
export type GoalsState = {
  score: Record<Side, number>;
  byPeriod: Record<Side, number>[];
  period: number;
  live: boolean;
  finished: boolean;
  players: PlayerLine[];
  timeline: { minute?: number; text: string }[];
  winner: Side | "draw" | null;
};

/** Points for a score kind, read only from the config's own keys ("constructor" or "__proto__" never match). */
export function scoreValue(config: GoalsConfig, kind: string): number | null {
  if (typeof kind !== "string" || !Object.hasOwn(config.scoreTypes, kind)) return null;
  const v = config.scoreTypes[kind];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function scoreGoals(events: ReadonlyArray<GoalsEvent>, config: GoalsConfig): GoalsState {
  // Null-prototype copy of the score table, so a lookup can never reach Object.prototype.
  const table: Record<string, number> = Object.create(null);
  for (const k of Object.keys(config.scoreTypes)) {
    const v = scoreValue(config, k);
    if (v != null) table[k] = v;
  }
  const st: GoalsState = { score: { home: 0, away: 0 }, byPeriod: [], period: 0, live: false, finished: false, players: [], timeline: [], winner: null };
  const p = (player: string, side: Side) => {
    let l = st.players.find((x) => x.player === player && x.side === side);
    if (!l) {
      l = { player, side, points: 0, scores: {}, assists: 0, yellow: 0, red: 0, fouls: 0 };
      st.players.push(l);
    }
    return l;
  };
  const per = () => {
    while (st.byPeriod.length < Math.max(1, st.period)) st.byPeriod.push({ home: 0, away: 0 });
    return st.byPeriod[Math.max(1, st.period) - 1];
  };
  for (const e of events) {
    if (e.type === "period_start") {
      st.period = e.period;
      st.live = true;
      per();
      st.timeline.push({ text: `${config.periodLabel} ${e.period} started` });
    } else if (e.type === "period_end") {
      st.live = false;
      st.timeline.push({ text: `${config.periodLabel} ${e.period} ended` });
      if (e.period >= config.periods) st.finished = true;
    } else if (e.type === "score") {
      const value = Object.hasOwn(table, e.kind) ? table[e.kind] : undefined;
      if (typeof value !== "number") continue;
      const credited: Side = config.creditOpponent?.includes(e.kind) ? (e.side === "home" ? "away" : "home") : e.side;
      st.score[credited] += value;
      per()[credited] += value;
      if (e.player && !config.creditOpponent?.includes(e.kind)) {
        const l = p(e.player, e.side);
        l.points += value;
        l.scores[e.kind] = (Object.hasOwn(l.scores, e.kind) ? l.scores[e.kind] : 0) + 1;
      }
      if (e.assist) p(e.assist, e.side).assists++;
      st.timeline.push({ minute: e.minute, text: `${e.kind.replace(/_/g, " ")}${e.player ? ` – ${e.player}` : ""} (${e.side})` });
    } else if (e.type === "card") {
      const l = p(e.player, e.side);
      if (e.colour === "yellow") l.yellow++;
      if (e.colour === "red") l.red++;
      st.timeline.push({ minute: e.minute, text: `${e.colour} card – ${e.player}` });
    } else if (e.type === "foul") {
      if (e.player) p(e.player, e.side).fouls++;
    } else if (e.type === "sub") {
      st.timeline.push({ minute: e.minute, text: `Sub: ${e.playerIn} on for ${e.playerOut}` });
    }
  }
  if (st.finished) st.winner = st.score.home > st.score.away ? "home" : st.score.away > st.score.home ? "away" : "draw";
  return st;
}
