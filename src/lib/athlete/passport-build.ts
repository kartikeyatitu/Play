// Athlete Passport v1: the pure assembly. Takes rows already loaded by src/lib/athlete/passport.ts and
// returns the payload. No DB, no React; safe on server and client, and fully unit-tested.
//
// Tier 1 (coaching) data only. The payload never carries medical, incident or wellbeing fields, free-text
// notes, contact details, fees or points. PASSPORT_KEYS lists the top-level shape and a test walks every
// nested key of a fully populated payload against FORBIDDEN_KEY.

import { aggregateSeason, defaultSeasonRange, familyOf, formatMark, resultOf, sportLabel, type SeasonStats, type StatRow } from "@/lib/season-stats";
import { betterIsLower, type MeasureKind } from "@/lib/scoring/performance";
import { attendedSession } from "@/lib/athlete/points-rules";

// ── Source rows (what the loader passes in) ─────────────────────────────────

export type PassportSource = {
  now: Date;
  student: { id: string; name: string };
  academy: { id: string; name: string } | null;
  batches: { id: string; name: string; sport: string; schedule: string | null; coachName: string | null }[];
  attendances: { isPresent: boolean; status: string | null; date: Date | string; sessionStatus: string | null }[];
  matchStats: { matchId: string; sport: string; stats: unknown; playedAt: Date | string; title: string; matchStatus: string | null }[];
  performanceResults: {
    sport: string;
    eventName: string;
    measure: string;
    value: number | null;
    status: string;
    recordedAt: Date | string;
    matchId: string | null;
  }[];
  achievements: {
    id: string;
    kind: string;
    title: string;
    competition: string | null;
    level: string;
    result: string | null;
    eventDate: Date | string;
    status: string;
    submittedByRole: string;
    verifiedAt: Date | string | null;
  }[];
  goals: {
    id: string;
    title: string;
    metric: string | null;
    baseline: number | null;
    target: number | null;
    dueDate: Date | string | null;
    status: string;
    achievedAt: Date | string | null;
  }[];
  skillReports: {
    month: string;
    sport: string | null;
    technique: number;
    fitness: number;
    discipline: number;
    metrics: unknown;
    coachName: string | null;
  }[];
};

// ── Payload ─────────────────────────────────────────────────────────────────

export type Verification = "VERIFIED" | "SELF_REPORTED";

export type PassportLevel = {
  sport: string;
  label: string;
  level: 1 | 2 | 3 | 4;
  name: LevelName;
  matches: number;
  winRate: number | null;
  assessment: number | null;
  next: string | null;
};

export type Passport = {
  version: 1;
  generatedAt: string;
  athlete: { id: string; name: string; firstName: string };
  academy: { id: string; name: string } | null;
  sports: { key: string; label: string }[];
  batches: { id: string; name: string; sport: string; schedule: string | null; coachName: string | null }[];
  attendance: AttendanceSummary;
  levels: PassportLevel[];
  seasonStats: SeasonStats[];
  matches: { matchId: string; title: string; sport: string; sportLabel: string; playedAt: string; result: "W" | "L" | "D" | "-"; line: string }[];
  personalBests: { sport: string; sportLabel: string; eventName: string; measure: MeasureKind; value: number; display: string; recordedAt: string; matchId: string | null }[];
  achievements: {
    id: string;
    kind: string;
    title: string;
    competition: string | null;
    level: string;
    result: string | null;
    eventDate: string;
    verification: Verification;
    verifiedAt: string | null;
    addedBy: string;
  }[];
  goals: { id: string; title: string; metric: string | null; baseline: number | null; target: number | null; dueDate: string | null; status: string; achievedAt: string | null }[];
  latestSkillReport: {
    month: string;
    sport: string | null;
    technique: number;
    fitness: number;
    discipline: number;
    average: number;
    metrics: Record<string, number>;
    coachName: string | null;
  } | null;
};

/** The top-level keys of a passport, in order. A test pins this list. */
export const PASSPORT_KEYS = [
  "version",
  "generatedAt",
  "athlete",
  "academy",
  "sports",
  "batches",
  "attendance",
  "levels",
  "seasonStats",
  "matches",
  "personalBests",
  "achievements",
  "goals",
  "latestSkillReport",
] as const;

