/**
 * Live scoring glue (docs/specs/live-scoring.md). Pure: no database, no React.
 *
 * A live match is an append-only event log. The current state is always the family engine's replay of
 * the non-voided events, so undo is "void the last event and replay" and two devices can never disagree
 * about the score. This file decides which sports are live-scorable, builds and clamps their config,
 * validates incoming events, replays them and turns state into what screens and stats need.
 *
 * Families: rally (badminton, table tennis, volleyball, squash, pickleball), tennis, cricket, goals
 * (football, futsal, hockey, handball, basketball, kabaddi), bout (karate, taekwondo, wrestling, boxing),
 * performance (athletics, swimming, skating, cycling: times and marks) and chess.
 *
 * Players inside events are referred to by display name; names are unique within a match, and the
 * match's player list maps names back to academy students when stats are written.
 */
import { RALLY_SPORTS, scoreRally, type RallyConfig, type RallyEvent, type RallyState } from "@/lib/scoring/rally";
import { scoreTennis, TENNIS_DEFAULT, type TennisConfig, type TennisState } from "@/lib/scoring/tennis";
import {
  oversText,
  requiredRunRate,
  runRate,
  scoreCricket,
  type CricketConfig,
  type CricketEvent,
  type CricketState,
  type ExtraKind,
  type WicketKind,
} from "@/lib/scoring/cricket";
import { GOALS_SPORTS, scoreGoals, type GoalsConfig, type GoalsEvent, type GoalsState } from "@/lib/scoring/goals";
import { BOUT_SPORTS, scoreBout, type BoutConfig, type BoutEvent, type BoutState } from "@/lib/scoring/bout";
import { formatDistance, formatTime, rankResults, type MeasureKind, type RankedResult } from "@/lib/scoring/performance";
import type { ChessResult } from "@/lib/scoring/chess";

export type LiveSide = "home" | "away";
export type LiveFamily = "rally" | "tennis" | "cricket" | "goals" | "bout" | "performance" | "chess";
export type LiveStatus = "SCHEDULED" | "LIVE" | "COMPLETED" | "ABANDONED";
export type LiveVisibility = "PRIVATE" | "ACADEMY" | "LINK";

export type LiveSportDef = {
  key: string;
  label: string;
  family: LiveFamily;
  /** What a "period" is called: game, set, innings, half, quarter, round. */
  unit: string;
  /** Most players per side the create form allows (performance: athletes in the event). */
  maxPerSide: number;
};

export const LIVE_SPORTS: LiveSportDef[] = [
  { key: "cricket", label: "Cricket", family: "cricket", unit: "innings", maxPerSide: 15 },
  { key: "football", label: "Football", family: "goals", unit: "half", maxPerSide: 18 },
  { key: "futsal", label: "Futsal", family: "goals", unit: "half", maxPerSide: 12 },
  { key: "basketball", label: "Basketball", family: "goals", unit: "quarter", maxPerSide: 12 },
  { key: "hockey", label: "Hockey", family: "goals", unit: "quarter", maxPerSide: 18 },
  { key: "kabaddi", label: "Kabaddi", family: "goals", unit: "half", maxPerSide: 12 },
  { key: "handball", label: "Handball", family: "goals", unit: "half", maxPerSide: 16 },
  { key: "badminton", label: "Badminton", family: "rally", unit: "game", maxPerSide: 2 },
  { key: "table_tennis", label: "Table tennis", family: "rally", unit: "game", maxPerSide: 2 },
  { key: "volleyball", label: "Volleyball", family: "rally", unit: "set", maxPerSide: 12 },
  { key: "squash", label: "Squash", family: "rally", unit: "game", maxPerSide: 1 },
  { key: "pickleball", label: "Pickleball", family: "rally", unit: "game", maxPerSide: 2 },
  { key: "tennis", label: "Tennis", family: "tennis", unit: "set", maxPerSide: 2 },
  { key: "karate", label: "Karate", family: "bout", unit: "round", maxPerSide: 1 },
  { key: "taekwondo", label: "Taekwondo", family: "bout", unit: "round", maxPerSide: 1 },
  { key: "wrestling", label: "Wrestling", family: "bout", unit: "period", maxPerSide: 1 },
  { key: "boxing", label: "Boxing", family: "bout", unit: "round", maxPerSide: 1 },
  { key: "athletics", label: "Athletics", family: "performance", unit: "event", maxPerSide: 40 },
  { key: "swimming", label: "Swimming", family: "performance", unit: "event", maxPerSide: 40 },
  { key: "skating", label: "Skating", family: "performance", unit: "event", maxPerSide: 40 },
  { key: "cycling", label: "Cycling", family: "performance", unit: "event", maxPerSide: 40 },
  { key: "chess", label: "Chess", family: "chess", unit: "game", maxPerSide: 1 },
];

export function liveSport(key: string): LiveSportDef | null {
  return LIVE_SPORTS.find((s) => s.key === key) ?? null;
}

/** True for families where the match has an opponent side (everything except performance events). */
export function hasOpponent(family: LiveFamily): boolean {
  return family !== "performance";
}

// ── Config ───────────────────────────────────────────────────────────────────

