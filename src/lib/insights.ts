/**
 * Owner insights (analytics step 1) — pure functions, no I/O.
 * Daily snapshot, fee ageing and 12-month trends. Loader: src/lib/insights-data.ts.
 *
 * Definitions (keep in sync with docs/ARCHITECTURE.md#metrics):
 *  - A fee belongs to its fee month (YYYY-MM) and is due from the 1st of that month.
 *  - Fee ageing = how many whole months behind the current month an unpaid fee's month is.
 *  - "Students billed" in a month = fee records for that month (one per student per month).
 *  - Attendance rate = present ÷ marked, over sessions that were not cancelled.
 *  - "Received" = sum of fees whose paidAt falls in the period (cash view), in the academy's timezone.
 */

export type MonthKey = string; // YYYY-MM

export function isMonthKey(v: unknown): v is MonthKey {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

/** Month n steps from `month` (negative = earlier). */
export function addMonths(month: MonthKey, n: number): MonthKey {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The `count` months ending at `current`, oldest first. */
export function lastNMonths(current: MonthKey, count: number): MonthKey[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => addMonths(current, i - (count - 1)));
}

/** Whole months from `month` to `current` (0 = same month; negative = future). */
export function monthsBehind(month: MonthKey, current: MonthKey): number {
  const [y1, m1] = month.split("-").map(Number);
  const [y2, m2] = current.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

/** Short label, e.g. "Oct 26". */
export function monthLabel(month: MonthKey): string {
  const [y, m] = month.split("-").map(Number);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[m - 1]} ${String(y).slice(2)}`;
}

/* ---------------- Fee ageing ---------------- */

export const AGEING_BUCKETS = [
  { key: "current", label: "This month" },
  { key: "m1", label: "1 month late" },
  { key: "m2", label: "2 months late" },
  { key: "m3plus", label: "3+ months late" },
] as const;
export type AgeingKey = (typeof AGEING_BUCKETS)[number]["key"];
export type AgeingBucket = { key: AgeingKey; label: string; amount: number; count: number };

/** Group unpaid fees by how late they are. Fees for future months are ignored (not yet due). */
export function feeAgeing(unpaid: ReadonlyArray<{ month: string; amount: number }>, current: MonthKey): AgeingBucket[] {
  const out = AGEING_BUCKETS.map((b) => ({ key: b.key as AgeingKey, label: b.label, amount: 0, count: 0 }));
  for (const f of unpaid) {
    if (!isMonthKey(f.month)) continue;
    const behind = monthsBehind(f.month, current);
    if (behind < 0) continue;
    const idx = behind >= 3 ? 3 : behind;
    out[idx].amount += Math.max(0, f.amount || 0);
    out[idx].count += 1;
  }
  for (const b of out) b.amount = Math.round(b.amount * 100) / 100;
  return out;
}

/* ---------------- Trends ---------------- */

export type TrendPoint = {
  month: MonthKey;
  label: string;
  billed: number;
  collected: number;
  received: number;
  studentsBilled: number;
  newStudents: number;
  attendanceRate: number | null;
  collectionRate: number | null;
};

export type TrendInput = {
  months: MonthKey[];
  /** Fee records in the window: fee month, amount, status. */
  fees: ReadonlyArray<{ month: string; amount: number; status: string }>;
  /** Paid fees bucketed by the month their payment arrived (academy timezone). */
  receivedByMonth: ReadonlyMap<MonthKey, number>;
  /** New students by creation month (academy timezone). */
  newStudentsByMonth: ReadonlyMap<MonthKey, number>;
  /** Attendance by session month, cancelled sessions excluded. */
  attendanceByMonth: ReadonlyMap<MonthKey, { present: number; marked: number }>;
};

export function buildTrends(input: TrendInput): TrendPoint[] {
  const rows = new Map<MonthKey, { billed: number; collected: number; students: number }>();
  for (const m of input.months) rows.set(m, { billed: 0, collected: 0, students: 0 });
  for (const f of input.fees) {
    const r = rows.get(f.month);
    if (!r) continue;
    const amt = Math.max(0, f.amount || 0);
    r.billed += amt;
    r.students += 1;
    if (f.status === "PAID") r.collected += amt;
  }
  return input.months.map((m) => {
    const r = rows.get(m)!;
    const att = input.attendanceByMonth.get(m);
    return {
      month: m,
      label: monthLabel(m),
      billed: round2(r.billed),
      collected: round2(r.collected),
      received: round2(input.receivedByMonth.get(m) ?? 0),
      studentsBilled: r.students,
      newStudents: input.newStudentsByMonth.get(m) ?? 0,
      attendanceRate: att && att.marked > 0 ? att.present / att.marked : null,
      collectionRate: r.billed > 0 ? r.collected / r.billed : null,
    };
  });
}

/** Relative change (0.12 = +12%); null when there is no base to compare against. */
export function pctChange(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

/** Difference in percentage points between two rates (0.05 = +5 pts). */
export function pointChange(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null) return null;
  return current - previous;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ---------------- Time zones ---------------- */

/** UTC offset (minutes) of `tz` at instant `at`. */
export function tzOffsetMinutes(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/** The instant a calendar day (YYYY-MM-DD) starts in `tz`. */
export function startOfDayInZone(dateStr: string, tz: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const offset = tzOffsetMinutes(new Date(guess), tz);
  const first = guess - offset * 60000;
  // Re-check once in case the offset changes across midnight (DST zones).
  const offset2 = tzOffsetMinutes(new Date(first), tz);
  return new Date(guess - offset2 * 60000);
}

/** Calendar date string (YYYY-MM-DD) `n` days from `dateStr`. */
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
