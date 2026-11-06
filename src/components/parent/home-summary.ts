// Pure helpers for the parent home "top card" (one per child). No DB, no clock: callers pass `now`.
// All calendar maths is academy-local (IST by default). Sessions are stored at 00:00 UTC of their
// academy-local date (see istToday in src/lib/fees.ts), so a session's date is its ISO date part.

import { scheduleRunsOn } from "@/lib/fees";
import { localDateString } from "@/lib/fee-aging";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MS = 86_400_000;

function addDays(ymd: string, n: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}
function weekdayOf(ymd: string): string {
  return WEEKDAYS[new Date(`${ymd}T00:00:00Z`).getUTCDay()];
}
function sessionDay(d: string | Date): string {
  return (typeof d === "string" ? d : d.toISOString()).slice(0, 10);
}

/** Monday..Sunday (YYYY-MM-DD) of the academy-local week containing `now`. */
export function weekRange(now: Date, timeZone = "Asia/Kolkata"): { start: string; end: string; today: string } {
  const today = localDateString(now, timeZone);
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const start = addDays(today, -(dow === 0 ? 6 : dow - 1));
  return { start, end: addDays(start, 6), today };
}

export interface WeekSession {
  id: string;
  date: string | Date;
  status: string;
}

/**
 * This week's attendance: sessions held for the child's batches from Monday to today (cancelled
 * sessions excluded) and how many the child was marked present at.
 */
export function weekAttendance(
  sessions: WeekSession[],
  presentSessionIds: Iterable<string>,
  now: Date,
  timeZone = "Asia/Kolkata",
): { present: number; total: number } {
  const { start, today } = weekRange(now, timeZone);
  const present = new Set(presentSessionIds);
  let total = 0;
  let p = 0;
  const seen = new Set<string>();
  for (const s of sessions) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    const day = sessionDay(s.date);
    if (s.status === "CANCELLED" || day < start || day > today) continue;
    total++;
    if (present.has(s.id)) p++;
  }
  return { present: p, total };
}

