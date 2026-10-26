/**
 * V1 Business — unified operations calendar (pure, no DB). Builds a per-day view of an academy's operations from rows
 * the server already loaded: recorded sessions, batches with their free-text schedules (planned occurrences), trials,
 * holidays, court allocations, turf/court bookings, academy leases and maintenance blocks. Nothing is invented: a
 * batch whose schedule cannot be parsed is listed as "unscheduled" instead of being placed on a day.
 *
 * Conflicts (coach or court double-allocated) are detected over the whole result BEFORE filters are applied, so a
 * filtered view still shows that a visible item clashes with something hidden.
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
  coachId?: string | null;
  branchName?: string | null;
};
/** date = YYYY-MM-DD calendar day the row belongs to (already converted by the caller). */
export type CalSession = { batchId: string; date: string; status: string; marked: number; present: number };
export type CalTrial = { id: string; batchId: string; date: string; status: string; childFirstName: string };
export type CalHoliday = { date: string; title: string };
export type CalAllocation = {
  batchId: string | null;
  facilityName: string;
  facilityId?: string | null;
  date: string;
  startHour: number;
  endHour: number;
  status: string;
};
/** A court/turf booking that is not a batch allocation. date/minutes are already in the org's timezone. */
export type BookingKind = "BOOKING" | "LEASE" | "BLOCK";
export type CalBooking = {
  id: string;
  facilityId: string;
  facilityName: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  kind: BookingKind;
  status: string;
  customerFirstName: string | null;
};

/** How long a batch session is assumed to occupy its coach when no court allocation gives the real interval. */
export const ASSUMED_SESSION_MINUTES = 60;
/** Booking statuses that occupy a court. */
export const OCCUPYING_BOOKING_STATUSES = ["HOLD", "CONFIRMED", "COMPLETED", "PAID_CONFLICT", "NO_SHOW"];

export type CalConflict = { type: "COACH" | "FACILITY"; label: string };

type BatchRef = { sport: string; coachId: string | null; coachName: string | null; branchName: string | null };
type Conflicts = { conflicts: CalConflict[] };

export type CalendarItem =
  | ({ kind: "SESSION"; batchId: string; batchName: string; status: string; marked: number; present: number; timeMinutes: number | null } & BatchRef & Conflicts)
  | ({ kind: "PLANNED"; batchId: string; batchName: string; onHoliday: boolean; timeMinutes: number | null } & BatchRef & Conflicts)
  | ({ kind: "TRIAL"; id: string; batchId: string; batchName: string; status: string; childFirstName: string; timeMinutes: number | null } & BatchRef & Conflicts)
  | ({ kind: "ALLOCATION"; batchId: string | null; batchName: string | null; facilityName: string; facilityId: string | null; startHour: number; endHour: number; timeMinutes: number } & Partial<BatchRef> & Conflicts)
  | ({ kind: "BOOKING"; id: string; bookingKind: BookingKind; facilityId: string; facilityName: string; status: string; customerFirstName: string | null; startMinutes: number; endMinutes: number; timeMinutes: number } & Conflicts);

export type CalendarDay = { date: string; weekday: string; holidays: string[]; items: CalendarItem[] };

export type CalendarFilterOptions = {
  coaches: { id: string; name: string }[];
  sports: string[];
  branches: string[];
  facilities: { id: string; name: string }[];
};

export type CalendarResult = {
  days: CalendarDay[];
  unscheduledBatches: { id: string; name: string; schedule: string | null }[];
  filters: CalendarFilterOptions;
  conflictCount: number;
};

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
  bookings?: CalBooking[];
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
        ...batchRef(b),
        conflicts: [],
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
        ...batchRef(b),
        conflicts: [],
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
        ...(b ? batchRef(b) : { sport: "", coachId: null, coachName: null, branchName: null }),
        conflicts: [],
        status: t.status,
        childFirstName: t.childFirstName,
        timeMinutes: b ? scheduleTimeMinutes(b.schedule) : null,
      });
    }
    for (const a of input.allocations) {
      if (a.date !== date) continue;
      const b = a.batchId ? batchById.get(a.batchId) : undefined;
      items.push({
        kind: "ALLOCATION",
        batchId: a.batchId,
        batchName: b?.name ?? null,
        ...(b ? batchRef(b) : {}),
        facilityName: a.facilityName,
        facilityId: a.facilityId ?? null,
        startHour: a.startHour,
        endHour: a.endHour,
        timeMinutes: a.startHour * 60,
        conflicts: [],
      });
    }
    for (const k of input.bookings ?? []) {
      if (k.date !== date) continue;
      items.push({
        kind: "BOOKING",
        id: k.id,
        bookingKind: k.kind,
        facilityId: k.facilityId,
        facilityName: k.facilityName,
        status: k.status,
        customerFirstName: k.customerFirstName,
        startMinutes: k.startMinutes,
        endMinutes: k.endMinutes,
        timeMinutes: k.startMinutes,
        conflicts: [],
      });
    }
    detectConflicts(items);
    items.sort((x, y) => sortKey(x) - sortKey(y));
    return { date, weekday, holidays, items };
  });

  return {
    days,
    unscheduledBatches: unscheduled.map((b) => ({ id: b.id, name: b.name, schedule: b.schedule })),
    filters: filterOptions(input.batches, input.allocations, input.bookings ?? []),
    conflictCount: days.reduce((n, d) => n + d.items.filter((i) => i.conflicts.length > 0).length, 0),
  };
}

function batchRef(b: CalBatch): BatchRef {
  return { sport: b.sport, coachId: b.coachId ?? null, coachName: b.coachName, branchName: b.branchName ?? null };
}

