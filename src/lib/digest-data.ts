/** Server-only loader for the weekly summary (last 7 days vs the 7 before). Scoped to one orgId. */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { istDateString } from "@/lib/fees";
import { addDays, feeAgeing, startOfDayInZone } from "@/lib/insights";
import { loadAtRiskStudents } from "@/lib/risk-data";
import { buildDigest, type DigestLine, type WeekFigures } from "@/lib/digest";

export type WeeklyDigest = { weekLabel: string; lines: DigestLine[]; actions: string[]; text: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function label(from: string, to: string): string {
  const [, m1, d1] = from.split("-").map(Number);
  const [, m2, d2] = to.split("-").map(Number);
  return m1 === m2 ? `${d1}–${d2} ${MONTHS[m2 - 1]}` : `${d1} ${MONTHS[m1 - 1]} – ${d2} ${MONTHS[m2 - 1]}`;
}

export async function loadWeeklyDigest(orgId: string, now: Date = new Date()): Promise<WeeklyDigest> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { name: true, timezone: true, currency: true } });
  const tz = org?.timezone || "Asia/Kolkata";
  const today = istDateString(now, tz);
  const currentMonth = today.slice(0, 7);
  const feeScope: Prisma.FeeRecordWhereInput = { OR: [{ orgId }, { student: { orgId } }] };

  // This week = the 7 days ending today; last week = the 7 days before that.
  const weeks = [
    { from: addDays(today, -6), to: addDays(today, 1) },
    { from: addDays(today, -13), to: addDays(today, -6) },
  ];
  const figures = await Promise.all(
    weeks.map(async (w): Promise<WeekFigures> => {
      const start = startOfDayInZone(w.from, tz);
      const end = startOfDayInZone(w.to, tz);
      const [received, attendance, enquiries, newStudents] = await Promise.all([
        db.feeRecord.aggregate({ where: { AND: [feeScope, { status: "PAID" }, { paidAt: { gte: start, lt: end } }] }, _sum: { amount: true } }),
        db.attendance.groupBy({
          by: ["isPresent"],
          where: { session: { batch: { orgId }, status: { not: "CANCELLED" }, date: { gte: new Date(`${w.from}T00:00:00.000Z`), lt: new Date(`${w.to}T00:00:00.000Z`) } } },
          _count: { _all: true },
        }),
        db.lead.count({ where: { orgId, createdAt: { gte: start, lt: end } } }),
        db.student.count({ where: { orgId, createdAt: { gte: start, lt: end } } }),
      ]);
      const marked = attendance.reduce((s, g) => s + g._count._all, 0);
      const present = attendance.filter((g) => g.isPresent).reduce((s, g) => s + g._count._all, 0);
      return { received: received._sum.amount ?? 0, present, marked, enquiries, newStudents };
    }),
  );

  const [unpaid, risk] = await Promise.all([
    db.feeRecord.findMany({ where: { AND: [feeScope, { status: { not: "PAID" } }, { month: { lte: currentMonth } }] }, select: { month: true, amount: true } }),
    loadAtRiskStudents(orgId, { canContact: false, now }),
  ]);
  const ageing = feeAgeing(unpaid, currentMonth);
  const weekLabel = label(weeks[0].from, today);
  const digest = buildDigest({
    academyName: org?.name || "Your academy",
    currency: org?.currency || "INR",
    weekLabel,
    thisWeek: figures[0],
    lastWeek: figures[1],
    outstanding: { amount: ageing.reduce((s, b) => s + b.amount, 0), count: ageing.reduce((s, b) => s + b.count, 0) },
    overdue3Plus: ageing.find((b) => b.key === "m3plus")?.count ?? 0,
    risk: { high: risk.high, medium: risk.medium },
  });
  return { weekLabel, ...digest };
}
