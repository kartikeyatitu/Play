// Monthly athlete progress report (Vertical 2, flag `progressReport`).
// Pure and client-safe: no DB access. Built only from real attendance rows and coach skill reports;
// nothing here invents a score or treats an unmarked session as an absence.

import { attendanceStatusOf, firstName } from "@/lib/coach";
import { getSportConfig } from "@/lib/sport-metrics";

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isValidMonth(month: unknown): month is string {
  return typeof month === "string" && MONTH_RE.test(month);
}

/** [start, end) of a "YYYY-MM" month, matching how Session.date is stored (00:00 UTC of the day). */
export function monthWindow(month: string): { start: Date; end: Date } {
  const m = MONTH_RE.exec(month);
  if (!m) throw new Error("Invalid month");
  const y = Number(m[1]);
  const mo = Number(m[2]);
  return { start: new Date(Date.UTC(y, mo - 1, 1)), end: new Date(Date.UTC(y, mo, 1)) };
}

/** The month before "YYYY-MM". */
export function previousMonth(month: string): string {
  const { start } = monthWindow(month);
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
}

/** Resolve the requested month: valid and not after the current month, else the current month. */
export function resolveReportMonth(requested: unknown, currentMonth: string): string {
  if (isValidMonth(requested) && requested <= currentMonth) return requested;
  return currentMonth;
}

export function monthLabel(month: string, locale = "en-IN"): string {
  const { start } = monthWindow(month);
  try {
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(start);
  } catch {
    return month;
  }
}

export interface ReportSession {
  id: string;
  date: Date | string;
  status: string; // SCHEDULED | COMPLETED | CANCELLED
  batchId: string;
}

export interface ReportAttendance {
  sessionId: string;
  isPresent: boolean;
  status?: string | null;
}

export interface ReportSkill {
  month: string;
  technique: number;
  fitness: number;
  discipline: number;
  notes?: string | null;
  sport?: string | null;
  metrics?: unknown;
  coachName?: string | null;
}

export interface ReportEnrollment {
  batchId: string;
  joinedAt: Date | string;
}

export interface MonthlyAttendance {
  held: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  unmarked: number;
  /** (present + late) / held, rounded; null when no sessions were held. */
  pct: number | null;
}

export interface SkillLine {
  key: string;
  label: string;
  value: number;
  previous: number | null;
  delta: number | null;
}

export interface MonthlyProgressReport {
  month: string;
  attendance: MonthlyAttendance;
  skills: SkillLine[] | null;
  average: number | null;
  previousAverage: number | null;
  coachNotes: string | null;
  coachName: string | null;
  sport: string | null;
}

function asMetrics(v: unknown): Record<string, number> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) if (typeof n === "number" && Number.isFinite(n)) out[k] = n;
  return out;
}

/**
 * Ratings the coach actually gave. Unlike unifyMetrics (which fills unrated dimensions with 3 for
 * charts), dimensions beyond the three legacy fields are only included when present in `metrics`.
 */
export function ratedSkills(sport: string | null | undefined, r: ReportSkill): { key: string; label: string; value: number }[] {
  const metrics = asMetrics(r.metrics) ?? {};
  const legacy = [r.technique, r.fitness, r.discipline];
  const out: { key: string; label: string; value: number }[] = [];
  getSportConfig(sport).dimensions.forEach((dim, idx) => {
    const v = metrics[dim.key] ?? (idx < 3 ? legacy[idx] : undefined);
    if (typeof v === "number" && Number.isFinite(v)) out.push({ key: dim.key, label: dim.label, value: v });
  });
  return out;
}

const dayKey = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Build the report for one athlete and one month.
 * - sessions: sessions of the athlete's batches in that month (any status); filtered here.
 * - attendances: the athlete's attendance rows (any; matched by sessionId).
 * - skillReports: the athlete's reports (any months); the month's report and the latest earlier one are used.
 * - now: sessions dated after today are not counted as held.
 */