/** Minutes after midnight of the first clock time in a schedule ("Mon/Wed 4:30 PM", "6am", "17:00"). */
export function scheduleTime(schedule: string | null | undefined): { minutes: number; label: string } | null {
  if (!schedule) return null;
  const m = schedule.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) || schedule.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  const ampm = (m[3] || "").toLowerCase();
  if (h > 23 || min > 59) return null;
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  const label = `${((h + 11) % 12) + 1}:${String(min).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  return { minutes: h * 60 + min, label };
}

export interface NextSessionBatch {
  id: string;
  name: string;
  schedule: string | null;
}

export interface NextSession {
  date: string; // YYYY-MM-DD
  batchName: string;
  time: string | null;
}

/**
 * Next session across the child's batches within `horizonDays`: the earliest day a batch's schedule
 * runs on (from today; today only if its start time has not passed), skipping days with a CANCELLED
 * session for that batch, and also considering explicitly SCHEDULED future sessions.
 */
export function nextSession(
  batches: NextSessionBatch[],
  sessions: Array<{ batchId: string; date: string | Date; status: string }>,
  now: Date,
  timeZone = "Asia/Kolkata",
  horizonDays = 14,
): NextSession | null {
  const today = localDateString(now, timeZone);
  let nowMinutes = 0;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
    nowMinutes = Number(parts.find((p) => p.type === "hour")?.value || 0) * 60 + Number(parts.find((p) => p.type === "minute")?.value || 0);
  } catch {
    nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  }
  const cancelled = new Set(sessions.filter((s) => s.status === "CANCELLED").map((s) => `${s.batchId}|${sessionDay(s.date)}`));
  const candidates: Array<NextSession & { minutes: number }> = [];

  for (const b of batches) {
    const t = scheduleTime(b.schedule);
    for (let i = 0; i <= horizonDays; i++) {
      const day = addDays(today, i);
      if (cancelled.has(`${b.id}|${day}`)) continue;
      if (scheduleRunsOn(b.schedule, weekdayOf(day)) !== true) continue;
      if (i === 0 && t && t.minutes <= nowMinutes) continue;
      candidates.push({ date: day, batchName: b.name, time: t?.label ?? null, minutes: t?.minutes ?? 24 * 60 });
      break;
    }
  }
  for (const s of sessions) {
    if (s.status !== "SCHEDULED") continue;
    const day = sessionDay(s.date);
    if (day < today) continue;
    const b = batches.find((x) => x.id === s.batchId);
    if (!b) continue;
    const t = scheduleTime(b.schedule);
    if (day === today && t && t.minutes <= nowMinutes) continue;
    candidates.push({ date: day, batchName: b.name, time: t?.label ?? null, minutes: t?.minutes ?? 24 * 60 });
  }
  candidates.sort((a, z) => a.date.localeCompare(z.date) || a.minutes - z.minutes);
  const first = candidates[0];
  return first ? { date: first.date, batchName: first.batchName, time: first.time } : null;
}

export interface HomeFeeRecord {
  id: string;
  month: string;
  amount: number;
  status: string;
}

export interface HomeFeeStatus {
  state: "OVERDUE" | "DUE" | "AWAITING" | "CLEAR";
  /** PENDING amount still to pay */
  dueAmount: number;
  /** Reported as paid, waiting for the academy to confirm */
  awaitingAmount: number;
  /** YYYY-MM-DD: oldest unpaid due's date, or the 1st of next month when nothing is owed */
  nextDueDate: string;
  /** Oldest unpaid record (what the Pay button settles first) */
  payRecord: HomeFeeRecord | null;
}

/** Fee status for the top card. Dues fall on the 1st of their month (as in fee-aging.ts). */
export function homeFeeStatus(records: HomeFeeRecord[], now: Date, timeZone = "Asia/Kolkata"): HomeFeeStatus {
  const today = localDateString(now, timeZone);
  const open = records
    .filter((r) => (Number(r.amount) || 0) > 0 && (r.status === "PENDING" || r.status === "PENDING_VERIFICATION"))
    .sort((a, z) => a.month.localeCompare(z.month));
  const pending = open.filter((r) => r.status === "PENDING");
  const dueAmount = pending.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const awaitingAmount = open.filter((r) => r.status === "PENDING_VERIFICATION").reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const [y, m] = today.split("-").map(Number);
  const nextMonthFirst = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const nextDueDate = pending[0] ? `${pending[0].month}-01` : nextMonthFirst;
  const state: HomeFeeStatus["state"] = pending.length
    ? nextDueDate < today
      ? "OVERDUE"
      : "DUE"
    : awaitingAmount > 0
      ? "AWAITING"
      : "CLEAR";
  return { state, dueAmount, awaitingAmount, nextDueDate, payRecord: pending[0] ?? open[0] ?? null };
}

export interface HomeSkillReport {
  month: string;
  notes: string | null;
  technique: number;
  fitness: number;
  discipline: number;
  createdAt: string | Date;
}

/** Latest progress note: newest SkillReport by month (then created time). */
export function latestProgressNote(reports: HomeSkillReport[]): { month: string; note: string | null; average: number } | null {
  if (!reports.length) return null;
  const r = [...reports].sort(
    (a, z) => z.month.localeCompare(a.month) || new Date(z.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
  const note = (r.notes || "").trim();
  const average = Math.round(((r.technique + r.fitness + r.discipline) / 3) * 10) / 10;
  return { month: r.month, note: note ? note.slice(0, 280) : null, average };
}

/**
 * Academy leaderboard as a parent may see it: their own children keep their name and id; every
 * other child becomes "Athlete" with a rank-only id, so no other family's child is named or linkable.
 */
export function privateLeaderboard(
  rows: Array<{ id: string; name: string; points: number }>,
  ownChildIds: Iterable<string>,
): Array<{ id: string; name: string; points: number }> {
  const own = new Set(ownChildIds);
  return rows.map((r, i) => (own.has(r.id) ? { id: r.id, name: r.name, points: r.points } : { id: `rank-${i + 1}`, name: "Athlete", points: r.points }));
}
