// Pure helpers for hourly turf/court slots. Safe for both server and client code.
// Everything a person sees is in the org's timezone; everything stored is UTC.
// TODO: accept org timezone parameter instead of defaulting to IST.

/** @deprecated Pass org timezone instead of using hardcoded IST offset. */
const IST_OFFSET = "+05:30";
export const MAX_HOURS_PER_BOOKING = 6;
export const MAX_LEASE_WEEKS = 26;
export const HOLD_MINUTES = 10;
export const UPI_HOLD_MINUTES = 15;
/** After a customer taps "I've paid" by UPI, the slot stays blocked this long for the owner to verify. */
export const UPI_VERIFY_HOURS = 3;

export function isValidDateStr(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00${IST_OFFSET}`);
  return !Number.isNaN(d.getTime()) && d.toISOString().length > 0;
}

/** UTC instant for `hour`:00 IST on the given IST calendar date. hour may be 24 (= midnight next day). */
export function slotInstant(dateStr: string, hour: number): Date {
  const base = new Date(`${dateStr}T00:00:00${IST_OFFSET}`);
  return new Date(base.getTime() + hour * 3600_000);
}

/** [start, end) of an IST calendar day as UTC instants. */
export function istDayRange(dateStr: string): { start: Date; end: Date } {
  return { start: slotInstant(dateStr, 0), end: slotInstant(dateStr, 24) };
}

/** Today's date in IST as YYYY-MM-DD. */
export function todayIstStr(now: Date = new Date()): string {
  return new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

export function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** IST hour (0-23) of a UTC instant. */
export function istHourOf(d: Date): number {
  return new Date(d.getTime() + 5.5 * 3600_000).getUTCHours();
}

/** IST YYYY-MM-DD of a UTC instant. */
export function istDateOf(d: Date): string {
  return new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

export function formatHour(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  const suffix = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12} ${suffix}`;
}

export function formatRange(startHour: number, hours: number): string {
  return `${formatHour(startHour)} – ${formatHour(startHour + hours)}`;
}

export function formatDateLabel(dateStr: string, tz = "Asia/Kolkata", locale = "en"): string {
  const d = new Date(`${dateStr}T12:00:00${IST_OFFSET}`);
  return d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", timeZone: tz });
}

export const ACTIVE_STATUSES = ["HOLD", "CONFIRMED"] as const;

/** @deprecated Use formatMoney from i18n.ts for org-aware formatting. */
export function rupees(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
