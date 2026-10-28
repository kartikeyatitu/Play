/**
 * Live scoring glue (docs/specs/live-scoring.md). Pure: no database, no React.
 *
 * A live match is an append-only event log. The current state is always the family engine's replay of
 * the non-voided events, so undo is "void the last event and replay" and two devices can never disagree
 * about the score. This file decides which sports are live-scorable, builds and clamps their config,
 * validates incoming events, replays them and turns state into what screens and stats need.
 *
 * Phase 1 covers the point-by-point families: rally sports (badminton, table tennis, volleyball,
 * squash, pickleball) and tennis. Cricket, goals, timed events, bouts and chess follow.
 */
import { RALLY_SPORTS, scoreRally, type RallyConfig, type RallyEvent, type RallyState } from "@/lib/scoring/rally";
import { scoreTennis, TENNIS_DEFAULT, type TennisConfig, type TennisState } from "@/lib/scoring/tennis";

export type LiveSide = "home" | "away";
export type LiveFamily = "rally" | "tennis";
export type LiveStatus = "SCHEDULED" | "LIVE" | "COMPLETED" | "ABANDONED";
export type LiveVisibility = "PRIVATE" | "ACADEMY" | "LINK";

export type LiveSportDef = { key: string; label: string; family: LiveFamily; unit: string };

export const LIVE_SPORTS: LiveSportDef[] = [
  { key: "badminton", label: "Badminton", family: "rally", unit: "game" },
  { key: "table_tennis", label: "Table tennis", family: "rally", unit: "game" },
  { key: "volleyball", label: "Volleyball", family: "rally", unit: "set" },
  { key: "squash", label: "Squash", family: "rally", unit: "game" },
  { key: "pickleball", label: "Pickleball", family: "rally", unit: "game" },
  { key: "tennis", label: "Tennis", family: "tennis", unit: "set" },
];

export function liveSport(key: string): LiveSportDef | null {
  return LIVE_SPORTS.find((s) => s.key === key) ?? null;
}

export type LiveConfig = RallyConfig | TennisConfig;

/** "Best of" choices offered when creating a match: 1, 3 or 5 games/sets. */
export const BEST_OF = [1, 3, 5] as const;

/** Default config for a sport, with an optional best-of override (clamped to 1/3/5). */
export function buildLiveConfig(sportKey: string, bestOf?: number): LiveConfig | null {
  const def = liveSport(sportKey);
  if (!def) return null;
  const setsToWin = bestOf && (BEST_OF as readonly number[]).includes(bestOf) ? (bestOf + 1) / 2 : undefined;
  if (def.family === "tennis") return { ...TENNIS_DEFAULT, ...(setsToWin ? { setsToWin } : {}) };
  const base = RALLY_SPORTS[sportKey];
  return { ...base, ...(setsToWin ? { setsToWin } : {}) };
}

/** Reads a stored config back, falling back to the sport default for anything missing or malformed. */
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
  return out as LiveConfig;
}

export type LiveEvent = { type: "point"; side: LiveSide; player?: string };

/** Validates an event from a client. Only the fields the engines read survive. */
export function parseLiveEvent(family: LiveFamily, raw: unknown): { ok: true; event: LiveEvent } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Missing event" };
  const r = raw as Record<string, unknown>;
  if (family === "rally" || family === "tennis") {
    if (r.type !== "point") return { ok: false, error: "Unknown event" };
    if (r.side !== "home" && r.side !== "away") return { ok: false, error: "Pick a side" };
    const ev: LiveEvent = { type: "point", side: r.side };
    if (family === "rally" && typeof r.player === "string" && r.player.length > 0 && r.player.length <= 64) ev.player = r.player;
    return { ok: true, event: ev };
  }
  return { ok: false, error: "This sport can't be scored live yet" };
}

export type LiveState =
  | { family: "rally"; rally: RallyState }
  | { family: "tennis"; tennis: TennisState };

export function replayLive(family: LiveFamily, config: LiveConfig, events: ReadonlyArray<LiveEvent>): LiveState {
  if (family === "tennis") return { family, tennis: scoreTennis(events, config as TennisConfig) };
  return { family, rally: scoreRally(events as ReadonlyArray<RallyEvent>, config as RallyConfig) };
}

export function liveWinner(state: LiveState): LiveSide | null {
  return state.family === "tennis" ? state.tennis.winner : state.rally.winner;
}

/** Everything a scoreboard needs, the same shape for both families. */
export type Scoreboard = {
  /** Completed games/sets, oldest first. */
  periods: Record<LiveSide, number>[];
  periodsWon: Record<LiveSide, number>;
  /** Score in the game/set being played (points; for tennis the 0/15/30/40/AD call). */
  current: Record<LiveSide, string>;
  /** Tennis only: games in the current set. */
  games?: Record<LiveSide, number>;
  tiebreak?: boolean;
  winner: LiveSide | null;
};

