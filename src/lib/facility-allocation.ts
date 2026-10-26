/**
 * V1 Business — facility allocation (pure rules, no DB). A batch is allocated to a court/facility as a series of
 * weekly TurfBooking rows (source LEASE, amount 0) created through the turf booking engine, so the court can never be
 * both allocated to a batch and sold to the public. The series is identified by its leaseGroupId, which encodes the
 * batch: "batch:<batchId>:<random>". No schema change is needed.
 */
import { MAX_HOURS_PER_BOOKING, MAX_LEASE_WEEKS, addDaysStr, isValidDateStr } from "@/lib/turf";

export const ALLOCATION_GROUP_PREFIX = "batch:";
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export const FACILITY_ALLOCATION_DISABLED_ERROR = "Facility allocation is not enabled for this academy yet.";
/** At most this many bookings are created by one allocation (26 weeks × 7 days would be 182). */
export const MAX_ALLOCATION_SLOTS = 120;

export function allocationGroupId(batchId: string, random: string): string {
  return `${ALLOCATION_GROUP_PREFIX}${batchId}:${random}`;
}

/** The batch id encoded in a leaseGroupId, or null when the group is not a batch allocation. */
export function batchIdFromGroup(groupId: string | null | undefined): string | null {
  if (!groupId || !groupId.startsWith(ALLOCATION_GROUP_PREFIX)) return null;
  const rest = groupId.slice(ALLOCATION_GROUP_PREFIX.length);
  const i = rest.indexOf(":");
  const id = i === -1 ? rest : rest.slice(0, i);
  return id || null;
}

/** Weekday (Mon..Sun) of a YYYY-MM-DD calendar date. */
export function weekdayOf(dateStr: string): Weekday {
  const js = new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return WEEKDAYS[(js + 6) % 7];
}

export type AllocationInput = {
  batchId: unknown;
  facilityId: unknown;
  startDate: unknown;
  weekdays: unknown;
  startHour: unknown;
  hours: unknown;
  weeks: unknown;
};

export type ParsedAllocation = {
  batchId: string;
  facilityId: string;
  startDate: string;
  weekdays: Weekday[];
  startHour: number;
  hours: number;
  weeks: number;
};

/** Validate the allocation form. Opening hours are checked separately against the facility. */
export function parseAllocationInput(
  raw: AllocationInput,
  today: string,
): { ok: true; data: ParsedAllocation } | { ok: false; error: string } {
  const batchId = typeof raw.batchId === "string" ? raw.batchId.trim() : "";
  const facilityId = typeof raw.facilityId === "string" ? raw.facilityId.trim() : "";
  if (!batchId) return { ok: false, error: "Pick a batch." };
  if (!facilityId) return { ok: false, error: "Pick a court or facility." };
  const startDate = typeof raw.startDate === "string" ? raw.startDate : "";
  if (!isValidDateStr(startDate)) return { ok: false, error: "Pick a valid start date." };
  if (startDate < today) return { ok: false, error: "The start date has already passed." };
  const list = Array.isArray(raw.weekdays) ? raw.weekdays : [];
  const weekdays = WEEKDAYS.filter((d) => list.includes(d));
  if (weekdays.length === 0) return { ok: false, error: "Pick at least one day of the week." };
  const startHour = Number(raw.startHour);
  const hours = Number(raw.hours);
  const weeks = Number(raw.weeks);
  if (!Number.isInteger(startHour) || startHour < 0 || startHour > 23) return { ok: false, error: "Pick a valid start time." };
  if (!Number.isInteger(hours) || hours < 1 || hours > MAX_HOURS_PER_BOOKING) {
    return { ok: false, error: `Each slot can be 1 to ${MAX_HOURS_PER_BOOKING} hours.` };
  }
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > MAX_LEASE_WEEKS) {
    return { ok: false, error: `Allocate for 1 to ${MAX_LEASE_WEEKS} weeks.` };
  }
  return { ok: true, data: { batchId, facilityId, startDate, weekdays, startHour, hours, weeks } };
}

/** True when [startHour, startHour + hours) fits inside the facility's opening hours. */
export function fitsOpeningHours(startHour: number, hours: number, facility: { openHour: number; closeHour: number }): boolean {
  return startHour >= facility.openHour && startHour + hours <= facility.closeHour;
}

/**
 * Every calendar date of the allocation: the selected weekdays in the `weeks` weeks starting at startDate
 * (startDate counts as day 0 of week 1). Sorted ascending.
 */
export function allocationDates(startDate: string, weekdays: readonly Weekday[], weeks: number): string[] {
  const out: string[] = [];
  const wanted = new Set(weekdays);
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDaysStr(startDate, i);
    if (wanted.has(weekdayOf(d))) out.push(d);
  }
  return out;
}

/** One upcoming batch allocation, as listed on the Operations screen. */
export type AllocationRow = {
  groupId: string;
  batchId: string | null;
  batchName: string | null;
  facilityName: string;
  weekdays: string[];
  startHour: number;
  endHour: number;
  nextDate: string;
  lastDate: string;
  upcoming: number;
};
