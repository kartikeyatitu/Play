// TRIQ Brand Studio (V9) — scholarship / CSR fee concessions. Pure and client-safe.
// Applied by both monthly fee generators when FEATURES.inclusive is on.

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

export const CONCESSION_CATEGORIES = ["SCHOLARSHIP", "CSR", "SIBLING", "HARDSHIP", "MERIT", "STAFF_CHILD", "OTHER"] as const;
export type ConcessionCategory = (typeof CONCESSION_CATEGORIES)[number];
export const PROGRAM_KINDS = ["SCHOLARSHIP", "CSR", "HARDSHIP", "OTHER"] as const;

export const CATEGORY_LABELS: Record<ConcessionCategory, string> = {
  SCHOLARSHIP: "Scholarship",
  CSR: "CSR-funded",
  SIBLING: "Sibling",
  HARDSHIP: "Hardship",
  MERIT: "Merit",
  STAFF_CHILD: "Staff child",
  OTHER: "Other",
};

export interface ConcessionLike {
  id?: string;
  studentId?: string;
  percentOff: number | null;
  amountOff: number | null;
  startMonth: string;
  endMonth: string | null;
  revokedAt: Date | string | null;
  createdAt: Date | string;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const isMonth = (v: unknown): v is string => typeof v === "string" && MONTH_RE.test(v);

/** Does the concession cover `month` ("YYYY-MM", inclusive window) and is it still in force? */
export function coversMonth(c: ConcessionLike, month: string): boolean {
  if (c.revokedAt) return false;
  if (month < c.startMonth) return false;
  if (c.endMonth && month > c.endMonth) return false;
  return true;
}

/** The latest-created non-revoked concession covering the month, or null. */
export function activeConcession<T extends ConcessionLike>(list: T[], month: string): T | null {
  let best: T | null = null;
  for (const c of list) {
    if (!coversMonth(c, month)) continue;
    if (!best || new Date(c.createdAt).getTime() > new Date(best.createdAt).getTime()) best = c;
  }
  return best;
}

/** Fee after concession, whole currency units, never below 0. */
export function applyConcession(baseAmount: number, c: Pick<ConcessionLike, "percentOff" | "amountOff"> | null): number {
  if (!c || !(baseAmount > 0)) return baseAmount;
  if (c.percentOff != null) return Math.max(0, Math.round((baseAmount * (100 - c.percentOff)) / 100));
  if (c.amountOff != null) return Math.max(0, baseAmount - c.amountOff);
  return baseAmount;
}

/** Group concessions by student for the generators. */
export function concessionsByStudent<T extends ConcessionLike & { studentId: string }>(list: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const c of list) {
    const arr = m.get(c.studentId);
    if (arr) arr.push(c);
    else m.set(c.studentId, [c]);
  }
  return m;
}

/** Resolve the amount a generator should bill (0 = skip, same as today's "fee not set" path). */
export function billedAmount(baseAmount: number, concessions: ConcessionLike[] | undefined, month: string): number {
  if (!concessions || concessions.length === 0) return baseAmount;
  return applyConcession(baseAmount, activeConcession(concessions, month));
}

export interface ConcessionInput {
  studentId: string;
  programId: string | null;
  category: ConcessionCategory;
  percentOff: number | null;
  amountOff: number | null;
  startMonth: string;
  endMonth: string | null;
  reason: string | null;
}

/**
 * mode: FULL (100% waiver), PERCENT (1–100) or AMOUNT (₹ off per month, > 0).
 */
export function validateConcessionInput(raw: Record<string, unknown>): Validated<ConcessionInput> {
  const studentId = typeof raw.studentId === "string" ? raw.studentId : "";
  if (!studentId) return { ok: false, error: "Choose a student" };
  const category = raw.category ?? "SCHOLARSHIP";
  if (typeof category !== "string" || !(CONCESSION_CATEGORIES as readonly string[]).includes(category))
    return { ok: false, error: "Choose a category" };
  let percentOff: number | null = null;
  let amountOff: number | null = null;
  const value = typeof raw.value === "string" && raw.value.trim() !== "" ? Number(raw.value) : raw.value;
  switch (raw.mode) {
    case "FULL":
      percentOff = 100;
      break;
    case "PERCENT":
      if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 100)
        return { ok: false, error: "Percent off must be a whole number from 1 to 100" };
      percentOff = value;
      break;
    case "AMOUNT":
      if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 1_000_000)
        return { ok: false, error: "Amount off must be a whole amount greater than 0" };
      amountOff = value;
      break;
    default:
      return { ok: false, error: "Choose full waiver, percent or amount" };
  }
  if (!isMonth(raw.startMonth)) return { ok: false, error: "Start month must be YYYY-MM" };
  const endMonth = raw.endMonth == null || raw.endMonth === "" ? null : raw.endMonth;
  if (endMonth !== null && !isMonth(endMonth)) return { ok: false, error: "End month must be YYYY-MM" };
  if (endMonth && endMonth < raw.startMonth) return { ok: false, error: "End month must be on or after the start month" };
  const reasonRaw = typeof raw.reason === "string" ? raw.reason.trim() : "";
  if (reasonRaw.length > 300) return { ok: false, error: "Reason is too long (max 300 characters)" };
  const programId = typeof raw.programId === "string" && raw.programId ? raw.programId : null;
  return {
    ok: true,
    value: {
      studentId,
      programId,
      category: category as ConcessionCategory,
      percentOff,
      amountOff,
      startMonth: raw.startMonth,
      endMonth,
      reason: reasonRaw || null,
    },
  };
}

/** Money not billed this month because of concessions (real rows only). */
export function foregoneForMonth(rows: Array<{ base: number; concessions: ConcessionLike[] }>, month: string): number {
  let total = 0;
  for (const r of rows) total += r.base - billedAmount(r.base, r.concessions, month);
  return total;
}

export function describeConcession(c: Pick<ConcessionLike, "percentOff" | "amountOff">, currencySymbol = "₹"): string {
  if (c.percentOff === 100) return "Full waiver";
  if (c.percentOff != null) return `${c.percentOff}% off`;
  if (c.amountOff != null) return `${currencySymbol}${c.amountOff.toLocaleString("en-IN")} off / month`;
  return "—";
}
