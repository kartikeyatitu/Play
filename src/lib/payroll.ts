// Payroll and expense helpers. Pure and client-safe: no DB or server-only imports here.

export const EXPENSE_CATEGORIES = ["RENT", "EQUIPMENT", "UTILITIES", "TRAVEL", "MARKETING", "EVENTS", "OTHER"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  RENT: "Ground / court rent",
  EQUIPMENT: "Equipment and kit",
  UTILITIES: "Electricity, water, internet",
  TRAVEL: "Travel and transport",
  MARKETING: "Marketing",
  EVENTS: "Tournaments and events",
  OTHER: "Other",
};

export const PAYMENT_MODES = ["CASH", "UPI", "BANK"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];
export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = { CASH: "Cash", UPI: "UPI", BANK: "Bank transfer" };

export const isExpenseCategory = (v: unknown): v is ExpenseCategory =>
  typeof v === "string" && (EXPENSE_CATEGORIES as readonly string[]).includes(v);
export const isPaymentMode = (v: unknown): v is PaymentMode =>
  typeof v === "string" && (PAYMENT_MODES as readonly string[]).includes(v);

/** "2026-10" -> number of days in that month. */
export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function isMonthString(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

export function monthLabel(month: string, locale = "en"): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type AttendanceSummary = { present: number; halfDay: number; leave: number; absent: number };

/**
 * Base pay for a month.
 *  - MONTHLY: the full salary. Absent days are shown with a suggested deduction the owner can apply.
 *  - PER_SESSION: rate x sessions actually taken (attendance marked, not cancelled).
 */
export function calculateBase(payType: string, rate: number, sessions: number): { units: number; base: number } {
  if (payType === "PER_SESSION") return { units: sessions, base: Math.round(rate * sessions) };
  return { units: 0, base: Math.round(rate) };
}

/** Per-day value of a monthly salary, used for the suggested absence deduction. */
export function suggestedAbsenceDeduction(monthlySalary: number, month: string, att: AttendanceSummary): number {
  const perDay = monthlySalary / daysInMonth(month);
  return Math.round(perDay * (att.absent + att.halfDay * 0.5));
}

export function netPay(base: number, bonus: number, deduction: number, advance: number): number {
  return Math.max(0, Math.round(base + bonus - deduction - advance));
}

/** @deprecated Use formatMoney from i18n.ts for org-aware formatting. */
export const formatINR = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Payslip text for WhatsApp. */
export function payslipText(p: {
  academy: string;
  name: string;
  role: string;
  month: string;
  payType: string;
  rate: number;
  units: number;
  base: number;
  bonus: number;
  deduction: number;
  advance: number;
  net: number;
  attendance?: AttendanceSummary | null;
  paid?: { at: string; mode?: string | null; reference?: string | null } | null;
}): string {
  const lines = [
    `*${p.academy}*`,
    `Payslip for ${monthLabel(p.month)}`,
    ``,
    `${p.name} · ${p.role}`,
  ];
  if (p.attendance) {
    lines.push(`Attendance: ${p.attendance.present} present${p.attendance.halfDay ? `, ${p.attendance.halfDay} half day` : ""}${p.attendance.leave ? `, ${p.attendance.leave} leave` : ""}${p.attendance.absent ? `, ${p.attendance.absent} absent` : ""}`);
  }
  lines.push(
    p.payType === "PER_SESSION"
      ? `Sessions taken: ${p.units} × ${formatINR(p.rate)} = ${formatINR(p.base)}`
      : `Monthly salary: ${formatINR(p.base)}`
  );
  if (p.bonus) lines.push(`Bonus: +${formatINR(p.bonus)}`);
  if (p.deduction) lines.push(`Deduction: −${formatINR(p.deduction)}`);
  if (p.advance) lines.push(`Advance already paid: −${formatINR(p.advance)}`);
  lines.push(``, `*Net pay: ${formatINR(p.net)}*`);
  if (p.paid) {
    const when = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(p.paid.at));
    const mode = p.paid.mode && isPaymentMode(p.paid.mode) ? PAYMENT_MODE_LABELS[p.paid.mode] : p.paid.mode;
    lines.push(`Paid on ${when}${mode ? ` by ${mode}` : ""}${p.paid.reference ? ` (ref ${p.paid.reference})` : ""}`);
  }
  lines.push(``, `Thank you for your work this month 🙏`);
  return lines.join("\n");
}