export type CricketLiveConfig = CricketConfig & { battingFirst: LiveSide };
export type PerformanceConfig = { eventName: string; measure: MeasureKind; attempts: number };
export type ChessConfig = { rated: boolean };
export type LiveConfig = RallyConfig | TennisConfig | CricketLiveConfig | GoalsConfig | BoutConfig | PerformanceConfig | ChessConfig;

/** "Best of" choices offered for rally sports and tennis. */
export const BEST_OF = [1, 3, 5] as const;
/** Overs presets offered for cricket (custom 1–50 allowed). */
export const OVERS_PRESETS = [5, 10, 20] as const;
export const MEASURES: { key: MeasureKind; label: string; hint: string }[] = [
  { key: "time", label: "Time", hint: "Lower is better: races, swims, laps" },
  { key: "distance", label: "Distance", hint: "Higher is better: jumps and throws" },
  { key: "height", label: "Height", hint: "Higher is better: high jump, pole vault" },
  { key: "points", label: "Points", hint: "Higher is better: judged events" },
];

export type LiveOptions = {
  bestOf?: number;
  overs?: number;
  battingFirst?: LiveSide;
  periodMinutes?: number;
  eventName?: string;
  measure?: MeasureKind;
  attempts?: number;
};

const int = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : undefined;

/** Default config for a sport, with options from the create form (each clamped to a sensible range). */
export function buildLiveConfig(sportKey: string, options?: number | LiveOptions): LiveConfig | null {
  const def = liveSport(sportKey);
  if (!def) return null;
  const o: LiveOptions = typeof options === "number" ? { bestOf: options } : options ?? {};
  switch (def.family) {
    case "rally":
    case "tennis": {
      const setsToWin = o.bestOf && (BEST_OF as readonly number[]).includes(o.bestOf) ? (o.bestOf + 1) / 2 : undefined;
      const base = def.family === "tennis" ? TENNIS_DEFAULT : RALLY_SPORTS[sportKey];
      return { ...base, ...(setsToWin ? { setsToWin } : {}) };
    }
    case "cricket":
      return {
        oversPerInnings: int(o.overs, 1, 50) ?? 20,
        ballsPerOver: 6,
        wicketsPerInnings: 10,
        extraPenalty: 1,
        innings: 2,
        battingFirst: o.battingFirst === "away" ? "away" : "home",
      };
    case "goals": {
      const base = GOALS_SPORTS[sportKey];
      return { ...base, periodMinutes: int(o.periodMinutes, 1, 60) ?? base.periodMinutes };
    }
    case "bout":
      return { ...BOUT_SPORTS[sportKey] };
    case "performance": {
      const measure = MEASURES.some((m) => m.key === o.measure) ? (o.measure as MeasureKind) : "time";
      const eventName = (typeof o.eventName === "string" ? o.eventName.trim().slice(0, 60) : "") || defaultEventName(sportKey);
      return { eventName, measure, attempts: int(o.attempts, 1, 6) ?? (measure === "time" ? 1 : 3) };
    }
    case "chess":
      return { rated: false };
  }
}

function defaultEventName(sportKey: string): string {
  return sportKey === "swimming" ? "50m freestyle" : sportKey === "athletics" ? "100m" : sportKey === "skating" ? "500m" : "Time trial";
}

/**
 * Reads a stored config back. Numbers, booleans and a few known strings may come from storage; anything
 * missing or malformed falls back to the sport default. Score tables (goals) always come from code.
 */
export function readLiveConfig(sportKey: string, stored: unknown): LiveConfig | null {
  const base = buildLiveConfig(sportKey);
  if (!base) return null;
  const s = stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(base)) {
    const sv = s[k];
    if (typeof v === "number" && typeof sv === "number" && Number.isInteger(sv) && sv > 0 && sv <= 99) out[k] = sv;
    if (typeof v === "boolean" && typeof sv === "boolean") out[k] = sv;
  }
  if (s.battingFirst === "home" || s.battingFirst === "away") if ("battingFirst" in out) out.battingFirst = s.battingFirst;
  if ("eventName" in out && typeof s.eventName === "string" && s.eventName.trim()) out.eventName = s.eventName.trim().slice(0, 60);
  if ("measure" in out && MEASURES.some((m) => m.key === s.measure)) out.measure = s.measure;
  return out as LiveConfig;
}

// ── Events ───────────────────────────────────────────────────────────────────

export type PointEvent = { type: "point"; side: LiveSide; player?: string };
export type PerformanceEvent = { type: "result"; athlete: string; value: number | null; status: "OK" | "DNS" | "DNF" | "DQ"; attempt?: number };
export type ChessEvent = { type: "result"; result: ChessResult; moves?: number };
export type LiveEvent = PointEvent | CricketEvent | GoalsEvent | BoutEvent | PerformanceEvent | ChessEvent;

type Parsed = { ok: true; event: LiveEvent } | { ok: false; error: string };

