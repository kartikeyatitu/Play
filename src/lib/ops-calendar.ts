/**
 * V1 Business — operational calendar (pure, no DB). Builds a per-day view of an academy's operations from rows the
 * server already loaded: recorded sessions, batches with their free-text schedules (planned occurrences), trials,
 * holidays and court allocations. Nothing is invented: a batch whose schedule cannot be parsed is listed as
 * "unscheduled" instead of being placed on a day.
 */
import { scheduleRunsOn } from "@/lib/fees";
import { addDaysStr, isValidDateStr } from "@/lib/turf";
import { weekdayOf } from "@/lib/facility-allocation";

export const MAX_CALENDAR_DAYS = 31;
export const OPS_CALENDAR_DISABLED_ERROR = "The operations calendar is not enabled for this academy yet.";

export type CalBatch = {
  id: string;
  name: string;
  sport: string;
  schedule: string | null;
  coachName: string | null;
  branchName?: string | null;
};
/** date = YYYY-MM-DD calendar day the row belongs to (already converted by the caller). */
export type CalSession = { batchId: string; date: string; status: string; marked: number; present: number };
export type CalTrial = { id: string; batchId: string; date: string; status: string; childFirstName: string };
export type CalHoliday = { date: string; title: string };
export type CalAllocation = { batchId: string | null; facilityName: string; date: string; startHour: number; endHour: number; status: string };

export type CalendarItem =
  | { kind: "SESSION"; batchId: string; batchName: string; sport: string; coachName: string | null; branchName: string | null; status: string; marked: number; present: number; timeMinutes: number | null }
  | { kind: "PLANNED"; batchId: string; batchName: string; sport: string; coachName: string | null; branchName: string | null; onHoliday: boolean; timeMinutes: number | null }
  | { kind: "TRIAL"; id: string; batchId: string; batchName: string; status: string; childFirstName: string; timeMinutes: number | null }
  | { kind: "ALLOCATION"; batchId: string | null; batchName: string | null; facilityName: string; startHour: number; endHour: number; timeMinutes: number };

export type CalendarDay = { date: string; weekday: string; holidays: string[]; items: CalendarItem[] };

export type CalendarResult = { days: CalendarDay[]; unscheduledBatches: { id: string; name: string; schedule: string | null }[] };

/** Clamp/validate a requested range. Returns null when the start date is invalid. */
export function calendarRange(start: unknown, days: unknown): { start: string; days: number } | null {
  if (!isValidDateStr(start)) return null;
  const n = Math.round(Number(days));
  return { start, days: Number.isFinite(n) ? Math.min(MAX_CALENDAR_DAYS, Math.max(1, n)) : 7 };
}

/** Monday on or before the given date. */
export function weekStart(dateStr: string): string {
  const idx = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekdayOf(dateStr));
  return addDaysStr(dateStr, -idx);
}

/**
 * Start time (minutes after midnight) written in a free-text schedule: "Mon/Wed 4:00 PM" → 960, "6am" → 360,
 * "17:30" → 1050. Returns null when no time is present.
 */
export function scheduleTimeMinutes(schedule: string | null | undefined): number | null {
  if (!schedule) return null;
  const s = schedule.toLowerCase();
  const ampm = s.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/);
  if (ampm) {
    let h = Number(ampm[1]) % 12;
    if (ampm[3] === "pm") h += 12;
    const m = ampm[2] ? Number(ampm[2]) : 0;
    if (h < 24 && m < 60) return h * 60 + m;
  }
  const h24 = s.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (h24) return Number(h24[1]) * 60 + Number(h24[2]);
  return null;
}

function sortKey(i: CalendarItem): number {
  return i.timeMinutes ?? 24 * 60 + 1;
}

export function buildOpsCalendar(input: {
  start: string;
  days: number;
  batches: CalBatch[];
  sessions: CalSession[];
  trials: CalTrial[];
  holidays: CalHoliday[];
  allocations: CalAllocation[];
}): CalendarResult {
  const batchById = new Map(input.batches.map((b) => [b.id, b]));
  const dates = Array.from({ length: input.days }, (_, i) => addDaysStr(input.start, i));
  const unscheduled = input.batches.filter((b) => !b.schedule || scheduleRunsOn(b.schedule, "Mon") === null);

  const days: CalendarDay[] = dates.map((date) => {
    const weekday = weekdayOf(date);
    const holidays = input.holidays.filter((h) => h.date === date).map((h) => h.title);
    const items: CalendarItem[] = [];
    const sessionsToday = input.sessions.filter((s) => s.date === date);
    const recorded = new Set(sessionsToday.map((s) => s.batchId));

    for (const s of sessionsToday) {
      const b = batchById.get(s.batchId);
      if (!b) continue;
      items.push({
        kind: "SESSION",
        batchId: b.id,
        batchName: b.name,
        sport: b.sport,
        coachName: b.coachName,
        branchName: b.branchName ?? null,
        status: s.status,
        marked: s.marked,
        present: s.present,
        timeMinutes: scheduleTimeMinutes(b.schedule),
      });
    }
    for (const b of input.batches) {
      if (recorded.has(b.id)) continue; // a recorded session replaces the plan
      if (scheduleRunsOn(b.schedule, weekday) !== true) continue;
      items.push({
        kind: "PLANNED",
        batchId: b.id,
        batchName: b.name,
        sport: b.sport,
        coachName: b.coachName,
        branchName: b.branchName ?? null,
        onHoliday: holidays.length > 0,
        timeMinutes: scheduleTimeMinutes(b.schedule),
      });
    }
    for (const t of input.trials) {
      if (t.date !== date) continue;
      const b = batchById.get(t.batchId);
      items.push({
        kind: "TRIAL",
        id: t.id,
        batchId: t.batchId,
        batchName: b?.name ?? "Batch",
        status: t.status,
        childFirstName: t.childFirstName,
        timeMinutes: b ? scheduleTimeMinutes(b.schedule) : null,
      });
    }
    for (const a of input.allocations) {
      if (a.date !== date) continue;
      items.push({
        kind: "ALLOCATION",
        batchId: a.batchId,
        batchName: a.batchId ? batchById.get(a.batchId)?.name ?? null : null,
        facilityName: a.facilityName,
        startHour: a.startHour,
        endHour: a.endHour,
        timeMinutes: a.startHour * 60,
      });
    }
    items.sort((x, y) => sortKey(x) - sortKey(y));
    return { date, weekday, holidays, items };
  });

  return { days, unscheduledBatches: unscheduled.map((b) => ({ id: b.id, name: b.name, schedule: b.schedule })) };
}

/** First name only — the calendar never shows a minor's full name. */
export function firstNameOnly(name: string | null | undefined): string {
  const first = (name || "").trim().split(/\s+/)[0];
  return first || "Child";
}