/** No key anywhere in the payload may match this (medical, incident, wellbeing, contact or money data). */
export const FORBIDDEN_KEY =
  /medical|blood|allerg|emergency|condition|doctor|insurance|diet|incident|injur|wellbeing|wellness|journal|check-?in|mood|consent|phone|email|parent|fee|notes?$|dob|birth/i;

// ── Helpers ─────────────────────────────────────────────────────────────────

const iso = (d: Date | string) => (d instanceof Date ? d : new Date(d)).toISOString();
const isoOrNull = (d: Date | string | null | undefined) => (d == null ? null : iso(d));
const ms = (d: Date | string) => (d instanceof Date ? d : new Date(d)).getTime();
const round = (v: number, dp = 2) => Math.round(v * 10 ** dp) / 10 ** dp;
const DAY = 24 * 60 * 60 * 1000;

/** "Table Tennis" / "table-tennis" / "TABLE_TENNIS" → "table_tennis" (the live-scoring sport key form). */
export function normalizeSport(sport: string | null | undefined): string {
  return (sport ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

// ── Attendance ──────────────────────────────────────────────────────────────

export type AttendanceSummary = {
  /** Sessions that count: not cancelled and not an excused absence. */
  sessions: number;
  attended: number;
  /** attended / sessions, 0–1; null with no sessions. */
  rate: number | null;
  last30Days: { sessions: number; attended: number; rate: number | null };
  /** Attended sessions in a row, most recent first. */
  currentStreak: number;
  lastAttendedAt: string | null;
};

export function summarizeAttendance(rows: PassportSource["attendances"], now: Date): AttendanceSummary {
  const counted = rows
    .filter((r) => r.sessionStatus !== "CANCELLED" && r.status !== "EXCUSED")
    .map((r) => ({ at: ms(r.date), present: attendedSession(r) }))
    .filter((r) => Number.isFinite(r.at) && r.at <= now.getTime())
    .sort((a, b) => b.at - a.at);
  const attended = counted.filter((r) => r.present).length;
  const recent = counted.filter((r) => r.at >= now.getTime() - 30 * DAY);
  const recentAttended = recent.filter((r) => r.present).length;
  let streak = 0;
  for (const r of counted) {
    if (!r.present) break;
    streak++;
  }
  const lastAttended = counted.find((r) => r.present);
  return {
    sessions: counted.length,
    attended,
    rate: counted.length ? round(attended / counted.length, 3) : null,
    last30Days: { sessions: recent.length, attended: recentAttended, rate: recent.length ? round(recentAttended / recent.length, 3) : null },
    currentStreak: streak,
    lastAttendedAt: lastAttended ? new Date(lastAttended.at).toISOString() : null,
  };
}

// ── Level per sport ─────────────────────────────────────────────────────────
//
// Deterministic from matches and coach assessments only (never from medical, wellbeing or attendance).
//   matches     = all-time scored matches in the sport (AthleteMatchStat rows)
//   winRate     = (wins + draws/2) / decided matches, all time (not used for performance sports)
//   assessment  = mean of (technique + fitness + discipline) / 3 over the latest 3 skill reports for the
//                 sport, on the 1–5 coach scale; null with no report
//
//   4 Advanced     matches >= 25 AND assessment >= 4.2 AND (performance sport OR winRate >= 0.5)
//   3 Competitive  matches >= 10 AND assessment >= 3.5
//   2 Developing   matches >= 3  OR  assessment >= 3.0
//   1 Foundation   otherwise
//
// Levels 3 and 4 need a coach assessment, so match volume alone can't lift an athlete past Developing.

export const LEVEL_NAMES = ["Foundation", "Developing", "Competitive", "Advanced"] as const;
export type LevelName = (typeof LEVEL_NAMES)[number];

export const LEVEL_THRESHOLDS = {
  developing: { minMatches: 3, orMinAssessment: 3.0 },
  competitive: { minMatches: 10, minAssessment: 3.5 },
  advanced: { minMatches: 25, minAssessment: 4.2, minWinRate: 0.5 },
  assessmentReports: 3,
} as const;

export type LevelInput = { matches: number; winRate: number | null; assessment: number | null; performanceSport: boolean };

export function sportLevel(i: LevelInput): { level: 1 | 2 | 3 | 4; name: LevelName; next: string | null } {
  const T = LEVEL_THRESHOLDS;
  const a = i.assessment;
  const winOk = i.performanceSport || (i.winRate ?? 0) >= T.advanced.minWinRate;
  if (i.matches >= T.advanced.minMatches && a != null && a >= T.advanced.minAssessment && winOk) {
    return { level: 4, name: "Advanced", next: null };
  }
  if (i.matches >= T.competitive.minMatches && a != null && a >= T.competitive.minAssessment) {
    const need: string[] = [];
    if (i.matches < T.advanced.minMatches) need.push(`${T.advanced.minMatches - i.matches} more matches`);
    if (a < T.advanced.minAssessment) need.push(`coach assessment ${T.advanced.minAssessment}+`);
    if (!winOk) need.push(`win rate ${Math.round(T.advanced.minWinRate * 100)}%+`);
    return { level: 3, name: "Competitive", next: `Advanced: ${need.join(", ")}` };
  }
  if (i.matches >= T.developing.minMatches || (a != null && a >= T.developing.orMinAssessment)) {
    const need: string[] = [];
    if (i.matches < T.competitive.minMatches) need.push(`${T.competitive.minMatches - i.matches} more matches`);
    if (a == null || a < T.competitive.minAssessment) need.push(`coach assessment ${T.competitive.minAssessment}+`);
    return { level: 2, name: "Developing", next: `Competitive: ${need.join(", ")}` };
  }
  const need: string[] = [`${T.developing.minMatches - i.matches} more matches`, `or coach assessment ${T.developing.orMinAssessment}+`];
  return { level: 1, name: "Foundation", next: `Developing: ${need.join(" ")}` };
}

const reportAverage = (r: { technique: number; fitness: number; discipline: number }) => (r.technique + r.fitness + r.discipline) / 3;

/** Mean assessment over the latest N reports that belong to `sport` (sport-less reports count when the athlete has one sport). */
export function assessmentFor(sport: string, reports: PassportSource["skillReports"], onlySport: string | null): number | null {
  const mine = reports
    .filter((r) => {
      const k = normalizeSport(r.sport);
      return k ? k === sport : onlySport === sport;
    })
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, LEVEL_THRESHOLDS.assessmentReports);
  if (!mine.length) return null;
  return round(mine.reduce((s, r) => s + reportAverage(r), 0) / mine.length, 2);
}

// ── Matches ─────────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const ordinal = (k: number) => `${k}${k % 100 >= 11 && k % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[k % 10] ?? "th"}`;

/** One short line describing the athlete's own part in a match, from their stats line. */
export function matchLine(sport: string, stats: unknown): string {
  const s = obj(stats);
  switch (familyOf(sport, stats)) {
    case "cricket": {
      const parts: string[] = [];
      if (s.batting && typeof s.batting === "object") {
        const b = obj(s.batting);
        parts.push(`${n(b.runs)}${b.out === true ? "" : "*"} (${n(b.balls)})`);
      }
      if (s.bowling && typeof s.bowling === "object") {
        const w = obj(s.bowling);
        parts.push(`${n(w.wickets)}/${n(w.runs)}`);
      }
      const c = n(s.catches);
      if (c) parts.push(`${c} catch${c === 1 ? "" : "es"}`);
      return parts.join(" · ") || "Played";
    }
    case "goals": {
      const label = sport === "basketball" || sport === "kabaddi" ? "pt" : "goal";
      const p = n(s.points);
      const a = n(s.assists);
      const parts = [`${p} ${label}${p === 1 ? "" : "s"}`];
      if (a) parts.push(`${a} assist${a === 1 ? "" : "s"}`);
      parts.push(`team ${n(s.teamFor)}–${n(s.teamAgainst)}`);
      return parts.join(" · ");
    }
    case "rally":
    case "tennis":
      return `${n(s.periodsWon)}–${n(s.periodsLost)}`;
    case "bout":
      return `${n(s.pointsFor)}–${n(s.pointsAgainst)}${typeof s.method === "string" && s.method && resultOf(s) === "W" ? ` (${s.method})` : ""}`;
    case "chess":
      return s.colour === "white" ? "as White" : s.colour === "black" ? "as Black" : "Played";
    case "performance": {
      const measure = (["time", "distance", "height", "points"].includes(s.measure as string) ? s.measure : "time") as MeasureKind;
      const status = typeof s.status === "string" ? s.status : "OK";
      const event = typeof s.eventName === "string" ? s.eventName : "Event";
      if (status !== "OK" || typeof s.best !== "number") return `${event} · ${status}`;
      const rank = typeof s.rank === "number" ? `${ordinal(s.rank)} · ` : "";
      return `${event} · ${rank}${formatMark(s.best, measure)}`;
    }
    default:
      return "Played";
  }
}

// ── Personal bests ──────────────────────────────────────────────────────────

const MEASURES: MeasureKind[] = ["time", "distance", "height", "points"];

/** Best valid mark per sport + event + measure, computed from the results (not trusted from a stored flag). */
export function personalBests(rows: PassportSource["performanceResults"]): Passport["personalBests"] {
  const best = new Map<string, Passport["personalBests"][number]>();
  for (const r of rows) {
    if (r.status !== "OK" || typeof r.value !== "number" || !Number.isFinite(r.value)) continue;
    if (!MEASURES.includes(r.measure as MeasureKind)) continue;
    const measure = r.measure as MeasureKind;
    const sport = normalizeSport(r.sport);
    const key = `${sport}|${r.eventName.trim().toLowerCase()}|${measure}`;
    const cur = best.get(key);
    const beats = !cur || (betterIsLower(measure) ? r.value < cur.value : r.value > cur.value) || (r.value === cur.value && ms(r.recordedAt) < ms(cur.recordedAt));
    if (beats) {
      best.set(key, {
        sport,
        sportLabel: sportLabel(sport),
        eventName: r.eventName.trim(),
        measure,
        value: r.value,
        display: formatMark(r.value, measure),
        recordedAt: iso(r.recordedAt),
        matchId: r.matchId,
      });
    }
  }
  return [...best.values()].sort((a, b) => a.sportLabel.localeCompare(b.sportLabel) || a.eventName.localeCompare(b.eventName));
}

// ── Skill report ────────────────────────────────────────────────────────────

/** Numeric sport metrics only (e.g. { batting: 4 }); anything else in the JSON is dropped. */
export function cleanMetrics(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(raw))) {
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    if (!/^[A-Za-z][A-Za-z0-9_ ]{0,39}$/.test(k) || FORBIDDEN_KEY.test(k)) continue;
    out[k] = v;
  }
  return out;
}