export function buildMonthlyProgressReport(input: {
  month: string;
  now: Date;
  sessions: ReportSession[];
  attendances: ReportAttendance[];
  enrollments: ReportEnrollment[];
  skillReports: ReportSkill[];
  sport?: string | null;
}): MonthlyProgressReport {
  const { start, end } = monthWindow(input.month);
  const todayKey = dayKey(input.now);
  const joinedByBatch = new Map(input.enrollments.map((e) => [e.batchId, dayKey(e.joinedAt)]));
  const marks = new Map(input.attendances.map((a) => [a.sessionId, a]));

  const att: MonthlyAttendance = { held: 0, present: 0, late: 0, absent: 0, excused: 0, unmarked: 0, pct: null };
  for (const s of input.sessions) {
    const d = new Date(s.date);
    if (d < start || d >= end) continue;
    if (s.status === "CANCELLED") continue;
    const k = dayKey(d);
    if (k > todayKey) continue;
    const joined = joinedByBatch.get(s.batchId);
    if (joined === undefined || k < joined) continue; // not enrolled in this batch yet
    att.held++;
    const status = attendanceStatusOf(marks.get(s.id));
    if (status === "PRESENT") att.present++;
    else if (status === "LATE") att.late++;
    else if (status === "ABSENT") att.absent++;
    else if (status === "EXCUSED") att.excused++;
    else att.unmarked++;
  }
  att.pct = att.held > 0 ? Math.round(((att.present + att.late) / att.held) * 100) : null;

  const current = input.skillReports.find((r) => r.month === input.month) ?? null;
  const prev =
    input.skillReports
      .filter((r) => r.month < input.month)
      .sort((a, b) => (a.month < b.month ? 1 : -1))[0] ?? null;

  const sport = current?.sport ?? input.sport ?? null;
  let skills: SkillLine[] | null = null;
  let average: number | null = null;
  let previousAverage: number | null = null;
  if (current) {
    const cur = ratedSkills(sport, current);
    const before = prev ? ratedSkills(sport, prev) : null;
    const prevByKey = new Map((before ?? []).map((l) => [l.key, l.value]));
    skills = cur.map((l) => {
      const p = prevByKey.has(l.key) ? (prevByKey.get(l.key) as number) : null;
      return { key: l.key, label: l.label, value: l.value, previous: p, delta: p === null ? null : l.value - p };
    });
    average = cur.length ? round1(cur.reduce((s, l) => s + l.value, 0) / cur.length) : null;
    if (before && before.length) previousAverage = round1(before.reduce((s, l) => s + l.value, 0) / before.length);
  }

  return {
    month: input.month,
    attendance: att,
    skills,
    average,
    previousAverage,
    coachNotes: current?.notes?.trim() || null,
    coachName: current?.coachName ?? null,
    sport,
  };
}

/**
 * Plain-text summary for a WhatsApp deep link. Contains only the athlete's first name, the academy
 * name and the report figures: no medical data, DOB, phone numbers or fees.
 */
export function progressReportShareText(
  report: MonthlyProgressReport,
  ctx: { studentName: string; academyName?: string | null; monthLabel: string; link?: string | null },
): string {
  const name = firstName(ctx.studentName) || ctx.studentName;
  const lines: string[] = [`*${name} — progress report, ${ctx.monthLabel}*`];
  const a = report.attendance;
  if (a.held === 0) {
    lines.push("No sessions were held this month.");
  } else {
    lines.push(`Attendance: ${a.present + a.late}/${a.held} sessions (${a.pct}%)`);
    if (a.unmarked > 0) lines.push(`(${a.unmarked} session${a.unmarked === 1 ? "" : "s"} not marked)`);
  }
  if (report.skills && report.average !== null) {
    lines.push("");
    lines.push(`Coach rating: ${report.average}/5${report.previousAverage !== null ? ` (last time ${report.previousAverage}/5)` : ""}`);
    for (const s of report.skills) {
      const d = s.delta === null || s.delta === 0 ? "" : s.delta > 0 ? ` (+${s.delta})` : ` (${s.delta})`;
      lines.push(`• ${s.label}: ${s.value}/5${d}`);
    }
  } else {
    lines.push("");
    lines.push("Coach evaluation not submitted for this month yet.");
  }
  if (report.coachNotes) {
    lines.push("");
    lines.push(`Coach's note: "${report.coachNotes}"`);
  }
  if (ctx.link) {
    lines.push("");
    lines.push(`Full report: ${ctx.link}`);
  }
  if (ctx.academyName) {
    lines.push("");
    lines.push(`— ${ctx.academyName}`);
  }
  return lines.join("\n");
}
