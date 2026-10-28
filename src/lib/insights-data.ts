/**
 * Server-only loader for owner insights (analytics step 1). Every query is scoped to one orgId;
 * callers must check the viewer's permission first. Pure maths: src/lib/insights.ts.
 */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { istDateString } from "@/lib/fees";
import {
  addDays,
  buildTrends,
  feeAgeing,
  lastNMonths,
  startOfDayInZone,
  type AgeingBucket,
  type MonthKey,
  type TrendPoint,
} from "@/lib/insights";

export type OwnerSnapshot = {
  receivedToday: { amount: number; count: number };
  receivedYesterday: { amount: number; count: number };
  sessionsToday: number;
  sessionsMarkedToday: number;
  trialsToday: number;
  enquiriesToday: number;
  enquiriesYesterday: number;
  outstanding: { amount: number; count: number };
};

export type OwnerInsights = {
  currency: string;
  timezone: string;
  today: string;
  currentMonth: MonthKey;
  snapshot: OwnerSnapshot;
  ageing: AgeingBucket[];
  trends: TrendPoint[];
};

export async function loadOwnerInsights(orgId: string, now: Date = new Date()): Promise<OwnerInsights> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { currency: true, timezone: true } });
  const tz = org?.timezone || "Asia/Kolkata";
  const today = istDateString(now, tz);
  const currentMonth = today.slice(0, 7);
  const months = lastNMonths(currentMonth, 12);
  const windowStart = startOfDayInZone(`${months[0]}-01`, tz);
  const todayStart = startOfDayInZone(today, tz);
  const yesterdayStart = startOfDayInZone(addDays(today, -1), tz);
  const tomorrowStart = startOfDayInZone(addDays(today, 1), tz);
  // Sessions and trials store their calendar day as UTC midnight.
  const todayCalendar = new Date(`${today}T00:00:00.000Z`);
  const windowCalendar = new Date(`${months[0]}-01T00:00:00.000Z`);

  // Older fee records may lack orgId; match them through the student (same rule as the business report).
  const feeScope: Prisma.FeeRecordWhereInput = { OR: [{ orgId }, { student: { orgId } }] };
  const paidBetween = (from: Date, to: Date) =>
    db.feeRecord.aggregate({
      where: { AND: [feeScope, { status: "PAID" }, { paidAt: { gte: from, lt: to } }] },
      _sum: { amount: true },
      _count: { _all: true },
    });

  const [fees, unpaid, paid, newStudents, attendanceRows, recToday, recYesterday, sessionsToday, trialsToday, enqToday, enqYesterday] =
    await Promise.all([
      db.feeRecord.findMany({ where: { AND: [feeScope, { month: { in: months } }] }, select: { month: true, amount: true, status: true } }),
      db.feeRecord.findMany({ where: { AND: [feeScope, { status: { not: "PAID" } }, { month: { lte: currentMonth } }] }, select: { month: true, amount: true } }),
      db.feeRecord.findMany({ where: { AND: [feeScope, { status: "PAID" }, { paidAt: { gte: windowStart } }] }, select: { amount: true, paidAt: true } }),
      db.student.findMany({ where: { orgId, createdAt: { gte: windowStart } }, select: { createdAt: true } }),
      db.$queryRaw<{ month: string; marked: number; present: number }[]>`
        SELECT to_char(s."date", 'YYYY-MM') AS "month",
          COUNT(*)::int AS "marked",
          (COUNT(*) FILTER (WHERE a."isPresent"))::int AS "present"
        FROM "Attendance" a
        JOIN "Session" s ON s."id" = a."sessionId"
        JOIN "Batch" b ON b."id" = s."batchId"
        WHERE b."orgId" = ${orgId} AND s."date" >= ${windowCalendar} AND s."status" <> 'CANCELLED'
        GROUP BY 1`,
      paidBetween(todayStart, tomorrowStart),
      paidBetween(yesterdayStart, todayStart),
      db.session.findMany({
        where: { batch: { orgId }, date: todayCalendar, status: { not: "CANCELLED" } },
        select: { _count: { select: { attendances: true } } },
      }),
      db.trialBooking.count({ where: { batch: { orgId }, date: todayCalendar } }),
      db.lead.count({ where: { orgId, createdAt: { gte: todayStart, lt: tomorrowStart } } }),
      db.lead.count({ where: { orgId, createdAt: { gte: yesterdayStart, lt: todayStart } } }),
    ]);

  const receivedByMonth = new Map<MonthKey, number>();
  for (const p of paid) {
    if (!p.paidAt) continue;
    const m = istDateString(p.paidAt, tz).slice(0, 7);
    receivedByMonth.set(m, (receivedByMonth.get(m) ?? 0) + Math.max(0, p.amount || 0));
  }
  const newStudentsByMonth = new Map<MonthKey, number>();
  for (const s of newStudents) {
    const m = istDateString(s.createdAt, tz).slice(0, 7);
    newStudentsByMonth.set(m, (newStudentsByMonth.get(m) ?? 0) + 1);
  }
  const attendanceByMonth = new Map(attendanceRows.map((r) => [r.month, { present: Number(r.present), marked: Number(r.marked) }]));

  const ageing = feeAgeing(unpaid, currentMonth);
  return {
    currency: org?.currency || "INR",
    timezone: tz,
    today,
    currentMonth,
    snapshot: {
      receivedToday: { amount: recToday._sum.amount ?? 0, count: recToday._count._all },
      receivedYesterday: { amount: recYesterday._sum.amount ?? 0, count: recYesterday._count._all },
      sessionsToday: sessionsToday.length,
      sessionsMarkedToday: sessionsToday.filter((s) => s._count.attendances > 0).length,
      trialsToday,
      enquiriesToday: enqToday,
      enquiriesYesterday: enqYesterday,
      outstanding: {
        amount: Math.round(ageing.reduce((s, b) => s + b.amount, 0) * 100) / 100,
        count: ageing.reduce((s, b) => s + b.count, 0),
      },
    },
    ageing,
    trends: buildTrends({ months, fees, receivedByMonth, newStudentsByMonth, attendanceByMonth }),
  };
}
