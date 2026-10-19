// Shared fee / payment / time helpers (server + client safe; no DB access here).

/**
 * One (month, status) bucket of an academy's fee records: how many records and their summed
 * amount. The owner dashboard ships these all-time buckets (from a `groupBy`, so at most
 * months × statuses rows) instead of every fee record the academy has ever had.
 */
export interface FeeMonthStatus {
  month: string;
  status: string;
  count: number;
  amount: number;
}

/**
 * Resolve a student's monthly fee in ₹.
 * Order: student.feeOverride → first batch with a monthlyFee → org.defaultMonthlyFee → 0.
 * 0 means "fee not set" — the UI should prompt the admin to set it instead of inventing a number.
 */
export function resolveFeeAmount(opts: {
  feeOverride?: number | null;
  batchFees?: Array<number | null | undefined>;
  orgDefault?: number | null;
}): number {
  if (opts.feeOverride && opts.feeOverride > 0) return opts.feeOverride;
  const batchFee = (opts.batchFees || []).find((f) => typeof f === "number" && f > 0);
  if (batchFee) return batchFee as number;
  if (opts.orgDefault && opts.orgDefault > 0) return opts.orgDefault;
  return 0;
}

/** Convenience for a student loaded with `enrollments: { include: { batch: true } }`. */
export function resolveStudentFee(student: any, orgDefault?: number | null): number {
  return resolveFeeAmount({
    feeOverride: student?.feeOverride,
    batchFees: (student?.enrollments || []).map((e: any) => e?.batch?.monthlyFee),
    orgDefault,
  });
}

/** Build a standard UPI deep link (works with GPay, PhonePe, Paytm, BHIM…). */
export function buildUpiLink(opts: { upiId: string; payeeName: string; amount?: number; note?: string }) {
  const params = new URLSearchParams();
  params.set("pa", opts.upiId.trim());
  params.set("pn", opts.payeeName.slice(0, 50));
  if (opts.amount && opts.amount > 0) params.set("am", String(opts.amount));
  params.set("cu", "INR"); // UPI is India-only; currency is always INR for UPI links
  if (opts.note) params.set("tn", opts.note.slice(0, 80));
  // URLSearchParams encodes spaces as "+", which some UPI apps show literally.
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}

export function isValidUpiId(upiId: string) {
  return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upiId.trim());
}

/** Fee statuses */
export const FEE_STATUS = {
  PENDING: "PENDING",
  PENDING_VERIFICATION: "PENDING_VERIFICATION",
  PAID: "PAID",
} as const;

/**
 * YYYY-MM-DD for "now" in the given timezone. Defaults to UTC.
 * @deprecated Prefer orgToday() from i18n.ts for org-aware timezone.
 */
export function istDateString(d: Date = new Date(), tz = "UTC"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/**
 * YYYY-MM for the current month in the given timezone.
 * @deprecated Prefer orgCurrentMonth() from i18n.ts for org-aware timezone.
 */
export function istMonthString(d: Date = new Date(), tz = "UTC"): string {
  return istDateString(d, tz).slice(0, 7);
}

/**
 * Today's date as a Date at 00:00 UTC of that calendar day.
 * @deprecated Prefer orgToday() from i18n.ts for org-aware timezone.
 */
export function istToday(d: Date = new Date(), tz = "UTC"): Date {
  return new Date(`${istDateString(d, tz)}T00:00:00.000Z`);
}

/**
 * Weekday short name (Mon, Tue…) for today.
 * @deprecated Prefer using org timezone from i18n.ts.
 */
export function istWeekday(d: Date = new Date(), tz = "UTC"): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d);
}

const DAY_TOKENS: Record<string, string[]> = {
  Mon: ["mon", "monday"],
  Tue: ["tue", "tues", "tuesday"],
  Wed: ["wed", "weds", "wednesday"],
  Thu: ["thu", "thur", "thurs", "thursday"],
  Fri: ["fri", "friday"],
  Sat: ["sat", "saturday"],
  Sun: ["sun", "sunday"],
};
const ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Does a free-text schedule like "Mon/Wed/Fri 4:00 PM", "Mon-Fri 6am", "Daily" or
 * "Weekends" include the given weekday? Returns null if the schedule can't be parsed.
 */
export function scheduleRunsOn(schedule: string | null | undefined, weekday: string): boolean | null {
  if (!schedule) return null;
  const s = schedule.toLowerCase();
  if (/\b(daily|everyday|every day|all days)\b/.test(s)) return true;
  if (/\bweekdays?\b/.test(s)) return ORDER.indexOf(weekday) < 5;
  if (/\bweekends?\b/.test(s)) return ORDER.indexOf(weekday) >= 5;

  const tokenToDay = (tok: string) => ORDER.find((d) => DAY_TOKENS[d].includes(tok));
  // Ranges like mon-fri / mon to sat
  const range = s.match(/\b([a-z]{3,9})\s*(?:-|–|to)\s*([a-z]{3,9})\b/);
  if (range) {
    const a = tokenToDay(range[1]);
    const b = tokenToDay(range[2]);
    if (a && b) {
      const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b), iw = ORDER.indexOf(weekday);
      return ia <= ib ? iw >= ia && iw <= ib : iw >= ia || iw <= ib;
    }
  }
  const words = s.split(/[^a-z]+/).filter(Boolean);
  const days = new Set(words.map(tokenToDay).filter(Boolean) as string[]);
  if (days.size === 0) return null;
  return days.has(weekday);
}