// ── Assembly ────────────────────────────────────────────────────────────────

export const MATCH_HISTORY_LIMIT = 20;

const ADDED_BY: Record<string, string> = { PARENT: "Parent", COACH: "Coach", ADMIN: "Academy" };

export function buildPassport(src: PassportSource): Passport {
  const statRows: StatRow[] = src.matchStats
    .filter((m) => m.matchStatus !== "ABANDONED")
    .map((m) => ({ matchId: m.matchId, studentId: src.student.id, sport: normalizeSport(m.sport), stats: m.stats, playedAt: m.playedAt }));

  // Sports: batches first (what they train), then anything they have played or been assessed in.
  const sportKeys: string[] = [];
  const addSport = (s: string | null | undefined) => {
    const k = normalizeSport(s);
    if (k && !sportKeys.includes(k)) sportKeys.push(k);
  };
  src.batches.forEach((b) => addSport(b.sport));
  statRows.forEach((r) => addSport(r.sport));
  src.performanceResults.forEach((r) => addSport(r.sport));
  src.skillReports.forEach((r) => addSport(r.sport));
  const batchSports = [...new Set(src.batches.map((b) => normalizeSport(b.sport)).filter(Boolean))];
  const onlySport = batchSports.length === 1 ? batchSports[0] : sportKeys.length === 1 ? sportKeys[0] : null;

  const levels: PassportLevel[] = sportKeys.map((sport) => {
    const rows = statRows.filter((r) => r.sport === sport);
    let won = 0;
    let drawn = 0;
    let decided = 0;
    for (const r of rows) {
      const res = resultOf(r.stats);
      if (res === "W") won++;
      if (res === "D") drawn++;
      if (res !== "-") decided++;
    }
    const winRate = decided ? round((won + drawn * 0.5) / decided, 3) : null;
    const assessment = assessmentFor(sport, src.skillReports, onlySport);
    const fam = familyOf(sport, rows[0]?.stats);
    const lv = sportLevel({ matches: rows.length, winRate, assessment, performanceSport: fam === "performance" });
    return { sport, label: sportLabel(sport), level: lv.level, name: lv.name, matches: rows.length, winRate, assessment, next: lv.next };
  });

  const matches = [...src.matchStats]
    .filter((m) => m.matchStatus !== "ABANDONED")
    .sort((a, b) => ms(b.playedAt) - ms(a.playedAt))
    .slice(0, MATCH_HISTORY_LIMIT)
    .map((m) => {
      const sport = normalizeSport(m.sport);
      return { matchId: m.matchId, title: m.title, sport, sportLabel: sportLabel(sport), playedAt: iso(m.playedAt), result: resultOf(m.stats), line: matchLine(sport, m.stats) };
    });

  const achievements = src.achievements
    .filter((a) => a.status !== "REJECTED")
    .sort((a, b) => ms(b.eventDate) - ms(a.eventDate))
    .map((a) => ({
      id: a.id,
      kind: a.kind,
      title: a.title,
      competition: a.competition,
      level: a.level,
      result: a.result,
      eventDate: iso(a.eventDate),
      // Verified only once academy staff have verified it (athlete.ts review flow). Submitted and
      // coach-reviewed entries are still self-reported.
      verification: (a.status === "VERIFIED" ? "VERIFIED" : "SELF_REPORTED") as Verification,
      verifiedAt: a.status === "VERIFIED" ? isoOrNull(a.verifiedAt) : null,
      addedBy: ADDED_BY[a.submittedByRole] ?? "Academy",
    }));

  const goals = src.goals
    .filter((g) => g.status === "ACTIVE" || g.status === "ACHIEVED")
    .map((g) => ({ id: g.id, title: g.title, metric: g.metric, baseline: g.baseline, target: g.target, dueDate: isoOrNull(g.dueDate), status: g.status, achievedAt: isoOrNull(g.achievedAt) }));

  const latest = [...src.skillReports].sort((a, b) => b.month.localeCompare(a.month))[0];

  return {
    version: 1,
    generatedAt: src.now.toISOString(),
    athlete: { id: src.student.id, name: src.student.name, firstName: firstName(src.student.name) },
    academy: src.academy ? { id: src.academy.id, name: src.academy.name } : null,
    sports: sportKeys.map((key) => ({ key, label: sportLabel(key) })),
    batches: src.batches.map((b) => ({ id: b.id, name: b.name, sport: b.sport, schedule: b.schedule, coachName: b.coachName })),
    attendance: summarizeAttendance(src.attendances, src.now),
    levels,
    seasonStats: aggregateSeason(statRows, defaultSeasonRange(src.now)),
    matches,
    personalBests: personalBests(src.performanceResults),
    achievements,
    goals,
    latestSkillReport: latest
      ? {
          month: latest.month,
          sport: latest.sport,
          technique: latest.technique,
          fitness: latest.fitness,
          discipline: latest.discipline,
          average: round(reportAverage(latest), 1),
          metrics: cleanMetrics(latest.metrics),
          coachName: latest.coachName,
        }
      : null,
  };
}

/** Compact summary for cards (e.g. the parent home). */
export function passportHeadline(p: Passport): {
  topLevel: PassportLevel | null;
  verifiedCount: number;
  selfReportedCount: number;
  lastMatch: Passport["matches"][number] | null;
} {
  const topLevel = [...p.levels].sort((a, b) => b.level - a.level || b.matches - a.matches)[0] ?? null;
  return {
    topLevel,
    verifiedCount: p.achievements.filter((a) => a.verification === "VERIFIED").length,
    selfReportedCount: p.achievements.filter((a) => a.verification === "SELF_REPORTED").length,
    lastMatch: p.matches[0] ?? null,
  };
}