const isSide = (v: unknown): v is LiveSide => v === "home" || v === "away";
const name = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim().replace(/\s+/g, " ");
  return t.length > 0 && t.length <= 60 ? t : undefined;
};
const EXTRAS: ExtraKind[] = ["wide", "noball", "bye", "legbye"];
const WICKETS: WicketKind[] = ["bowled", "caught", "lbw", "stumped", "runout", "hitwicket", "retired", "obstructing"];
const STOPPAGES = ["KO", "TKO", "RSC", "DQ", "pin", "submission", "injury"] as const;
const PERF_STATUS = ["OK", "DNS", "DNF", "DQ"] as const;
const CHESS_RESULTS: ChessResult[] = ["1-0", "0-1", "1/2-1/2"];

/** Validates an event from a client for the match's family. Only the fields the engines read survive. */
export function parseLiveEvent(family: LiveFamily, raw: unknown, config?: LiveConfig | null): Parsed {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Missing event" };
  const r = raw as Record<string, unknown>;
  const bad = (error: string): Parsed => ({ ok: false, error });

  switch (family) {
    case "rally":
    case "tennis": {
      if (r.type !== "point") return bad("Unknown event");
      if (!isSide(r.side)) return bad("Pick a side");
      const ev: PointEvent = { type: "point", side: r.side };
      const p = name(r.player);
      if (family === "rally" && p) ev.player = p;
      return { ok: true, event: ev };
    }
    case "cricket": {
      if (r.type === "end_innings") return { ok: true, event: { type: "end_innings", ...(r.reason === "declared" ? { reason: "declared" as const } : {}) } };
      if (r.type !== "ball") return bad("Unknown event");
      const striker = name(r.striker);
      const nonStriker = name(r.nonStriker);
      const bowler = name(r.bowler);
      if (!striker || !nonStriker) return bad("Pick both batters");
      if (striker === nonStriker) return bad("The two batters must be different");
      if (!bowler) return bad("Pick the bowler");
      const runs = int(r.runs, 0, 7);
      if (runs == null) return bad("Runs must be 0 to 7");
      const ev: CricketEvent = { type: "ball", striker, nonStriker, bowler, runs };
      if (r.extra != null) {
        const x = r.extra as Record<string, unknown>;
        if (!EXTRAS.includes(x.kind as ExtraKind)) return bad("Unknown extra");
        const xr = x.runs == null ? 0 : int(x.runs, 0, 7);
        if (xr == null) return bad("Extra runs must be 0 to 7");
        ev.extra = { kind: x.kind as ExtraKind, runs: xr };
        if (ev.extra.kind === "wide" || ev.extra.kind === "bye" || ev.extra.kind === "legbye") ev.runs = 0;
      }
      if (r.wicket != null) {
        const w = r.wicket as Record<string, unknown>;
        if (!WICKETS.includes(w.kind as WicketKind)) return bad("Pick how they got out");
        const out = name(w.playerOut);
        if (!out || (out !== striker && out !== nonStriker)) return bad("The batter out must be one of the two at the crease");
        const kind = w.kind as WicketKind;
        if (ev.extra?.kind === "wide" && !["stumped", "runout", "hitwicket", "obstructing", "retired"].includes(kind)) return bad("Only stumped, run out or hit wicket off a wide");
        if (ev.extra?.kind === "noball" && !["runout", "obstructing", "retired"].includes(kind)) return bad("Only run out off a no-ball");
        ev.wicket = { kind, playerOut: out };
        const f = name(w.fielder);
        if (f && (kind === "caught" || kind === "runout" || kind === "stumped")) ev.wicket.fielder = f;
      }
      return { ok: true, event: ev };
    }
    case "goals": {
      const cfg = config as GoalsConfig | undefined;
      const minute = int(r.minute, 0, 200);
      const withMinute = <T extends object>(e: T): T => (minute != null ? { ...e, minute } : e);
      if (r.type === "period_start" || r.type === "period_end") {
        const period = int(r.period, 1, 12);
        if (period == null || (cfg && period > cfg.periods + 2)) return bad("Unknown period");
        return { ok: true, event: { type: r.type, period } };
      }
      if (!isSide(r.side)) return bad("Pick a team");
      if (r.type === "score") {
        if (typeof r.kind !== "string" || (cfg && !(r.kind in cfg.scoreTypes))) return bad("Unknown score type");
        const ev: GoalsEvent = { type: "score", side: r.side, kind: r.kind };
        const p = name(r.player);
        const a = name(r.assist);
        if (p) ev.player = p;
        if (a && a !== p) ev.assist = a;
        return { ok: true, event: withMinute(ev) };
      }
      if (r.type === "card") {
        if (r.colour !== "yellow" && r.colour !== "red" && r.colour !== "green") return bad("Pick a card");
        const p = name(r.player);
        if (!p) return bad("Pick the player");
        return { ok: true, event: withMinute({ type: "card", side: r.side, colour: r.colour, player: p }) };
      }
      if (r.type === "foul") {
        const p = name(r.player);
        return { ok: true, event: withMinute({ type: "foul", side: r.side, ...(p ? { player: p } : {}) }) };
      }
      if (r.type === "sub") {
        const pin = name(r.playerIn);
        const pout = name(r.playerOut);
        if (!pin || !pout || pin === pout) return bad("Pick who comes on and who goes off");
        return { ok: true, event: withMinute({ type: "sub", side: r.side, playerIn: pin, playerOut: pout }) };
      }
      return bad("Unknown event");
    }
    case "bout": {
      const round = int(r.round, 1, 12) ?? 1;
      if (r.type === "score") {
        if (!isSide(r.side)) return bad("Pick a corner");
        const points = int(r.points, 1, 10);
        if (points == null) return bad("Points must be 1 to 10");
        const t = name(r.technique);
        return { ok: true, event: { type: "score", side: r.side, points, round, ...(t ? { technique: t } : {}) } };
      }
      if (r.type === "penalty") {
        if (!isSide(r.side)) return bad("Pick a corner");
        const award = r.awardOpponent == null ? 0 : int(r.awardOpponent, 0, 5);
        if (award == null) return bad("Award must be 0 to 5");
        return { ok: true, event: { type: "penalty", side: r.side, round, ...(award ? { awardOpponent: award } : {}) } };
      }
      if (r.type === "judge_card") {
        const judge = name(r.judge);
        const h = int(r.home, 0, 10);
        const a = int(r.away, 0, 10);
        if (!judge || h == null || a == null) return bad("Enter the judge and both scores");
        return { ok: true, event: { type: "judge_card", judge, round, home: h, away: a } };
      }
      if (r.type === "stoppage") {
        if (!isSide(r.winner)) return bad("Pick the winner");
        if (!STOPPAGES.includes(r.method as (typeof STOPPAGES)[number])) return bad("Pick how it ended");
        return { ok: true, event: { type: "stoppage", winner: r.winner, method: r.method as (typeof STOPPAGES)[number] } };
      }
      return bad("Unknown event");
    }
    case "performance": {
      if (r.type !== "result") return bad("Unknown event");
      const athlete = name(r.athlete);
      if (!athlete) return bad("Pick the athlete");
      const status = PERF_STATUS.includes(r.status as (typeof PERF_STATUS)[number]) ? (r.status as PerformanceEvent["status"]) : "OK";
      const value = status === "OK" ? int(r.value, 1, 1_000_000_000) : null;
      if (status === "OK" && value == null) return bad("Enter a valid mark");
      const attempt = int(r.attempt, 1, 6);
      return { ok: true, event: { type: "result", athlete, value: value ?? null, status, ...(attempt ? { attempt } : {}) } };
    }
    case "chess": {
      if (r.type !== "result" || !CHESS_RESULTS.includes(r.result as ChessResult)) return bad("Pick the result");
      const moves = int(r.moves, 1, 500);
      return { ok: true, event: { type: "result", result: r.result as ChessResult, ...(moves ? { moves } : {}) } };
    }
  }
}

