// Overdue aging for unpaid fee records. Pure (no DB, no Date.now()) so it is unit tested and safe
// to import from server or client code.
//
// A FeeRecord is due on the 1st of its month ("YYYY-MM-01") in the academy's timezone, the same
// rule getUnpaidFees uses. "Days overdue" = academy-local today minus that due date, in whole
// calendar days. Records for future months (negative days) are not overdue and are left out, as are
// records already PAID, records a parent reported as paid (PENDING_VERIFICATION, waiting for staff
// to confirm) and zero-amount records.

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export type AgingBucketKey = "d0_7" | "d8_15" | "d16_30" | "d30_plus";

export const AGING_BUCKETS: { key: AgingBucketKey; label: string; min: number; max: number | null }[] = [
  { key: "d0_7", label: "0–7 days", min: 0, max: 7 },
  { key: "d8_15", label: "8–15 days", min: 8, max: 15 },
  { key: "d16_30", label: "16–30 days", min: 16, max: 30 },
  { key: "d30_plus", label: "30+ days", min: 31, max: null },
];

export interface AgingFeeInput {
  feeRecordId: string;
  studentId: string;
  studentName: string;
  /** The family = the parent user. Children of one parent are reminded together. */
  familyId: string;
  familyName: string | null;
  familyPhone: string | null;
  amount: number;
  /** "YYYY-MM" */
  month: string;
  status: string;
}

export interface AgingFeeLine {
  feeRecordId: string;
  studentId: string;
  studentName: string;
  month: string;
  amount: number;
  daysOverdue: number;
}

export interface AgingFamily {
  familyId: string;
  familyName: string | null;
  familyPhone: string | null;
  total: number;
  /** Most overdue record of this family in this bucket */
  maxDaysOverdue: number;
  lines: AgingFeeLine[];
}

export interface AgingBucket {
  key: AgingBucketKey;
  label: string;
  total: number;
  recordCount: number;
  families: AgingFamily[];
}

export interface AgingReport {
  /** Academy-local "today" used for the calculation (YYYY-MM-DD) */
  today: string;
  total: number;
  buckets: AgingBucket[];
}

/** YYYY-MM-DD of an instant in a timezone. Falls back to IST, then UTC, on a bad zone. */
export function localDateString(now: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  for (const tz of [timeZone || DEFAULT_TIMEZONE, DEFAULT_TIMEZONE]) {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    } catch {
      // try the next zone
    }
  }
  return now.toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;

function dayNumber(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / DAY_MS);
}

/** Whole days between the fee's due date (1st of its month) and academy-local today. Null for a bad month. */
export function daysOverdue(month: string, now: Date, timeZone: string = DEFAULT_TIMEZONE): number | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) return null;
  return dayNumber(localDateString(now, timeZone)) - dayNumber(`${month}-01`);
}

export function bucketFor(days: number): AgingBucketKey | null {
  if (days < 0 || !Number.isFinite(days)) return null;
  for (const b of AGING_BUCKETS) {
    if (days >= b.min && (b.max === null || days <= b.max)) return b.key;
  }
  return null;
}

/** Statuses that are still owed and worth reminding about. */
export function isOverdueCandidate(status: string): boolean {
  return status !== "PAID" && status !== "PENDING_VERIFICATION";
}

/**
 * Bucket unpaid fee records by days overdue. Each bucket lists families sorted by amount owed
 * (largest first, then most overdue, then name), with every bucket present even when empty.
 */
export function buildAgingReport(records: AgingFeeInput[], now: Date, timeZone: string = DEFAULT_TIMEZONE): AgingReport {
  const today = localDateString(now, timeZone);
  const byBucket = new Map<AgingBucketKey, Map<string, AgingFamily>>();
  const counts = new Map<AgingBucketKey, number>();

  for (const r of records) {
    if (!isOverdueCandidate(r.status)) continue;
    const amount = Number(r.amount) || 0;
    if (amount <= 0) continue;
    const days = daysOverdue(r.month, now, timeZone);
    if (days === null) continue;
    const key = bucketFor(days);
    if (!key) continue;

    let families = byBucket.get(key);
    if (!families) byBucket.set(key, (families = new Map()));
    let fam = families.get(r.familyId);
    if (!fam) {
      fam = { familyId: r.familyId, familyName: r.familyName, familyPhone: r.familyPhone, total: 0, maxDaysOverdue: 0, lines: [] };
      families.set(r.familyId, fam);
    }
    fam.total += amount;
    fam.maxDaysOverdue = Math.max(fam.maxDaysOverdue, days);
    fam.lines.push({ feeRecordId: r.feeRecordId, studentId: r.studentId, studentName: r.studentName, month: r.month, amount, daysOverdue: days });
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const buckets: AgingBucket[] = AGING_BUCKETS.map((b) => {
    const families = Array.from(byBucket.get(b.key)?.values() ?? []);
    for (const f of families) f.lines.sort((a, z) => z.daysOverdue - a.daysOverdue || a.studentName.localeCompare(z.studentName));
    families.sort(
      (a, z) => z.total - a.total || z.maxDaysOverdue - a.maxDaysOverdue || (a.familyName || "").localeCompare(z.familyName || ""),
    );
    return {
      key: b.key,
      label: b.label,
      total: families.reduce((s, f) => s + f.total, 0),
      recordCount: counts.get(b.key) || 0,
      families,
    };
  });

  return { today, total: buckets.reduce((s, b) => s + b.total, 0), buckets };
}
