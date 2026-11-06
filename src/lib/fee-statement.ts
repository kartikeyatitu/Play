// Parent fee statement for one child over a date range. Pure and client-safe.
//
// • A due is a FeeRecord with amount > 0; it falls due on the 1st of its month (same rule as the
//   overdue panel). Dues dated inside [from, to] are listed.
// • A payment is a FeeRecord marked PAID whose paidAt (academy-local date) is inside [from, to],
//   whatever the method (cash, UPI confirmed, online). Its receipt, if one exists, is attached.
// • Receipts not tied to a listed payment (e.g. issued for a fee paid before paidAt was tracked)
//   are listed on their own when issued inside the range, without counting as a payment twice.
// • Opening balance = dues before `from` still unpaid; closing balance = every unpaid due on or
//   before `to`. PENDING_VERIFICATION ("I've paid", not yet confirmed) still counts as owed.
// • ₹0 "PLAN_COVERED" months (see fee-plan-schedule.ts) are not dues and are left out.

export interface StatementFeeRecord {
  id: string;
  month: string; // YYYY-MM
  amount: number;
  status: string;
  paymentMethod?: string | null;
  /** Academy-local YYYY-MM-DD the fee was marked paid */
  paidOn?: string | null;
}

export interface StatementReceipt {
  receiptNumber: string;
  token: string;
  feeRecordId: string | null;
  month: string;
  amount: number;
  paymentMode: string;
  /** Academy-local YYYY-MM-DD */
  issuedOn: string;
}

export type StatementLine =
  | { kind: "DUE"; date: string; month: string; amount: number; status: string; feeRecordId: string }
  | { kind: "PAYMENT"; date: string; month: string; amount: number; method: string | null; feeRecordId: string; receipt: { number: string; token: string } | null }
  | { kind: "RECEIPT"; date: string; month: string; amount: number; receipt: { number: string; token: string }; mode: string };

export interface FeeStatement {
  from: string;
  to: string;
  openingBalance: number;
  billed: number;
  paid: number;
  closingBalance: number;
  lines: StatementLine[];
}

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isStatementDate(v: unknown): v is string {
  return typeof v === "string" && DATE_RE.test(v);
}

/** Clamp a requested range: valid dates, from ≤ to, at most `maxDays` long (keeps the newest end). */
export function normaliseStatementRange(from: unknown, to: unknown, today: string, maxDays = 731): { from: string; to: string } {
  let t = isStatementDate(to) ? (to as string) : today;
  let f = isStatementDate(from) ? (from as string) : `${today.slice(0, 4)}-01-01`;
  if (f > t) [f, t] = [t, f];
  const dayMs = 86_400_000;
  const span = (Date.parse(`${t}T00:00:00Z`) - Date.parse(`${f}T00:00:00Z`)) / dayMs;
  if (span > maxDays) f = new Date(Date.parse(`${t}T00:00:00Z`) - maxDays * dayMs).toISOString().slice(0, 10);
  return { from: f, to: t };
}

const isDue = (r: StatementFeeRecord) => (Number(r.amount) || 0) > 0;
const owed = (r: StatementFeeRecord) => r.status !== "PAID";

export function buildFeeStatement(input: {
  from: string;
  to: string;
  records: StatementFeeRecord[];
  receipts: StatementReceipt[];
}): FeeStatement {
  const { from, to } = input;
  const receiptByFee = new Map<string, StatementReceipt>();
  for (const r of input.receipts) if (r.feeRecordId) receiptByFee.set(r.feeRecordId, r);

  const lines: StatementLine[] = [];
  let opening = 0;
  let billed = 0;
  let paid = 0;
  let closing = 0;
  const paymentFeeIds = new Set<string>();

  for (const r of input.records) {
    if (!isDue(r)) continue;
    const dueDate = `${r.month}-01`;
    const amount = Number(r.amount) || 0;
    if (dueDate < from && owed(r)) opening += amount;
    if (dueDate <= to && owed(r)) closing += amount;
    if (dueDate >= from && dueDate <= to) {
      billed += amount;
      lines.push({ kind: "DUE", date: dueDate, month: r.month, amount, status: r.status, feeRecordId: r.id });
    }
    if (r.status === "PAID" && r.paidOn && r.paidOn >= from && r.paidOn <= to) {
      paid += amount;
      paymentFeeIds.add(r.id);
      const rc = receiptByFee.get(r.id);
      lines.push({
        kind: "PAYMENT",
        date: r.paidOn,
        month: r.month,
        amount,
        method: r.paymentMethod ?? null,
        feeRecordId: r.id,
        receipt: rc ? { number: rc.receiptNumber, token: rc.token } : null,
      });
    }
  }

  for (const rc of input.receipts) {
    if (rc.feeRecordId && paymentFeeIds.has(rc.feeRecordId)) continue;
    if (rc.issuedOn < from || rc.issuedOn > to) continue;
    lines.push({ kind: "RECEIPT", date: rc.issuedOn, month: rc.month, amount: Number(rc.amount) || 0, receipt: { number: rc.receiptNumber, token: rc.token }, mode: rc.paymentMode });
  }

  const order = { DUE: 0, PAYMENT: 1, RECEIPT: 2 } as const;
  lines.sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind] || a.month.localeCompare(b.month));
  return { from, to, openingBalance: opening, billed, paid, closingBalance: closing, lines };
}