/** Renames every player reference in an event (used for first-name-plus-initial on public links). */
export function renameInEvent(e: LiveEvent, rename: (n: string) => string): LiveEvent {
  const x: Record<string, unknown> = { ...e };
  for (const k of ["player", "assist", "striker", "nonStriker", "bowler", "playerIn", "playerOut", "athlete"]) {
    if (typeof x[k] === "string") x[k] = rename(x[k] as string);
  }
  if (x.wicket && typeof x.wicket === "object") {
    const w = { ...(x.wicket as Record<string, unknown>) };
    if (typeof w.playerOut === "string") w.playerOut = rename(w.playerOut);
    if (typeof w.fielder === "string") w.fielder = rename(w.fielder);
    x.wicket = w;
  }
  return x as LiveEvent;
}

// ── Replay ───────────────────────────────────────────────────────────────────

export type LiveState =
  | { family: "rally"; rally: RallyState }
  | { family: "tennis"; tennis: TennisState }
  | { family: "cricket"; cricket: CricketState }
  | { family: "goals"; goals: GoalsState }
  | { family: "bout"; bout: BoutState }
  | { family: "performance"; ranked: RankedResult[] }
  | { family: "chess"; result: ChessResult | null; moves: number | null };

const only = <T extends LiveEvent["type"]>(events: ReadonlyArray<LiveEvent>, ...types: T[]) =>
  events.filter((e) => (types as string[]).includes(e.type));

/** `finished` matters only for bouts: a decision is taken when the match is ended. */
export function replayLive(family: LiveFamily, config: LiveConfig, events: ReadonlyArray<LiveEvent>, finished = false): LiveState {
  switch (family) {
    case "tennis":
      return { family, tennis: scoreTennis(only(events, "point") as PointEvent[], config as TennisConfig) };
    case "rally":
      return { family, rally: scoreRally(only(events, "point") as RallyEvent[], config as RallyConfig) };
    case "cricket":
      return { family, cricket: scoreCricket(only(events, "ball", "end_innings") as CricketEvent[], config as CricketConfig) };
    case "goals":
      return { family, goals: scoreGoals(only(events, "period_start", "period_end", "score", "card", "foul", "sub") as GoalsEvent[], config as GoalsConfig) };
    case "bout":
      return { family, bout: scoreBout(only(events, "score", "penalty", "judge_card", "stoppage") as BoutEvent[], config as BoutConfig, finished) };
    case "performance": {
      const rs = (events as PerformanceEvent[]).filter((e) => e.type === "result" && "athlete" in e);
      return { family, ranked: rankResults(rs.map((e) => ({ athlete: e.athlete, value: e.value, status: e.status, attempt: e.attempt })), (config as PerformanceConfig).measure) };
    }
    case "chess": {
      const last = [...events].reverse().find((e): e is ChessEvent => e.type === "result" && "result" in e);
      return { family, result: last?.result ?? null, moves: last?.moves ?? null };
    }
  }
}

