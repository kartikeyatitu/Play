"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { attempt } from "@/lib/action-result";
import { istMonthString, istToday } from "@/lib/fees";
import { backfillOrgMemberships, requirePermission } from "@/lib/membership";
import { effectivePermissions, roleLabel } from "@/lib/team";
import {
  calculateBase,
  daysInMonth,
  isExpenseCategory,
  isMonthString,
  isPaymentMode,
  netPay,
  shiftMonth,
  suggestedAbsenceDeduction,
  type AttendanceSummary,
} from "@/lib/payroll";

const MAX_AMOUNT = 10_000_000;

/** [start, end) of a month as stored day values (00:00 UTC of each IST calendar day). */
function monthDayRange(month: string) {
  return { gte: new Date(`${month}-01T00:00:00.000Z`), lt: new Date(`${shiftMonth(month, 1)}-01T00:00:00.000Z`) };
}

/** [start, end) of a month as real instants in India time, for timestamps such as paidAt. */
function monthInstantRange(month: string) {
  return { gte: new Date(`${month}-01T00:00:00+05:30`), lt: new Date(`${shiftMonth(month, 1)}-01T00:00:00+05:30`) };
}

function money(v: unknown, label: string): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 0 || n > MAX_AMOUNT) throw new Error(`Enter a valid ${label}`);
  return n;
}

function cleanText(v: unknown, max = 200): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t || null;
}

async function audit(userId: string, orgId: string, action: string, details: Record<string, unknown>) {
  await db.auditLog.create({ data: { userId, orgId, action, details: JSON.stringify(details) } }).catch(() => {});
}

/** Sessions each coach actually took in the month: not cancelled, not in the future, attendance marked. */
async function sessionsByCoach(orgId: string, month: string): Promise<Map<string, number>> {
  const range = monthDayRange(month);
  const today = istToday();
  const sessions = await db.session.findMany({
    where: {
      date: { gte: range.gte, lt: range.lt, lte: today },
      status: { not: "CANCELLED" },
      batch: { orgId },
      attendances: { some: {} },
    },
    select: { batch: { select: { coachId: true } } },
  });
  const counts = new Map<string, number>();
  for (const s of sessions) counts.set(s.batch.coachId, (counts.get(s.batch.coachId) ?? 0) + 1);
  return counts;
}

async function attendanceByMember(orgId: string, month: string): Promise<Map<string, AttendanceSummary>> {
  const rows = await db.staffAttendance.groupBy({
    by: ["membershipId", "status"],
    where: { orgId, date: monthDayRange(month) },
    _count: { _all: true },
  });
  const map = new Map<string, AttendanceSummary>();
  for (const r of rows) {
    const s = map.get(r.membershipId) ?? { present: 0, halfDay: 0, leave: 0, absent: 0 };
    if (r.status === "PRESENT") s.present += r._count._all;
    else if (r.status === "HALF_DAY") s.halfDay += r._count._all;
    else if (r.status === "LEAVE") s.leave += r._count._all;
    else if (r.status === "ABSENT") s.absent += r._count._all;
    map.set(r.membershipId, s);
  }
  return map;
}

type MemberForPay = {
  id: string;
  userId: string;
  role: string;
  staffRole: string | null;
  payType: string | null;
  payAmount: number | null;
};

/** Fresh figures for one person and month (used while a payout is still pending). */
function freshFigures(m: MemberForPay, month: string, sessions: number, adj: { bonus: number; deduction: number; advance: number }) {
  const payType = m.payType ?? "MONTHLY";
  const rate = m.payAmount ?? 0;
  const { units, base } = calculateBase(payType, rate, sessions);
  return { payType, rate, units, baseAmount: base, ...adj, netAmount: netPay(base, adj.bonus, adj.deduction, adj.advance) };
}

async function loadMember(orgId: string, membershipId: string) {
  const m = await db.orgMembership.findFirst({
    where: { id: membershipId, orgId },
    select: { id: true, userId: true, role: true, staffRole: true, payType: true, payAmount: true, status: true, user: { select: { name: true } } },
  });
  if (!m) throw new Error("Team member not found");
  return m;
}