function filterOptions(batches: CalBatch[], allocations: CalAllocation[], bookings: CalBooking[]): CalendarFilterOptions {
  const coaches = new Map<string, string>();
  const sports = new Set<string>();
  const branches = new Set<string>();
  const facilities = new Map<string, string>();
  for (const b of batches) {
    if (b.coachId) coaches.set(b.coachId, b.coachName || "Coach");
    if (b.sport) sports.add(b.sport);
    if (b.branchName) branches.add(b.branchName);
  }
  for (const a of allocations) if (a.facilityId) facilities.set(a.facilityId, a.facilityName);
  for (const k of bookings) facilities.set(k.facilityId, k.facilityName);
  const byName = (x: { name: string }, y: { name: string }) => x.name.localeCompare(y.name);
  return {
    coaches: [...coaches].map(([id, name]) => ({ id, name })).sort(byName),
    sports: [...sports].sort(),
    branches: [...branches].sort(),
    facilities: [...facilities].map(([id, name]) => ({ id, name })).sort(byName),
  };
}

type Interval = { item: CalendarItem; key: string; start: number; end: number; ref: string };

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Mark items that clash on one day (mutates item.conflicts):
 *  - FACILITY: two occupying bookings/allocations on the same court overlap in time.
 *  - COACH: two different batches with the same coach overlap. A batch's interval is its court allocation that day
 *    when there is one, otherwise schedule start + ASSUMED_SESSION_MINUTES. Cancelled sessions never clash.
 */
export function detectConflicts(items: CalendarItem[]): void {
  const facility: Interval[] = [];
  const coach: Interval[] = [];
  const allocByBatch = new Map<string, { start: number; end: number }>();

  for (const it of items) {
    if (it.kind === "ALLOCATION") {
      const iv = { start: it.startHour * 60, end: (it.endHour || 24) * 60 };
      if (it.facilityId) facility.push({ item: it, key: it.facilityId, ...iv, ref: `alloc:${it.batchId}:${iv.start}` });
      if (it.batchId && !allocByBatch.has(it.batchId)) allocByBatch.set(it.batchId, iv);
    } else if (it.kind === "BOOKING" && OCCUPYING_BOOKING_STATUSES.includes(it.status)) {
      facility.push({ item: it, key: it.facilityId, start: it.startMinutes, end: it.endMinutes || 24 * 60, ref: `book:${it.id}` });
    }
  }
  for (const it of items) {
    if (it.kind !== "SESSION" && it.kind !== "PLANNED") continue;
    if (it.kind === "SESSION" && it.status === "CANCELLED") continue;
    if (!it.coachId) continue;
    const alloc = allocByBatch.get(it.batchId);
    const start = alloc?.start ?? it.timeMinutes;
    if (start === null || start === undefined) continue;
    const end = alloc?.end ?? start + ASSUMED_SESSION_MINUTES;
    coach.push({ item: it, key: it.coachId, start, end, ref: it.batchId });
  }

  const mark = (list: Interval[], type: CalConflict["type"], label: (other: Interval) => string) => {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.key !== b.key || a.ref === b.ref || !overlaps(a, b)) continue;
        push(a.item, { type, label: label(b) });
        push(b.item, { type, label: label(a) });
      }
    }
  };
  mark(facility, "FACILITY", (o) => `Court clash with ${describe(o.item)}`);
  mark(coach, "COACH", (o) => `Coach clash with ${describe(o.item)}`);
}

function push(item: CalendarItem, c: CalConflict) {
  if (!item.conflicts.some((x) => x.type === c.type && x.label === c.label)) item.conflicts.push(c);
}

function describe(it: CalendarItem): string {
  switch (it.kind) {
    case "BOOKING":
      return it.bookingKind === "BLOCK" ? "a maintenance block" : it.bookingKind === "LEASE" ? "a lease" : "a booking";
    case "ALLOCATION":
      return it.batchName ? `${it.batchName} (court)` : "a court allocation";
    case "SESSION":
    case "PLANNED":
    case "TRIAL":
      return it.batchName;
  }
}

export type CalendarFilters = { coachId?: string | null; sport?: string | null; branch?: string | null; facilityId?: string | null };

/**
 * Narrow a calendar to one coach / sport / branch / court. Batch-less bookings (customer bookings, leases, blocks)
 * only match a facility filter. Conflict markers computed on the full calendar are kept.
 */
export function filterCalendar(days: CalendarDay[], f: CalendarFilters): CalendarDay[] {
  const active = Boolean(f.coachId || f.sport || f.branch || f.facilityId);
  if (!active) return days;
  return days.map((d) => {
    const batchesOnFacility = new Set(
      d.items.filter((i) => i.kind === "ALLOCATION" && i.facilityId === f.facilityId && i.batchId).map((i) => (i as { batchId: string }).batchId),
    );
    const items = d.items.filter((it) => {
      if (it.kind === "BOOKING") return !f.coachId && !f.sport && !f.branch && it.facilityId === f.facilityId;
      const ref = it as Partial<BatchRef> & { batchId?: string | null };
      if (f.coachId && ref.coachId !== f.coachId) return false;
      if (f.sport && ref.sport !== f.sport) return false;
      if (f.branch && ref.branchName !== f.branch) return false;
      if (f.facilityId) {
        if (it.kind === "ALLOCATION") return it.facilityId === f.facilityId;
        return Boolean(ref.batchId && batchesOnFacility.has(ref.batchId));
      }
      return true;
    });
    return { ...d, items };
  });
}

/** First name only — the calendar never shows a minor's full name. */
export function firstNameOnly(name: string | null | undefined): string {
  const first = (name || "").trim().split(/\s+/)[0];
  return first || "Child";
}