/** Winner of a decided match: a side, "draw", or null while it is still open. */
export function liveOutcome(state: LiveState, cricketBattingFirst: LiveSide = "home"): LiveSide | "draw" | null {
  switch (state.family) {
    case "rally":
      return state.rally.winner;
    case "tennis":
      return state.tennis.winner;
    case "cricket": {
      const c = state.cricket;
      if (!c.result) return null;
      if (c.innings.length < 2) return null;
      const [a, b] = c.innings;
      const second: LiveSide = cricketBattingFirst === "home" ? "away" : "home";
      return b.runs > a.runs ? second : b.runs < a.runs ? cricketBattingFirst : "draw";
    }
    case "goals":
      return state.goals.winner;
    case "bout":
      return state.bout.winner;
    case "performance":
      return null;
    case "chess":
      return state.result === "1-0" ? "home" : state.result === "0-1" ? "away" : state.result ? "draw" : null;
  }
}

/** True once no more scoring events are accepted (the scorer can still undo or finish). */
export function isDecided(state: LiveState, battingFirst: LiveSide = "home"): boolean {
  if (state.family === "cricket") return !!state.cricket.result;
  if (state.family === "goals") return state.goals.finished;
  return liveOutcome(state, battingFirst) != null;
}

/** Backwards-compatible name for phase 1 callers (rally and tennis). */
export function liveWinner(state: LiveState): LiveSide | null {
  const o = liveOutcome(state);
  return o === "draw" ? null : o;
}

// ── Rally / tennis scoreboard ────────────────────────────────────────────────

/** Everything a set-based scoreboard needs, the same shape for rally sports and tennis. */
export type Scoreboard = {
  periods: Record<LiveSide, number>[];
  periodsWon: Record<LiveSide, number>;
  current: Record<LiveSide, string>;
  games?: Record<LiveSide, number>;
  tiebreak?: boolean;
  winner: LiveSide | null;
};

const TENNIS_CALL = ["0", "15", "30", "40"];

export function scoreboard(state: LiveState): Scoreboard {
  if (state.family === "rally") {
    const r = state.rally;
    return { periods: r.sets, periodsWon: r.setsWon, current: { home: String(r.current.home), away: String(r.current.away) }, winner: r.winner };
  }
  if (state.family !== "tennis") throw new Error("scoreboard() is for rally sports and tennis");
  const t = state.tennis;
  let current: Record<LiveSide, string>;
  if (t.tiebreak) current = { home: String(t.points.home), away: String(t.points.away) };
  else {
    const h = t.points.home;
    const a = t.points.away;
    if (h >= 3 && a >= 3) current = h === a ? { home: "40", away: "40" } : h > a ? { home: "AD", away: "40" } : { home: "40", away: "AD" };
    else current = { home: TENNIS_CALL[Math.min(h, 3)], away: TENNIS_CALL[Math.min(a, 3)] };
  }
  return { periods: t.sets, periodsWon: t.setsWon, current, games: t.games, tiebreak: t.tiebreak, winner: t.winner };
}

/** "21–18 · 12–21 · 21–15": completed games/sets, then the one in progress (if any points were played). */
export function scoreLine(board: Scoreboard): string {
  const parts = board.periods.map((p) => `${p.home}–${p.away}`);
  if (board.games && (board.games.home || board.games.away)) parts.push(`${board.games.home}–${board.games.away}`);
  else if (!board.games && !board.winner && (board.current.home !== "0" || board.current.away !== "0")) parts.push(`${board.current.home}–${board.current.away}`);
  return parts.join(" · ");
}

/** Game/set point and match point calls for rally sports. */
export function rallyPressure(state: RallyState, cfg: RallyConfig): { side: LiveSide; kind: "game" | "match" } | null {
  if (state.winner) return null;
  const deciding = state.sets.length === cfg.setsToWin * 2 - 2;
  const target = deciding && cfg.decidingSetPoints ? cfg.decidingSetPoints : cfg.pointsToWin;
  for (const side of ["home", "away"] as const) {
    const other = side === "home" ? "away" : "home";
    const mine = state.current[side] + 1;
    const theirs = state.current[other];
    const wins = (cfg.cap != null && mine >= cfg.cap) || (mine >= target && mine - theirs >= cfg.winBy);
    if (wins) return { side, kind: state.setsWon[side] + 1 >= cfg.setsToWin ? "match" : "game" };
  }
  return null;
}

