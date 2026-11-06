// Weekly coach availability. Pure and client-safe.
//
// STORAGE NOT AVAILABLE YET: there is no availability table and ProfessionalProfile has no JSON/text
// field meant for it (headline/bio are public profile text). Saving stays off until a field such as
// `ProfessionalProfile.availability Json?` exists. The editor and this logic are ready for it:
// serializeAvailability() produces the value to store, parseAvailability() reads it back.

export const AVAILABILITY_SAVE_ENABLED = false;
export const AVAILABILITY_FIELD_NEEDED = "ProfessionalProfile.availability Json? (weekly slots, see src/lib/coach/availability.ts)";

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** One weekly slot. Times are minutes from midnight, local to the academy, end exclusive. */
export interface AvailabilitySlot {
  day: Weekday;
  start: number;
  end: number;
}

export const SLOT_STEP_MINUTES = 30;
export const MIN_SLOT_MINUTES = 30;
export const MAX_SLOTS = 42;

export function isWeekday(v: unknown): v is Weekday {
  return typeof v === "string" && (WEEKDAYS as readonly string[]).includes(v);
}

/** "06:30" → 390; null for anything else. Accepts 24:00 as end of day. */
export function parseTime(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > 24 || (h === 24 && min !== 0)) return null;
  return h * 60 + min;
}

/** 390 → "06:30". */
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 390 → "6:30 AM", 1080 → "6 PM". */
export function formatTime12(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const period = h24 < 12 ? "AM" : "PM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return m ? `${h}:${String(m).padStart(2, "0")} ${period}` : `${h} ${period}`;
}

export function slotError(slot: AvailabilitySlot): string | null {
  if (!isWeekday(slot.day)) return "Pick a day.";
  if (!Number.isInteger(slot.start) || !Number.isInteger(slot.end)) return "Times must be whole minutes.";
  if (slot.start < 0 || slot.end > 24 * 60) return "Times must be within the day.";
  if (slot.start % SLOT_STEP_MINUTES || slot.end % SLOT_STEP_MINUTES) return `Use ${SLOT_STEP_MINUTES}-minute steps.`;
  if (slot.end - slot.start < MIN_SLOT_MINUTES) return "End must be after start.";
  return null;
}

const dayIndex = (d: Weekday) => WEEKDAYS.indexOf(d);

/** Sort by day then start, and merge overlapping or touching slots on the same day. */
export function normalizeSlots(slots: AvailabilitySlot[]): AvailabilitySlot[] {
  const sorted = [...slots].sort((a, b) => dayIndex(a.day) - dayIndex(b.day) || a.start - b.start);
  const out: AvailabilitySlot[] = [];
  for (const sl of sorted) {
    const last = out[out.length - 1];
    if (last && last.day === sl.day && sl.start <= last.end) last.end = Math.max(last.end, sl.end);
    else out.push({ ...sl });
  }
  return out;
}

/** Pairs of slots that overlap on the same day (touching end/start doesn't count). */
export function findOverlaps(slots: AvailabilitySlot[]): [AvailabilitySlot, AvailabilitySlot][] {
  const out: [AvailabilitySlot, AvailabilitySlot][] = [];
  for (let i = 0; i < slots.length; i++)
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i];
      const b = slots[j];
      if (a.day === b.day && a.start < b.end && b.start < a.end) out.push([a, b]);
    }
  return out;
}

/** Validate a whole week. Overlaps are merged rather than rejected. */
export function validateWeek(slots: AvailabilitySlot[]): { ok: true; slots: AvailabilitySlot[] } | { ok: false; error: string } {
  if (!Array.isArray(slots)) return { ok: false, error: "Invalid availability." };
  for (const sl of slots) {
    const e = slotError(sl);
    if (e) return { ok: false, error: `${sl?.day ?? "Slot"}: ${e}` };
  }
  const merged = normalizeSlots(slots);
  if (merged.length > MAX_SLOTS) return { ok: false, error: `Up to ${MAX_SLOTS} slots a week.` };
  return { ok: true, slots: merged };
}

/** Total available minutes in the week. */
export function weeklyMinutes(slots: AvailabilitySlot[]): number {
  return normalizeSlots(slots).reduce((n, sl) => n + (sl.end - sl.start), 0);
}

/** Is the coach available for the whole of [start, end) on this day? */
export function isAvailable(slots: AvailabilitySlot[], day: Weekday, start: number, end: number): boolean {
  return normalizeSlots(slots).some((sl) => sl.day === day && sl.start <= start && sl.end >= end);
}

/** JSON value to store (versioned so the shape can change later). */
export function serializeAvailability(slots: AvailabilitySlot[]): { v: 1; slots: { day: Weekday; start: string; end: string }[] } {
  return { v: 1, slots: normalizeSlots(slots).map((sl) => ({ day: sl.day, start: formatTime(sl.start), end: formatTime(sl.end) })) };
}

/** Read a stored value back; invalid entries are dropped. */
export function parseAvailability(raw: unknown): AvailabilitySlot[] {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  const list = value && typeof value === "object" && Array.isArray((value as { slots?: unknown }).slots) ? (value as { slots: unknown[] }).slots : [];
  const slots: AvailabilitySlot[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const { day, start, end } = item as Record<string, unknown>;
    if (!isWeekday(day) || typeof start !== "string" || typeof end !== "string") continue;
    const s = parseTime(start);
    const e = parseTime(end);
    if (s == null || e == null) continue;
    const slot = { day, start: s, end: e };
    if (!slotError(slot)) slots.push(slot);
  }
  return normalizeSlots(slots);
}
