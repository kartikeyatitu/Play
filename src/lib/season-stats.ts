/**
 * Season stats: pure aggregation of AthleteMatchStat rows (written by finishLiveMatch) into per-sport
 * season totals and averages. No database, no React — safe on server and client.
 *
 * A "season" is a date range the academy picks; when none is given it is the last 12 months.
 * Stats lines are shaped per family by playerStatLine() in src/lib/live-match.ts; this file reads them
 * defensively (old or partial rows never throw, missing numbers count as 0).
 */
import { LIVE_SPORTS, type LiveFamily } from "@/lib/live-match";
import { betterIsLower, formatDistance, formatTime, type MeasureKind } from "@/lib/scoring/performance";

export type StatRow = {
  matchId: string;
  studentId: string;
  sport: string;
  stats: unknown;
  playedAt: Date | string;
};

export type SeasonRange = { from: Date; to: Date };

const DAY = 24 * 60 * 60 * 1000;

/** Last 12 months up to now (inclusive). */
export function defaultSeasonRange(now: Date = new Date()): SeasonRange {
  const from = new Date(now);
  from.setFullYear(from.getFullYear() - 1);
  return { from, to: now };
}

/** Parses optional from/to (ISO strings or dates). Bad or missing values fall back to the default season. */
export function parseSeasonRange(from?: string | Date | null, to?: string | Date | null, now: Date = new Date()): SeasonRange {
  const d = (v: string | Date | null | undefined) => {
    if (v == null || v === "") return null;
    const x = v instanceof Date ? v : new Date(v);
    return Number.isFinite(x.getTime()) ? x : null;
  };
  const def = defaultSeasonRange(now);
  let f = d(from) ?? def.from;
  let t = d(to) ?? def.to;
  // A bare date for "to" means the whole of that day.
  if (typeof to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(to)) t = new Date(t.getTime() + DAY - 1);
  if (f > t) [f, t] = [t, f];
  return { from: f, to: t };
}

/** Presets offered in the season picker. */
export function seasonPresets(now: Date = new Date()): { key: string; label: string; range: SeasonRange }[] {
  const y = now.getFullYear();
  // Indian academic/sports year starts in April.
  const aprilStart = new Date(now.getMonth() >= 3 ? y : y - 1, 3, 1);
  return [
    { key: "12m", label: "Last 12 months", range: defaultSeasonRange(now) },
    { key: "year", label: `${y}`, range: { from: new Date(y, 0, 1), to: now } },
    { key: "april", label: `Since Apr ${aprilStart.getFullYear()}`, range: { from: aprilStart, to: now } },
    { key: "3m", label: "Last 3 months", range: { from: new Date(now.getTime() - 91 * DAY), to: now } },
  ];
}

// ── Reading stats lines ─────────────────────────────────────────────────────

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const time = (v: Date | string) => (v instanceof Date ? v : new Date(v)).getTime();
const round = (v: number, dp = 2) => Math.round(v * 10 ** dp) / 10 ** dp;

export type MatchResult = "W" | "L" | "D" | "-";
export function resultOf(stats: unknown): MatchResult {
  const r = obj(stats).result;
  return r === "W" || r === "L" || r === "D" ? r : "-";
}

/** Family for a stats row: the line's own `family`, else the live sport's family, else null. */
export function familyOf(sport: string, stats?: unknown): LiveFamily | null {
  const f = obj(stats).family;
  if (typeof f === "string" && ["rally", "tennis", "cricket", "goals", "bout", "performance", "chess"].includes(f)) return f as LiveFamily;
  return LIVE_SPORTS.find((s) => s.key === sport)?.family ?? null;
}