/** Momentum from a point log: longest runs, the run in progress, and the running difference for a sparkline. */
export function momentum(events: ReadonlyArray<LiveEvent>): {
  longestRun: Record<LiveSide, number>;
  currentRun: { side: LiveSide; length: number } | null;
  pointsWon: Record<LiveSide, number>;
  diff: number[];
} {
  const longestRun = { home: 0, away: 0 };
  const pointsWon = { home: 0, away: 0 };
  const diff: number[] = [];
  let run: { side: LiveSide; length: number } | null = null;
  let d = 0;
  for (const e of events) {
    if (e.type !== "point") continue;
    pointsWon[e.side]++;
    run = run && run.side === e.side ? { side: e.side, length: run.length + 1 } : { side: e.side, length: 1 };
    longestRun[e.side] = Math.max(longestRun[e.side], run.length);
    d += e.side === "home" ? 1 : -1;
    diff.push(d);
  }
  return { longestRun, currentRun: run, pointsWon, diff };
}

// ── One-line summaries ───────────────────────────────────────────────────────

export function formatMark(value: number | null, measure: MeasureKind): string {
  if (value == null) return "–";
  if (measure === "time") return formatTime(value);
  if (measure === "points") return String(value / 100);
  return formatDistance(value);
}

/** "12.45" → 12450 ms; "1:03.45" → 63450 ms; "6.45" m → 645 cm; points "8.75" → 875. Null when invalid. */
export function parseMark(input: string, measure: MeasureKind): number | null {
  const t = input.trim().replace(",", ".");
  if (!t) return null;
  if (measure === "time") {
    const m = /^(?:(\d{1,3}):)?(\d{1,2}(?:\.\d{1,3})?)$/.exec(t) ?? /^(\d{1,4}(?:\.\d{1,3})?)$/.exec(t);
    if (!m) return null;
    const minutes = m.length === 3 && m[1] ? Number(m[1]) : 0;
    const seconds = Number(m.length === 3 ? m[2] : m[1]);
    if (!Number.isFinite(seconds) || (minutes > 0 && seconds >= 60)) return null;
    const ms = Math.round((minutes * 60 + seconds) * 1000);
    return ms > 0 ? ms : null;
  }
  if (!/^\d{1,4}(\.\d{1,3})?$/.test(t)) return null;
  const n = Number(t);
  const v = Math.round(n * 100);
  return v > 0 ? v : null;
}

/** Short score line for lists: "21–18 · 5–3", "142/6 (20) v 98/3 (12.4)", "2–1", "Aarav 12.45". */
export function summaryLine(state: LiveState, config: LiveConfig, names: { home: string; away: string }): string {
  switch (state.family) {
    case "rally":
    case "tennis":
      return scoreLine(scoreboard(state));
    case "cricket": {
      const bpo = (config as CricketConfig).ballsPerOver ?? 6;
      return state.cricket.innings
        .filter((i) => i.legalBalls > 0 || i.runs > 0 || i.complete)
        .map((i) => `${i.runs}/${i.wickets} (${oversText(i.legalBalls, bpo)})`)
        .join(" v ");
    }
    case "goals":
      return `${state.goals.score.home}–${state.goals.score.away}`;
    case "bout":
      return `${state.bout.points.home}–${state.bout.points.away}${state.bout.method ? ` · ${state.bout.method}` : ""}`;
    case "performance": {
      const top = state.ranked.find((r) => r.rank === 1);
      return top ? `${top.athlete} ${formatMark(top.best, (config as PerformanceConfig).measure)}` : "";
    }
    case "chess":
      return state.result ? (state.result === "1/2-1/2" ? "½–½" : state.result.replace("-", "–")) : "";
  }
}

// ── Stats written when a match finishes ──────────────────────────────────────

export type LiveAthleteStat = {
  result: "W" | "L" | "D" | "-";
  periodsWon: number;
  periodsLost: number;
  pointsWon: number;
  pointsLost: number;
  longestRun: number;
};

/** Rally/tennis line per side (kept for phase 1 callers and tests). */
export function athleteStatForSide(state: LiveState, events: ReadonlyArray<LiveEvent>, side: LiveSide): LiveAthleteStat {
  const board = scoreboard(state);
  const other: LiveSide = side === "home" ? "away" : "home";
  const m = momentum(events);
  return {
    result: board.winner ? (board.winner === side ? "W" : "L") : "-",
    periodsWon: board.periodsWon[side],
    periodsLost: board.periodsWon[other],
    pointsWon: m.pointsWon[side],
    pointsLost: m.pointsWon[other],
    longestRun: m.longestRun[side],
  };
}

const resultFor = (outcome: LiveSide | "draw" | null, side: LiveSide): "W" | "L" | "D" | "-" =>
  outcome == null ? "-" : outcome === "draw" ? "D" : outcome === side ? "W" : "L";

/**
 * The stats line stored for one academy athlete (AthleteMatchStat.stats). `player` is their display name
 * in the match and `side` their side. Shapes differ by family; every line carries `result` and `family`.
 */