const TENNIS_CALL = ["0", "15", "30", "40"];

export function scoreboard(state: LiveState): Scoreboard {
  if (state.family === "rally") {
    const r = state.rally;
    return {
      periods: r.sets,
      periodsWon: r.setsWon,
      current: { home: String(r.current.home), away: String(r.current.away) },
      winner: r.winner,
    };
  }
  const t = state.tennis;
  let current: Record<LiveSide, string>;
  if (t.tiebreak) current = { home: String(t.points.home), away: String(t.points.away) };
  else {
    const h = t.points.home;
    const a = t.points.away;
    if (h >= 3 && a >= 3) {
      current = h === a ? { home: "40", away: "40" } : h > a ? { home: "AD", away: "40" } : { home: "40", away: "AD" };
    } else current = { home: TENNIS_CALL[Math.min(h, 3)], away: TENNIS_CALL[Math.min(a, 3)] };
  }
  return { periods: t.sets, periodsWon: t.setsWon, current, games: t.games, tiebreak: t.tiebreak, winner: t.winner };
}

/** "21–18 · 12–21 · 21–15": completed games/sets, then the one in progress (if any points were played). */
export function scoreLine(board: Scoreboard): string {
  const parts = board.periods.map((p) => `${p.home}–${p.away}`);
  if (board.games && (board.games.home || board.games.away)) parts.push(`${board.games.home}–${board.games.away}`);
  else if (!board.games && !board.winner && (board.current.home !== "0" || board.current.away !== "0")) {
    parts.push(`${board.current.home}–${board.current.away}`);
  }
  return parts.join(" · ");
}

/** Game/set point and match point calls for rally sports, so the scorer and viewers see the pressure. */
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

/**
 * Momentum from the point log: longest run of consecutive points for each side, the run in progress,
 * and the running score difference after every point (home minus away) for a sparkline.
 */
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

/** Per-athlete line written to AthleteMatchStat when a match is finished. */
export type LiveAthleteStat = {
  result: "W" | "L" | "-";
  periodsWon: number;
  periodsLost: number;
  pointsWon: number;
  pointsLost: number;
  longestRun: number;
};

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
export function publicName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

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
  bestOf: number;
  board: Scoreboard;
  line: string;
  pressure: { side: LiveSide; kind: "game" | "match" } | null;
  momentum: { longestRun: Record<LiveSide, number>; currentRun: { side: LiveSide; length: number } | null; pointsWon: Record<LiveSide, number>; diff: number[] };
  lastPoint: LiveSide | null;
  points: number;
  startedAt: string | null;
  endedAt: string | null;
  canScore: boolean;
  /** Academy staff: may see and change sharing. */
  staff: boolean;
};

export function buildLiveView(
  m: {
    id: string; sport: string; title: string; homeName: string; awayName: string | null; venue: string | null; status: string;
    visibility: string; shareToken: string | null; version: number; config: unknown; startedAt: Date | null; endedAt: Date | null;
  },
  events: ReadonlyArray<LiveEvent>,
  opts: { canScore: boolean; staff: boolean; publicNames?: { home: string; away: string } },
): LiveView | null {
  const def = liveSport(m.sport);
  const cfg = def ? readLiveConfig(m.sport, m.config) : null;
  if (!def || !cfg) return null;
  const state = replayLive(def.family, cfg, events);
  const board = scoreboard(state);
  const mom = momentum(events);
  const last = events.length ? events[events.length - 1] : null;
  return {
    id: m.id,
    sport: m.sport,
    sportLabel: def.label,
    unit: def.unit,
    family: def.family,
    title: m.title,
    home: opts.publicNames?.home ?? m.homeName,
    away: opts.publicNames?.away ?? (m.awayName || "Opponent"),
    venue: m.venue,
    status: (["SCHEDULED", "LIVE", "COMPLETED", "ABANDONED"].includes(m.status) ? m.status : "SCHEDULED") as LiveStatus,
    visibility: (["PRIVATE", "ACADEMY", "LINK"].includes(m.visibility) ? m.visibility : "ACADEMY") as LiveVisibility,
    shareToken: opts.staff ? m.shareToken : null,
    version: m.version,
    bestOf: cfg.setsToWin * 2 - 1,
    board,
    line: scoreLine(board),
    pressure: state.family === "rally" ? rallyPressure(state.rally, cfg as RallyConfig) : null,
    momentum: { ...mom, diff: mom.diff.slice(-120) },
    lastPoint: last ? last.side : null,
    points: events.length,
    startedAt: m.startedAt ? m.startedAt.toISOString() : null,
    endedAt: m.endedAt ? m.endedAt.toISOString() : null,
    canScore: opts.canScore,
    staff: opts.staff,
  };
}