export function sportLabel(sport: string): string {
  return LIVE_SPORTS.find((s) => s.key === sport)?.label ?? sport.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** What a period is called in this sport (set, game, ...). */
export function periodUnit(sport: string): string {
  return LIVE_SPORTS.find((s) => s.key === sport)?.unit ?? "set";
}

// ── Season shapes ───────────────────────────────────────────────────────────

type Base = {
  sport: string;
  label: string;
  matches: number;
  won: number;
  drawn: number;
  lost: number;
  /** won / decided matches, 0–1; null with no decided matches. */
  winRate: number | null;
  lastPlayedAt: string | null;
};

export type CricketSeason = Base & {
  family: "cricket";
  batting: {
    innings: number;
    runs: number;
    balls: number;
    notOuts: number;
    highScore: number;
    highScoreNotOut: boolean;
    fours: number;
    sixes: number;
    fifties: number;
    hundreds: number;
    /** Runs per 100 balls; null when no balls faced. */
    strikeRate: number | null;
    /** Runs per dismissal; null when never out. */
    average: number | null;
  };
  bowling: {
    innings: number;
    balls: number;
    /** Overs bowled as cricket notation, e.g. "12.3". */
    overs: string;
    runs: number;
    wickets: number;
    maidens: number;
    /** Runs per over; null when no balls bowled. */
    economy: number | null;
    /** Best figures in one match, e.g. { wickets: 3, runs: 12 } → "3/12". */
    best: { wickets: number; runs: number } | null;
  };
  fielding: { catches: number; runOuts: number; stumpings: number };
};

export type GoalsSeason = Base & {
  family: "goals";
  /** Goals (football/hockey/handball) or points (basketball/kabaddi). */
  points: number;
  scores: Record<string, number>;
  assists: number;
  yellow: number;
  red: number;
  teamFor: number;
  teamAgainst: number;
  pointsPerMatch: number | null;
};

export type RallySeason = Base & {
  family: "rally" | "tennis";
  /** Sets (tennis, volleyball) or games (badminton, table tennis...) won and lost. */
  periodsWon: number;
  periodsLost: number;
  periodUnit: string;
  pointsWon: number;
  pointsLost: number;
  longestRun: number;
};

export type BoutSeason = Base & {
  family: "bout";
  pointsFor: number;
  pointsAgainst: number;
  /** How bouts were won: { KO: 1, "Points": 3 }. */
  winMethods: Record<string, number>;
};

export type ChessSeason = Base & {
  family: "chess";
  /** 1 per win, ½ per draw. */
  score: number;
  asWhite: number;
  asBlack: number;
};

export type PerformanceEventSeason = {
  eventName: string;
  measure: MeasureKind;
  entries: number;
  /** Best mark this season in base units (ms or cm, or points). */
  seasonBest: number | null;
  /** Best mark ever up to the end of the season. */
  allTimeBest: number | null;
  /** The season best is also the all-time best (and beat everything before the season). */
  seasonBestIsPB: boolean;
  /** How many results this season set a new personal best at the time. */
  pbCount: number;
  bestRank: number | null;
  lastMark: number | null;
};

export type PerformanceSeason = Base & {
  family: "performance";
  events: PerformanceEventSeason[];
  pbCount: number;
  podiums: number;
};

export type SeasonStats = CricketSeason | GoalsSeason | RallySeason | BoutSeason | ChessSeason | PerformanceSeason;

function base(sport: string, rows: StatRow[]): Base {
  let won = 0;
  let drawn = 0;
  let lost = 0;
  let last = 0;
  for (const r of rows) {
    const res = resultOf(r.stats);
    if (res === "W") won++;
    else if (res === "D") drawn++;
    else if (res === "L") lost++;
    last = Math.max(last, time(r.playedAt));
  }
  const decided = won + drawn + lost;
  return {
    sport,
    label: sportLabel(sport),
    matches: rows.length,
    won,
    drawn,
    lost,
    winRate: decided ? round((won + drawn * 0.5) / decided, 3) : null,
    lastPlayedAt: last ? new Date(last).toISOString() : null,
  };
}

export function oversFromBalls(balls: number): string {
  return `${Math.floor(balls / 6)}${balls % 6 ? `.${balls % 6}` : ""}`;
}

function cricket(sport: string, rows: StatRow[]): CricketSeason {
  const bat = { innings: 0, runs: 0, balls: 0, notOuts: 0, highScore: 0, highScoreNotOut: false, fours: 0, sixes: 0, fifties: 0, hundreds: 0 };
  const bowl = { innings: 0, balls: 0, runs: 0, wickets: 0, maidens: 0 };
  let best: { wickets: number; runs: number } | null = null;
  const field = { catches: 0, runOuts: 0, stumpings: 0 };
  for (const r of rows) {
    const s = obj(r.stats);
    if (s.batting && typeof s.batting === "object") {
      const b = obj(s.batting);
      const runs = num(b.runs);
      const out = b.out === true;
      bat.innings++;
      bat.runs += runs;
      bat.balls += num(b.balls);
      bat.fours += num(b.fours);
      bat.sixes += num(b.sixes);
      if (!out) bat.notOuts++;
      if (runs >= 100) bat.hundreds++;
      else if (runs >= 50) bat.fifties++;
      if (runs > bat.highScore || (runs === bat.highScore && !out)) {
        bat.highScore = runs;
        bat.highScoreNotOut = !out;
      }
    }
    if (s.bowling && typeof s.bowling === "object") {
      const w = obj(s.bowling);
      const fig = { wickets: num(w.wickets), runs: num(w.runs) };
      bowl.innings++;
      bowl.balls += num(w.balls);
      bowl.runs += fig.runs;
      bowl.wickets += fig.wickets;
      bowl.maidens += num(w.maidens);
      if (!best || fig.wickets > best.wickets || (fig.wickets === best.wickets && fig.runs < best.runs)) best = fig;
    }
    field.catches += num(s.catches);
    field.runOuts += num(s.runOuts);
    field.stumpings += num(s.stumpings);
  }
  const dismissals = bat.innings - bat.notOuts;
  return {
    ...base(sport, rows),
    family: "cricket",
    batting: {
      ...bat,
      strikeRate: bat.balls ? round((bat.runs / bat.balls) * 100, 1) : null,
      average: dismissals ? round(bat.runs / dismissals, 1) : null,
    },
    bowling: {
      ...bowl,
      overs: oversFromBalls(bowl.balls),
      economy: bowl.balls ? round(bowl.runs / (bowl.balls / 6), 2) : null,
      best,
    },
    fielding: field,
  };
}

function goals(sport: string, rows: StatRow[]): GoalsSeason {
  const t = { points: 0, assists: 0, yellow: 0, red: 0, teamFor: 0, teamAgainst: 0 };
  const scores: Record<string, number> = {};
  for (const r of rows) {
    const s = obj(r.stats);
    t.points += num(s.points);
    t.assists += num(s.assists);
    t.yellow += num(s.yellow);
    t.red += num(s.red);
    t.teamFor += num(s.teamFor);
    t.teamAgainst += num(s.teamAgainst);
    for (const [k, v] of Object.entries(obj(s.scores))) scores[k] = (scores[k] ?? 0) + num(v);
  }
  return { ...base(sport, rows), family: "goals", ...t, scores, pointsPerMatch: rows.length ? round(t.points / rows.length, 2) : null };
}

function rally(sport: string, family: "rally" | "tennis", rows: StatRow[]): RallySeason {
  const t = { periodsWon: 0, periodsLost: 0, pointsWon: 0, pointsLost: 0, longestRun: 0 };
  for (const r of rows) {
    const s = obj(r.stats);
    t.periodsWon += num(s.periodsWon);
    t.periodsLost += num(s.periodsLost);
    t.pointsWon += num(s.pointsWon);
    t.pointsLost += num(s.pointsLost);
    t.longestRun = Math.max(t.longestRun, num(s.longestRun));
  }
  return { ...base(sport, rows), family, ...t, periodUnit: periodUnit(sport) };
}

function bout(sport: string, rows: StatRow[]): BoutSeason {
  let pointsFor = 0;
  let pointsAgainst = 0;
  const winMethods: Record<string, number> = {};
  for (const r of rows) {
    const s = obj(r.stats);
    pointsFor += num(s.pointsFor);
    pointsAgainst += num(s.pointsAgainst);
    if (resultOf(s) === "W") {
      const m = str(s.method) ?? "Points";
      winMethods[m] = (winMethods[m] ?? 0) + 1;
    }
  }
  return { ...base(sport, rows), family: "bout", pointsFor, pointsAgainst, winMethods };
}

function chess(sport: string, rows: StatRow[]): ChessSeason {
  const b = base(sport, rows);
  let asWhite = 0;
  let asBlack = 0;
  for (const r of rows) {
    const c = obj(r.stats).colour;
    if (c === "white") asWhite++;
    else if (c === "black") asBlack++;
  }
  return { ...b, family: "chess", score: b.won + b.drawn * 0.5, asWhite, asBlack };
}

const MEASURES: MeasureKind[] = ["time", "distance", "height", "points"];
const better = (a: number, b: number, m: MeasureKind) => (betterIsLower(m) ? a < b : a > b);

/** Performance: per event, season best vs everything before (history may include rows before the season). */
function performance(sport: string, seasonRows: StatRow[], history: StatRow[], range: SeasonRange): PerformanceSeason {
  type Mark = { at: number; value: number | null; rank: number | null };
  const byEvent = new Map<string, { eventName: string; measure: MeasureKind; marks: Mark[] }>();
  const add = (r: StatRow) => {
    const s = obj(r.stats);
    const eventName = str(s.eventName) ?? "Event";
    const measure = (MEASURES.includes(s.measure as MeasureKind) ? s.measure : "time") as MeasureKind;
    const key = `${eventName.toLowerCase()}|${measure}`;
    const e = byEvent.get(key) ?? { eventName, measure, marks: [] };
    const ok = (s.status ?? "OK") === "OK" && typeof s.best === "number" && Number.isFinite(s.best);
    e.marks.push({ at: time(r.playedAt), value: ok ? (s.best as number) : null, rank: typeof s.rank === "number" ? s.rank : null });
    byEvent.set(key, e);
  };
  const end = range.to.getTime();
  for (const r of history) if (time(r.playedAt) <= end) add(r);
  const start = range.from.getTime();
  const events: PerformanceEventSeason[] = [];
  let pbTotal = 0;
  let podiums = 0;
  for (const e of byEvent.values()) {
    e.marks.sort((a, b) => a.at - b.at);
    let running: number | null = null;
    let beforeSeason: number | null = null;
    let seasonBest: number | null = null;
    let pbCount = 0;
    let entries = 0;
    let bestRank: number | null = null;
    let lastMark: number | null = null;
    for (const m of e.marks) {
      const inSeason = m.at >= start;
      if (inSeason) {
        entries++;
        if (m.rank != null) {
          bestRank = bestRank == null ? m.rank : Math.min(bestRank, m.rank);
          if (m.rank <= 3) podiums++;
        }
      }
      if (m.value == null) continue;
      if (inSeason) {
        lastMark = m.value;
        if (seasonBest == null || better(m.value, seasonBest, e.measure)) seasonBest = m.value;
        if (running == null || better(m.value, running, e.measure)) pbCount++;
      } else if (beforeSeason == null || better(m.value, beforeSeason, e.measure)) {
        beforeSeason = m.value;
      }
      if (running == null || better(m.value, running, e.measure)) running = m.value;
    }
    if (entries === 0) continue;
    pbTotal += pbCount;
    events.push({
      eventName: e.eventName,
      measure: e.measure,
      entries,
      seasonBest,
      allTimeBest: running,
      seasonBestIsPB: seasonBest != null && (beforeSeason == null || better(seasonBest, beforeSeason, e.measure)),
      pbCount,
      bestRank,
      lastMark,
    });
  }
  events.sort((a, b) => b.entries - a.entries || a.eventName.localeCompare(b.eventName));
  return { ...base(sport, seasonRows), family: "performance", events, pbCount: pbTotal, podiums };
}

/**
 * Season totals per sport for one athlete. `rows` may include rows outside the season: only rows in
 * range count, except that earlier performance marks are used to decide personal bests.
 * Pass `sport` to keep one sport. Sports are ordered by matches played.
 */
export function aggregateSeason(rows: ReadonlyArray<StatRow>, range: SeasonRange = defaultSeasonRange(), sport?: string | null): SeasonStats[] {
  const from = range.from.getTime();
  const to = range.to.getTime();
  const bySport = new Map<string, { all: StatRow[]; season: StatRow[] }>();
  for (const r of rows) {
    if (sport && r.sport !== sport) continue;
    const g = bySport.get(r.sport) ?? { all: [], season: [] };
    g.all.push(r);
    const t = time(r.playedAt);
    if (t >= from && t <= to) g.season.push(r);
    bySport.set(r.sport, g);
  }
  const out: SeasonStats[] = [];
  for (const [key, g] of bySport) {
    if (g.season.length === 0) continue;
    const fam = familyOf(key, g.season[0].stats);
    switch (fam) {
      case "cricket":
        out.push(cricket(key, g.season));
        break;
      case "goals":
        out.push(goals(key, g.season));
        break;
      case "rally":
      case "tennis":
        out.push(rally(key, fam, g.season));
        break;
      case "bout":
        out.push(bout(key, g.season));
        break;
      case "chess":
        out.push(chess(key, g.season));
        break;
      case "performance":
        out.push(performance(key, g.season, g.all, range));
        break;
      default:
        break;
    }
  }
  return out.sort((a, b) => b.matches - a.matches || a.label.localeCompare(b.label));
}

// ── Display helpers ─────────────────────────────────────────────────────────

/** Formats a performance mark in base units for display. */
export function formatMark(value: number | null, measure: MeasureKind): string {
  if (value == null) return "–";
  if (measure === "time") return formatTime(value);
  if (measure === "points") return String(value);
  return formatDistance(value);
}

export type StatTile = { key: string; label: string; value: string; sort: number };

/** The handful of headline numbers shown on a card or used as sortable squad columns. */
export function headlineStats(s: SeasonStats): StatTile[] {
  const pct = (v: number | null) => (v == null ? "–" : `${Math.round(v * 100)}%`);
  const n = (v: number | null, dp = 0) => (v == null ? "–" : dp ? v.toFixed(dp) : String(v));
  const common: StatTile = { key: "matches", label: s.family === "chess" ? "Games" : s.family === "bout" ? "Bouts" : "Matches", value: String(s.matches), sort: s.matches };
  switch (s.family) {
    case "cricket":
      return [
        common,
        { key: "runs", label: "Runs", value: String(s.batting.runs), sort: s.batting.runs },
        { key: "sr", label: "Strike rate", value: n(s.batting.strikeRate, 1), sort: s.batting.strikeRate ?? -1 },
        { key: "wickets", label: "Wickets", value: String(s.bowling.wickets), sort: s.bowling.wickets },
        { key: "econ", label: "Economy", value: n(s.bowling.economy, 2), sort: s.bowling.economy == null ? -1 : -s.bowling.economy },
      ];
    case "goals": {
      const pointsLabel = s.sport === "basketball" || s.sport === "kabaddi" ? "Points" : "Goals";
      return [
        common,
        { key: "points", label: pointsLabel, value: String(s.points), sort: s.points },
        { key: "assists", label: "Assists", value: String(s.assists), sort: s.assists },
        { key: "cards", label: "Cards", value: `${s.yellow}/${s.red}`, sort: -(s.yellow + s.red * 2) },
      ];
    }
    case "rally":
    case "tennis":
      return [
        common,
        { key: "won", label: "Won", value: String(s.won), sort: s.won },
        { key: "winrate", label: "Win %", value: pct(s.winRate), sort: s.winRate ?? -1 },
        { key: "periods", label: `${s.periodUnit[0].toUpperCase()}${s.periodUnit.slice(1)}s won`, value: String(s.periodsWon), sort: s.periodsWon },
      ];
    case "bout":
      return [
        common,
        { key: "won", label: "Wins", value: String(s.won), sort: s.won },
        { key: "winrate", label: "Win %", value: pct(s.winRate), sort: s.winRate ?? -1 },
        { key: "pointsFor", label: "Points", value: String(s.pointsFor), sort: s.pointsFor },
      ];
    case "chess":
      return [
        common,
        { key: "score", label: "Score", value: String(s.score), sort: s.score },
        { key: "wdl", label: "W-D-L", value: `${s.won}-${s.drawn}-${s.lost}`, sort: s.won },
        { key: "winrate", label: "Score %", value: pct(s.winRate), sort: s.winRate ?? -1 },
      ];
    case "performance":
      return [
        { ...common, label: "Events" },
        { key: "pbs", label: "PBs", value: String(s.pbCount), sort: s.pbCount },
        { key: "podiums", label: "Podiums", value: String(s.podiums), sort: s.podiums },
      ];
  }
}