export function playerStatLine(
  family: LiveFamily,
  state: LiveState,
  events: ReadonlyArray<LiveEvent>,
  config: LiveConfig,
  player: string,
  side: LiveSide | "field",
): Record<string, unknown> | null {
  const s: LiveSide = side === "away" ? "away" : "home";
  const battingFirst = (config as CricketLiveConfig).battingFirst ?? "home";
  const outcome = liveOutcome(state, battingFirst);
  switch (state.family) {
    case "rally":
    case "tennis":
      return { family, ...athleteStatForSide(state, events, s), result: resultFor(outcome, s) };
    case "cricket": {
      const c = state.cricket;
      const bat = { runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: null as string | null, batted: false };
      const bowl = { balls: 0, runs: 0, wickets: 0, maidens: 0, bowled: false };
      for (const inn of c.innings) {
        const b = inn.batting.find((x) => x.player === player);
        if (b) {
          bat.batted = true;
          bat.runs += b.runs;
          bat.balls += b.balls;
          bat.fours += b.fours;
          bat.sixes += b.sixes;
          if (b.out) {
            bat.out = true;
            bat.dismissal = b.out;
          }
        }
        const w = inn.bowling.find((x) => x.player === player);
        if (w) {
          bowl.bowled = true;
          bowl.balls += w.balls;
          bowl.runs += w.runs;
          bowl.wickets += w.wickets;
          bowl.maidens += w.maidens;
        }
      }
      const catches = events.filter((e) => e.type === "ball" && "wicket" in e && e.wicket?.kind === "caught" && e.wicket.fielder === player).length;
      const runOuts = events.filter((e) => e.type === "ball" && "wicket" in e && e.wicket?.kind === "runout" && e.wicket.fielder === player).length;
      const stumpings = events.filter((e) => e.type === "ball" && "wicket" in e && e.wicket?.kind === "stumped" && e.wicket.fielder === player).length;
      return { family, result: resultFor(outcome, s), batting: bat.batted ? bat : null, bowling: bowl.bowled ? bowl : null, catches, runOuts, stumpings };
    }
    case "goals": {
      const g = state.goals;
      const line = g.players.find((p) => p.player === player && p.side === s);
      const other: LiveSide = s === "home" ? "away" : "home";
      return {
        family,
        result: resultFor(outcome, s),
        points: line?.points ?? 0,
        scores: line?.scores ?? {},
        assists: line?.assists ?? 0,
        yellow: line?.yellow ?? 0,
        red: line?.red ?? 0,
        teamFor: g.score[s],
        teamAgainst: g.score[other],
      };
    }
    case "bout": {
      const other: LiveSide = s === "home" ? "away" : "home";
      return { family, result: resultFor(outcome, s), pointsFor: state.bout.points[s], pointsAgainst: state.bout.points[other], method: state.bout.method };
    }
    case "performance": {
      const r = state.ranked.find((x) => x.athlete === player);
      if (!r) return null;
      return { family, result: "-", rank: r.rank, best: r.best, status: r.status, measure: (config as PerformanceConfig).measure, eventName: (config as PerformanceConfig).eventName, field: state.ranked.length };
    }
    case "chess":
      return { family, result: resultFor(outcome, s), colour: s === "home" ? "white" : "black", moves: state.moves };
  }
}

// ── Privacy ──────────────────────────────────────────────────────────────────

/** Who may see a match. Staff of the academy always; parents only when their own child is playing. */
export function canViewMatch(
  match: { orgId: string; visibility: string; shareToken: string | null },
  viewer: { staffOfOrg: boolean; parentOfPlayer: boolean; token?: string | null },
): boolean {
  if (viewer.staffOfOrg) return true;
  if (match.visibility === "LINK" && match.shareToken && viewer.token && viewer.token === match.shareToken) return true;
  if (match.visibility === "PRIVATE") return false;
  return viewer.parentOfPlayer;
}

