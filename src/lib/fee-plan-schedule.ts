// Fee plan scheduling: which FeeRecords a plan creates for one student and one period.
// Pure (no DB, no clock) so it is unit tested and safe to import from server or client code.
//
// Plan kinds come from FeePlan.duration (months): 1 = monthly, 3 = quarterly, anything else = term.
// A period starts on the 1st of `startMonth` and covers `duration` calendar months.
//
// PRORATION RULE (mid-period joins), all dates academy-local (IST by default):
//   • joined on or before the period's first day  → full plan amount
//   • joined after the period's last day           → nothing is billed for this period
//   • joined inside the period                     → round(amount × daysRemaining / daysInPeriod)
//     where daysRemaining counts the join day through the period's last day, inclusive, and
//     daysInPeriod is every calendar day of the period. Rounded to the nearest whole rupee.
//   Example: ₹3,000 monthly plan, November (30 days), joined 16 Nov → 15/30 → ₹1,500.
//
// INSTALMENTS: FeeRecord is unique per (student, month), so a plan can have at most one due per
// month: 1 ≤ instalments ≤ duration. Instalment i falls in month floor(i × duration / N) of the period
// (a 6-month term in 2 instalments → months 0 and 3). For a mid-period join, an instalment that
// would fall before the join month moves to the join month (merging with any already there), and the
// prorated total is split evenly over the remaining dues; whole rupees, remainder on the first due.
//
// COVERED months: months of the period from the join month on that carry no due get a ₹0 record
// marked PAID with paymentMethod "PLAN_COVERED". The monthly generator and cron skip any month
// that already has a record, so this stops a quarterly/term family being billed again monthly.

export type PlanKind = "MONTHLY" | "QUARTERLY" | "TERM";

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const PLAN_COVERED_METHOD = "PLAN_COVERED";
export const MAX_PLAN_MONTHS = 12;

export function planKind(duration: number): PlanKind {
  if (duration === 1) return "MONTHLY";
  if (duration === 3) return "QUARTERLY";
  return "TERM";
}

export function planKindLabel(duration: number): string {
  const k = planKind(duration);
  if (k === "MONTHLY") return "Monthly";
  if (k === "QUARTERLY") return "Quarterly";
  return `Term (${duration} months)`;
}

/** "YYYY-MM" plus n months (n may be negative). */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + n;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const DAY_MS = 86_400_000;
function dayNumber(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

export interface PeriodBounds {
  firstDay: string; // YYYY-MM-DD
  lastDay: string; // YYYY-MM-DD
  months: string[];
  totalDays: number;
}

export function periodBounds(startMonth: string, duration: number): PeriodBounds {
  const months = Array.from({ length: duration }, (_, i) => addMonths(startMonth, i));
  const last = months[months.length - 1];
  const lastDay = `${last}-${String(daysInMonth(last)).padStart(2, "0")}`;
  const firstDay = `${startMonth}-01`;
  return { firstDay, lastDay, months, totalDays: dayNumber(lastDay) - dayNumber(firstDay) + 1 };
}

export interface ProrationResult {
  amount: number;
  /** Days billed (join day → period end, inclusive) */
  chargedDays: number;
  totalDays: number;
  prorated: boolean;
}

/** Apply the proration rule above. `joinDate` is an academy-local YYYY-MM-DD, or null for "joined earlier". */
export function prorateAmount(amount: number, startMonth: string, duration: number, joinDate?: string | null): ProrationResult {
  const { firstDay, lastDay, totalDays } = periodBounds(startMonth, duration);
  const full = Math.round(Math.max(0, amount));
  if (!joinDate || !DATE_RE.test(joinDate) || joinDate <= firstDay) {
    return { amount: full, chargedDays: totalDays, totalDays, prorated: false };
  }
  if (joinDate > lastDay) return { amount: 0, chargedDays: 0, totalDays, prorated: true };
  const chargedDays = dayNumber(lastDay) - dayNumber(joinDate) + 1;
  return { amount: Math.round((full * chargedDays) / totalDays), chargedDays, totalDays, prorated: true };
}

export interface ScheduleLine {
  month: string;
  amount: number;
  kind: "DUE" | "COVERED";
  /** 1-based instalment number for DUE lines */
  instalment?: number;
}

export interface PlanScheduleInput {
  amount: number;
  duration: number;
  startMonth: string;
  instalments?: number;
  joinDate?: string | null;
}

export type PlanSchedule =
  | { ok: true; lines: ScheduleLine[]; total: number; proration: ProrationResult }
  | { ok: false; error: string };

export function validatePlanInput(input: { amount: number; duration: number; startMonth: string; instalments?: number }): string | null {
  if (!Number.isFinite(input.amount) || input.amount <= 0) return "Amount must be more than 0.";
  if (!Number.isInteger(input.duration) || input.duration < 1 || input.duration > MAX_PLAN_MONTHS)
    return `Duration must be 1 to ${MAX_PLAN_MONTHS} months.`;
  if (!MONTH_RE.test(String(input.startMonth))) return "Start month must be YYYY-MM.";
  const n = input.instalments ?? 1;
  if (!Number.isInteger(n) || n < 1) return "Instalments must be a whole number of at least 1.";
  if (n > input.duration) return `At most ${input.duration} instalment${input.duration === 1 ? "" : "s"} (one due per month).`;
  return null;
}

/** The FeeRecords one student gets for one plan period (see the rules at the top of this file). */
export function buildPlanSchedule(input: PlanScheduleInput): PlanSchedule {
  const err = validatePlanInput(input);
  if (err) return { ok: false, error: err };
  const n = input.instalments ?? 1;
  const { months } = periodBounds(input.startMonth, input.duration);
  const proration = prorateAmount(input.amount, input.startMonth, input.duration, input.joinDate);
  if (proration.amount <= 0) return { ok: true, lines: [], total: 0, proration };

  const joinMonth = proration.prorated && input.joinDate ? input.joinDate.slice(0, 7) : months[0];
  const dueMonths: string[] = [];
  for (let i = 0; i < n; i++) {
    const natural = months[Math.floor((i * input.duration) / n)];
    const m = natural < joinMonth ? joinMonth : natural;
    if (!dueMonths.includes(m)) dueMonths.push(m);
  }

  const each = Math.floor(proration.amount / dueMonths.length);
  const remainder = proration.amount - each * dueMonths.length;
  const dueLines: ScheduleLine[] = dueMonths.map((month, i) => ({
    month,
    amount: each + (i === 0 ? remainder : 0),
    kind: "DUE",
    instalment: i + 1,
  }));

  const lines: ScheduleLine[] = [];
  for (const month of months) {
    if (month < joinMonth) continue;
    const due = dueLines.find((d) => d.month === month);
    lines.push(due ?? { month, amount: 0, kind: "COVERED" });
  }
  return { ok: true, lines, total: proration.amount, proration };
}

/** Academy-local YYYY-MM-DD of an instant (IST by default; falls back to IST on a bad zone). */
export function localDate(d: Date, timeZone = "Asia/Kolkata"): string {
  for (const tz of [timeZone || "Asia/Kolkata", "Asia/Kolkata"]) {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    } catch {
      // next zone
    }
  }
  return d.toISOString().slice(0, 10);
}