// ───────────────────────────── Read ─────────────────────────────

async function getPayrollImpl(monthInput?: string) {
  const { session, membership } = await requirePermission("payroll.view");
  const orgId = session.orgId;
  const month = isMonthString(monthInput) ? monthInput : istMonthString();
  await backfillOrgMemberships(orgId);

  const [org, members, payouts, sessions, attendance, expenses, feeAgg, pendingFeeAgg] = await Promise.all([
    db.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
    db.orgMembership.findMany({
      where: { orgId, OR: [{ status: "ACTIVE" }, { payouts: { some: { month } } }] },
      orderBy: { joinedAt: "asc" },
      select: {
        id: true, userId: true, role: true, staffRole: true, title: true, status: true, payType: true, payAmount: true,
        user: { select: { name: true, phone: true } },
      },
    }),
    db.staffPayout.findMany({ where: { orgId, month } }),
    sessionsByCoach(orgId, month),
    attendanceByMember(orgId, month),
    db.expense.findMany({ where: { orgId, date: monthDayRange(month) }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    db.feeRecord.aggregate({
      // Cash basis: fees received this month. Older records without a payment date count in their fee month.
      where: {
        status: "PAID",
        AND: [
          { OR: [{ orgId }, { orgId: null, student: { orgId } }] },
          { OR: [{ paidAt: monthInstantRange(month) }, { paidAt: null, month }] },
        ],
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.feeRecord.aggregate({
      where: { status: { not: "PAID" }, month, OR: [{ orgId }, { orgId: null, student: { orgId } }] },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const payoutByMember = new Map(payouts.map((p) => [p.membershipId, p]));
  const rank: Record<string, number> = { OWNER: 0, MANAGER: 1, COACH: 2, STAFF: 3 };

  const rows = members
    // People with no pay set and no payout this month are listed separately so the owner can set pay
    .map((m) => {
      const p = payoutByMember.get(m.id);
      const att = attendance.get(m.id) ?? null;
      const sessionCount = sessions.get(m.userId) ?? 0;
      const hasPay = !!m.payType && (m.payAmount ?? 0) > 0;

      const figures =
        p && p.status === "PAID"
          ? {
              payType: p.payType, rate: p.rate, units: p.units, baseAmount: p.baseAmount,
              bonus: p.bonus, deduction: p.deduction, advance: p.advance, netAmount: p.netAmount,
            }
          : freshFigures(m, month, sessionCount, { bonus: p?.bonus ?? 0, deduction: p?.deduction ?? 0, advance: p?.advance ?? 0 });

      const suggestedDeduction =
        figures.payType === "MONTHLY" && att ? suggestedAbsenceDeduction(figures.rate, month, att) : 0;

      return {
        membershipId: m.id,
        name: m.user.name,
        phone: m.user.phone,
        role: m.role,
        roleLabel: roleLabel(m.role, m.staffRole),
        removed: m.status !== "ACTIVE",
        hasPay: hasPay || !!p,
        sessions: sessionCount,
        attendance: att,
        suggestedDeduction,
        ...figures,
        status: (p?.status ?? "PENDING") as "PENDING" | "PAID",
        paidAt: p?.paidAt?.toISOString() ?? null,
        paymentMode: p?.paymentMode ?? null,
        reference: p?.reference ?? null,
        note: p?.note ?? null,
      };
    })
    .sort((a, b) => (rank[a.role] ?? 9) - (rank[b.role] ?? 9));

  const payable = rows.filter((r) => r.hasPay);
  const noPay = rows.filter((r) => !r.hasPay && r.role !== "OWNER").map((r) => ({ membershipId: r.membershipId, name: r.name, roleLabel: r.roleLabel }));

  const salaries = payable.reduce((s, r) => s + r.netAmount, 0);
  const salariesPaid = payable.filter((r) => r.status === "PAID").reduce((s, r) => s + r.netAmount, 0);
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const feesCollected = Math.round(feeAgg._sum.amount ?? 0);

  const perms = effectivePermissions(membership.role, membership.staffRole, membership.permissions);

  return {
    academy: org?.name ?? "Academy",
    month,
    currentMonth: istMonthString(),
    daysInMonth: daysInMonth(month),
    canManage: perms.has("payroll.manage"),
    rows: payable,
    noPay,
    expenses: expenses.map((e) => ({
      id: e.id, date: e.date.toISOString(), category: e.category, amount: e.amount, note: e.note, paymentMode: e.paymentMode,
    })),
    summary: {
      feesCollected,
      feesCollectedCount: feeAgg._count._all,
      feesPending: Math.round(pendingFeeAgg._sum.amount ?? 0),
      feesPendingCount: pendingFeeAgg._count._all,
      salaries,
      salariesPaid,
      salariesDue: salaries - salariesPaid,
      expenses: expenseTotal,
      profit: feesCollected - salaries - expenseTotal,
    },
  };
}

// ───────────────────────────── Payouts ─────────────────────────────

type Adjustments = { bonus?: number | string; deduction?: number | string; advance?: number | string; note?: string };

/** Save bonus / deduction / advance for a pending payout. */
async function savePayoutAdjustmentsImpl(membershipId: string, month: string, adj: Adjustments) {
  const { session } = await requirePermission("payroll.manage");
  const orgId = session.orgId;
  if (!isMonthString(month)) throw new Error("Pick a valid month");
  const m = await loadMember(orgId, membershipId);
  if (!m.payType) throw new Error(`Set ${m.user.name}'s pay on the Team screen first`);

  const existing = await db.staffPayout.findUnique({ where: { membershipId_month: { membershipId, month } } });
  if (existing?.status === "PAID") throw new Error("This payout is already marked paid. Mark it unpaid to change it.");

  const sessions = (await sessionsByCoach(orgId, month)).get(m.userId) ?? 0;
  const values = {
    bonus: money(adj.bonus, "bonus"),
    deduction: money(adj.deduction, "deduction"),
    advance: money(adj.advance, "advance"),
  };
  const f = freshFigures(m, month, sessions, values);
  const note = cleanText(adj.note);

  await db.staffPayout.upsert({
    where: { membershipId_month: { membershipId, month } },
    create: { orgId, membershipId, month, ...f, note },
    update: { ...f, note },
  });
  await audit(session.id, orgId, "PAYROLL_ADJUSTED", { membershipId, month, ...values });
  revalidatePath("/org");
  return { ok: true, netAmount: f.netAmount };
}

/** Freeze the month's figures and record how the person was paid. */
async function markPayoutPaidImpl(membershipId: string, month: string, input: { paymentMode?: string; reference?: string } & Adjustments) {
  const { session } = await requirePermission("payroll.manage");
  const orgId = session.orgId;
  if (!isMonthString(month)) throw new Error("Pick a valid month");
  if (month > istMonthString()) throw new Error("You can't pay a future month yet");
  const m = await loadMember(orgId, membershipId);
  if (!m.payType) throw new Error(`Set ${m.user.name}'s pay on the Team screen first`);

  const existing = await db.staffPayout.findUnique({ where: { membershipId_month: { membershipId, month } } });
  if (existing?.status === "PAID") throw new Error("Already marked paid");

  const sessions = (await sessionsByCoach(orgId, month)).get(m.userId) ?? 0;
  const values = {
    bonus: input.bonus !== undefined ? money(input.bonus, "bonus") : existing?.bonus ?? 0,
    deduction: input.deduction !== undefined ? money(input.deduction, "deduction") : existing?.deduction ?? 0,
    advance: input.advance !== undefined ? money(input.advance, "advance") : existing?.advance ?? 0,
  };
  const f = freshFigures(m, month, sessions, values);
  const paid = {
    status: "PAID",
    paidAt: new Date(),
    paidById: session.id,
    paymentMode: isPaymentMode(input.paymentMode) ? input.paymentMode : "CASH",
    reference: cleanText(input.reference, 80),
    note: input.note !== undefined ? cleanText(input.note) : existing?.note ?? null,
  };

  await db.staffPayout.upsert({
    where: { membershipId_month: { membershipId, month } },
    create: { orgId, membershipId, month, ...f, ...paid },
    update: { ...f, ...paid },
  });
  await audit(session.id, orgId, "PAYROLL_PAID", { membershipId, month, net: f.netAmount, mode: paid.paymentMode });
  revalidatePath("/org");
  return { ok: true, netAmount: f.netAmount };
}

/** Undo a "paid" mark (for mistakes). Figures go back to being recalculated. */
async function markPayoutUnpaidImpl(membershipId: string, month: string) {
  const { session } = await requirePermission("payroll.manage");
  const orgId = session.orgId;
  const p = await db.staffPayout.findFirst({ where: { orgId, membershipId, month } });
  if (!p || p.status !== "PAID") return { ok: true };
  await db.staffPayout.update({
    where: { id: p.id },
    data: { status: "PENDING", paidAt: null, paidById: null, paymentMode: null, reference: null },
  });
  await audit(session.id, orgId, "PAYROLL_UNPAID", { membershipId, month });
  revalidatePath("/org");
  return { ok: true };
}

// ───────────────────────────── Expenses ─────────────────────────────

async function addExpenseImpl(input: { date?: string; category: string; amount: number | string; note?: string; paymentMode?: string }) {
  const { session } = await requirePermission("payroll.manage");
  const orgId = session.orgId;
  if (!isExpenseCategory(input.category)) throw new Error("Pick a category");
  const amount = money(input.amount, "amount");
  if (amount <= 0) throw new Error("Enter the amount spent");

  const day = typeof input.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : null;
  const date = day ? new Date(`${day}T00:00:00.000Z`) : istToday();
  if (Number.isNaN(date.getTime())) throw new Error("Pick a valid date");
  if (date > istToday()) throw new Error("The date can't be in the future");

  const e = await db.expense.create({
    data: {
      orgId,
      date,
      category: input.category,
      amount,
      note: cleanText(input.note),
      paymentMode: isPaymentMode(input.paymentMode) ? input.paymentMode : null,
      createdById: session.id,
    },
  });
  await audit(session.id, orgId, "EXPENSE_ADDED", { id: e.id, category: e.category, amount });
  revalidatePath("/org");
  return { ok: true, id: e.id };
}

async function deleteExpenseImpl(id: string) {
  const { session } = await requirePermission("payroll.manage");
  const orgId = session.orgId;
  const e = await db.expense.findFirst({ where: { id, orgId } });
  if (!e) throw new Error("Expense not found");
  await db.expense.delete({ where: { id: e.id } });
  await audit(session.id, orgId, "EXPENSE_DELETED", { id, category: e.category, amount: e.amount });
  revalidatePath("/org");
  return { ok: true };
}

// ───────────────────────────── Public actions ─────────────────────────────

export async function getPayroll(month?: string) {
  return attempt(() => getPayrollImpl(month), "payroll");
}
export async function savePayoutAdjustments(membershipId: string, month: string, adj: Adjustments) {
  return attempt(() => savePayoutAdjustmentsImpl(membershipId, month, adj), "payroll");
}
export async function markPayoutPaid(membershipId: string, month: string, input: { paymentMode?: string; reference?: string } & Adjustments) {
  return attempt(() => markPayoutPaidImpl(membershipId, month, input), "payroll");
}
export async function markPayoutUnpaid(membershipId: string, month: string) {
  return attempt(() => markPayoutUnpaidImpl(membershipId, month), "payroll");
}
export async function addExpense(input: { date?: string; category: string; amount: number | string; note?: string; paymentMode?: string }) {
  return attempt(() => addExpenseImpl(input), "payroll");
}
export async function deleteExpense(id: string) {
  return attempt(() => deleteExpenseImpl(id), "payroll");
}