/** Display names on public share links: first name plus last initial, so minors aren't fully named. */
export function publicName(n: string): string {
  const parts = n.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

// ── View sent to screens ─────────────────────────────────────────────────────

export type RosterEntry = { name: string; side: "home" | "away" | "field"; academy: boolean };

export type LiveDetail =
  | {
      family: "rally" | "tennis";
      bestOf: number;
      board: Scoreboard;
      pressure: { side: LiveSide; kind: "game" | "match" } | null;
      momentum: ReturnType<typeof momentum>;
      lastPoint: LiveSide | null;
    }
  | {
      family: "cricket";
      config: CricketLiveConfig;
      cricket: CricketState;
      /** Which side is batting in each innings. */
      battingSides: LiveSide[];
      crr: number | null;
      rrr: number | null;
      /** Last ball's batters and bowler, so the console can carry them over. */
      lastBall: { striker: string; nonStriker: string; bowler: string } | null;
    }
  | { family: "goals"; config: GoalsConfig; goals: GoalsState; periodStartedAt: string | null }
  | { family: "bout"; config: BoutConfig; bout: BoutState; round: number }
  | { family: "performance"; config: PerformanceConfig; ranked: RankedResult[]; attempts: PerformanceEvent[] }
  | { family: "chess"; result: ChessResult | null; moves: number | null };

/** Serializable snapshot sent to scorer and viewer screens (and polled every few seconds). */
export type LiveView = {
  id: string;
  sport: string;
  sportLabel: string;
  unit: string;
  family: LiveFamily;
  title: string;
  home: string;
  away: string;
  venue: string | null;
  status: LiveStatus;
  visibility: LiveVisibility;
  shareToken: string | null;
  version: number;
  line: string;
  outcome: LiveSide | "draw" | null;
  decided: boolean;
  /** Number of scoring events (non-voided). */
  points: number;
  roster: RosterEntry[];
  detail: LiveDetail;
  startedAt: string | null;
  endedAt: string | null;
  canScore: boolean;
  /** Academy staff: may see and change sharing. */
  staff: boolean;
};

export type LiveMatchRecord = {
  id: string;
  sport: string;
  title: string;
  homeName: string;
  awayName: string | null;
  venue: string | null;
  status: string;
  visibility: string;
  shareToken: string | null;
  version: number;
  config: unknown;
  startedAt: Date | null;
  endedAt: Date | null;
};

export function buildLiveView(
  m: LiveMatchRecord,
  rawEvents: ReadonlyArray<LiveEvent>,
  opts: {
    canScore: boolean;
    staff: boolean;
    /** Public link: shortens every person's name. */
    publicNames?: boolean;
    roster?: RosterEntry[];
    /** When the latest period started (goals clock). */
    periodStartedAt?: Date | null;
    /** Side names to show instead of the stored ones (public links shorten athletes' names). */
    sideNames?: { home: string; away: string };
  },
): LiveView | null {
  const def = liveSport(m.sport);
  const cfg = def ? readLiveConfig(m.sport, m.config) : null;
  if (!def || !cfg) return null;
  const rename = opts.publicNames ? publicName : (n: string) => n;
  const events = opts.publicNames ? rawEvents.map((e) => renameInEvent(e, rename)) : rawEvents;
  const finished = m.status === "COMPLETED";
  const state = replayLive(def.family, cfg, events, finished);
  const battingFirst: LiveSide = (cfg as CricketLiveConfig).battingFirst ?? "home";
  const homeName = m.homeName;
  const awayName = m.awayName || (def.family === "performance" ? "" : "Opponent");
  const roster = (opts.roster ?? []).map((r) => ({ ...r, name: rename(r.name) }));
  const names = { home: homeName, away: awayName };

  let detail: LiveDetail;
  switch (state.family) {
    case "rally":
    case "tennis": {
      const board = scoreboard(state);
      const mom = momentum(events);
      const last = [...events].reverse().find((e): e is PointEvent => e.type === "point");
      detail = {
        family: state.family,
        bestOf: (cfg as RallyConfig).setsToWin * 2 - 1,
        board,
        pressure: state.family === "rally" ? rallyPressure(state.rally, cfg as RallyConfig) : null,
        momentum: { ...mom, diff: mom.diff.slice(-120) },
        lastPoint: last ? last.side : null,
      };
      break;
    }
    case "cricket": {
      const c = state.cricket;
      const cc = cfg as CricketLiveConfig;
      const inn = c.innings[c.current];
      const lastBall = [...events].reverse().find((e): e is Extract<CricketEvent, { type: "ball" }> => e.type === "ball");
      const second: LiveSide = battingFirst === "home" ? "away" : "home";
      detail = {
        family: "cricket",
        config: cc,
        cricket: c,
        battingSides: [battingFirst, second],
        crr: inn ? runRate(inn.runs, inn.legalBalls, cc.ballsPerOver ?? 6) : null,
        rrr: requiredRunRate(c, cc),
        lastBall: lastBall ? { striker: lastBall.striker, nonStriker: lastBall.nonStriker, bowler: lastBall.bowler } : null,
      };
      break;
    }
    case "goals":
      detail = { family: "goals", config: cfg as GoalsConfig, goals: state.goals, periodStartedAt: opts.periodStartedAt ? opts.periodStartedAt.toISOString() : null };
      break;
    case "bout": {
      const rounds = events.filter((e) => "round" in e && typeof (e as { round?: number }).round === "number").map((e) => (e as { round: number }).round);
      detail = { family: "bout", config: cfg as BoutConfig, bout: state.bout, round: rounds.length ? Math.max(...rounds) : 1 };
      break;
    }
    case "performance":
      detail = {
        family: "performance",
        config: cfg as PerformanceConfig,
        ranked: state.ranked,
        attempts: events.filter((e): e is PerformanceEvent => e.type === "result" && "athlete" in e),
      };
      break;
    case "chess":
      detail = { family: "chess", result: state.result, moves: state.moves };
      break;
  }

  return {
    id: m.id,
    sport: m.sport,
    sportLabel: def.label,
    unit: def.unit,
    family: def.family,
    title: m.title,
    home: opts.sideNames?.home ?? homeName,
    away: opts.sideNames?.away ?? awayName,
    venue: m.venue,
    status: (["SCHEDULED", "LIVE", "COMPLETED", "ABANDONED"].includes(m.status) ? m.status : "SCHEDULED") as LiveStatus,
    visibility: (["PRIVATE", "ACADEMY", "LINK"].includes(m.visibility) ? m.visibility : "ACADEMY") as LiveVisibility,
    shareToken: opts.staff ? m.shareToken : null,
    version: m.version,
    line: summaryLine(state, cfg, names),
    outcome: liveOutcome(state, battingFirst),
    decided: isDecided(state, battingFirst),
    points: events.length,
    roster,
    detail,
    startedAt: m.startedAt ? m.startedAt.toISOString() : null,
    endedAt: m.endedAt ? m.endedAt.toISOString() : null,
    canScore: opts.canScore,
    staff: opts.staff,
  };
}
