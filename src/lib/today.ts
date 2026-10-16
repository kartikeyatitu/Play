import { db } from "@/lib/db";
import { istMonthString, istToday } from "@/lib/fees";
import { shiftMonth } from "@/lib/payroll";

/**
 * Extra Today-screen data from the team and payroll features:
 *  - students marked absent in today's sessions (with the parent's phone, for a WhatsApp check-in)
 *  - who in the team has checked in today
 *  - last month's salaries not yet marked paid, and this month's money so far (payroll.view only)
 */
export async function loadTodayPulse(orgId: string, opts: { canSeePay: boolean }) {
  const today = istToday();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const month = istMonthString();
  const prevMonth = shiftMonth(month, -1);
  const monthStartDay = new Date(`${month}-01T00:00:00.000Z`);
  const monthStartInstant = new Date(`${month}-01T00:00:00+05:30`);

  const [org, absences, members] = await Promise.all([
    db.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
    db.attendance.findMany({
      where: { isPresent: false, session: { date: { gte: today, lt: tomorrow }, status: { not: "CANCELLED" }, batch: { orgId } } },
      take: 40,
      select: {
        student: { select: { id: true, name: true, parent: { select: { name: true, phone: true } } } },
        session: { select: { batch: { select: { name: true } } } },
      },
    }),
    db.orgMembership.findMany({
      where: { orgId, status: "ACTIVE", role: { not: "OWNER" } },
      select: {
        id: true,
        role: true,
        payType: true,
        payAmount: true,
        joinedAt: true,
        user: { select: { name: true } },
        attendance: { where: { date: today }, select: { status: true, checkInAt: true } },
      },
    }),
  ]);

  // A student can be absent from two batches today; show them once
  const seen = new Set<string>();
  const absentToday = absences
    .filter((a) => (seen.has(a.student.id) ? false : (seen.add(a.student.id), true)))
    .map((a) => ({
      studentId: a.student.id,
      name: a.student.name,
      batchName: a.session.batch.name,
      parentName: a.student.parent?.name ?? null,
      parentPhone: a.student.parent?.phone ?? null,
    }));

  const team = members.length
    ? {
        total: members.length,
        checkedIn: members.filter((m) => m.attendance[0]?.status === "PRESENT" || m.attendance[0]?.status === "HALF_DAY").length,
        onLeave: members.filter((m) => m.attendance[0]?.status === "LEAVE").length,
        notMarked: members.filter((m) => !m.attendance[0]).map((m) => ({ name: m.user.name, role: m.role })),
      }
    : null;

  let payroll: { month: string; unpaid: string[] } | null = null;
  let money: { collected: number; expenses: number; salariesPaid: number } | null = null;

  if (opts.canSeePay) {
    const payable = members.filter((m) => m.payType && (m.payAmount ?? 0) > 0 && m.joinedAt < monthStartInstant);
    const [paidLastMonth, fees, expenses, salaries] = await Promise.all([
      db.staffPayout.findMany({
        where: { orgId, month: prevMonth, status: "PAID", membershipId: { in: payable.map((m) => m.id) } },
        select: { membershipId: true },
      }),
      db.feeRecord.aggregate({
        where: {
          status: "PAID",
          AND: [
            { OR: [{ orgId }, { orgId: null, student: { orgId } }] },
            { OR: [{ paidAt: { gte: monthStartInstant } }, { paidAt: null, month }] },
          ],
        },
        _sum: { amount: true },
      }),
      db.expense.aggregate({ where: { orgId, date: { gte: monthStartDay } }, _sum: { amount: true } }),
      db.staffPayout.aggregate({ where: { orgId, status: "PAID", paidAt: { gte: monthStartInstant } }, _sum: { netAmount: true } }),
    ]);
    const paid = new Set(paidLastMonth.map((p) => p.membershipId));
    const unpaid = payable.filter((m) => !paid.has(m.id)).map((m) => m.user.name);
    payroll = unpaid.length ? { month: prevMonth, unpaid } : null;
    money = {
      collected: Math.round(fees._sum.amount ?? 0),
      expenses: expenses._sum.amount ?? 0,
      salariesPaid: salaries._sum.netAmount ?? 0,
    };
  }

  return { academyName: org?.name ?? "", absentToday, team, payroll, money };
}

export type TodayPulse = Awaited<ReturnType<typeof loadTodayPulse>>;
