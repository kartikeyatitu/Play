/**
 * Server-only loader for the V1 Business report (and the V11 consolidated report). Every query is scoped to one
 * orgId; callers must have checked the viewer's permission for that org first. Pure maths lives in
 * src/lib/business-report.ts.
 */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { slotInstant } from "@/lib/turf";
import { ALLOCATION_GROUP_PREFIX } from "@/lib/facility-allocation";
import {
  COUNTED_BOOKING_STATUSES,
  attributedBatchId,
  bookingHours,
  daysInMonth,
  monthBounds,
  type ReportInput,
} from "@/lib/business-report";

export type LoadedReport = { input: ReportInput; branchByBatch: Map<string, string> };

export async function loadBusinessReportInput(orgId: string, month: string, opts: { withBranches?: boolean } = {}): Promise<LoadedReport> {
  const { from, to } = monthBounds(month);
  const [y, m] = month.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  // Older fee records may lack orgId; match them through the student (same rule as the dashboard).
  const feeScope: Prisma.FeeRecordWhereInput = { OR: [{ orgId }, { student: { orgId } }] };
  const sessionWhere: Prisma.SessionWhereInput = { batch: { orgId }, date: { gte: from, lt: to } };

  const [fees, outstanding, batches, sessions, attendance, active, newInMonth, trials, facilities, bookings, branchLinks] = await Promise.all([
    db.feeRecord.findMany({
      where: { AND: [feeScope, { month }] },
      select: { amount: true, status: true, student: { select: { enrollments: { where: { batch: { orgId } }, select: { batchId: true, joinedAt: true } } } } },
    }),
    db.feeRecord.aggregate({
      where: { AND: [feeScope, { status: { not: "PAID" } }, { month: { lte: month } }] },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.batch.findMany({ where: { orgId }, select: { id: true, name: true, capacity: true, _count: { select: { enrollments: true } } }, orderBy: { name: "asc" } }),
    db.session.findMany({ where: sessionWhere, select: { id: true, batchId: true, status: true } }),
    db.attendance.groupBy({ by: ["sessionId", "isPresent"], where: { session: sessionWhere }, _count: { _all: true } }),
    db.student.count({ where: { orgId } }),
    db.student.count({ where: { orgId, createdAt: { gte: from, lt: to } } }),
    db.trialBooking.findMany({ where: { batch: { orgId }, date: { gte: from, lt: to } }, select: { status: true } }),
    db.facility.findMany({ where: { orgId, isActive: true }, select: { id: true, name: true, openHour: true, closeHour: true }, orderBy: { name: "asc" } }),
    db.turfBooking.findMany({
      where: {
        orgId,
        status: { in: [...COUNTED_BOOKING_STATUSES] },
        startTime: { gte: slotInstant(`${month}-01`, 0), lt: slotInstant(nextMonth, 0) },
      },
      select: { facilityId: true, startTime: true, endTime: true, status: true, advancePaid: true, leaseGroupId: true },
    }),
    opts.withBranches
      ? db.batchBranch.findMany({ where: { orgId }, select: { batchId: true, branchId: true } })
      : Promise.resolve([] as { batchId: string; branchId: string }[]),
  ]);

  const perSession = new Map<string, { marked: number; present: number }>();
  for (const g of attendance) {
    const e = perSession.get(g.sessionId) || { marked: 0, present: 0 };
    e.marked += g._count._all;
    if (g.isPresent) e.present += g._count._all;
    perSession.set(g.sessionId, e);
  }

  const input: ReportInput = {
    month,
    daysInMonth: daysInMonth(month),
    fees: fees.map((f) => ({ amount: f.amount, status: f.status, batchId: attributedBatchId(f.student.enrollments) })),
    outstandingAll: { amount: outstanding._sum.amount ?? 0, count: outstanding._count._all },
    batches: batches.map((b) => ({ id: b.id, name: b.name, capacity: b.capacity, enrolled: b._count.enrollments })),
    sessions: sessions.map((s) => ({ batchId: s.batchId, status: s.status, ...(perSession.get(s.id) ?? { marked: 0, present: 0 }) })),
    students: { active, newInMonth },
    trials,
    facilities,
    bookings: bookings.map((b) => ({
      facilityId: b.facilityId,
      hours: bookingHours(b.startTime, b.endTime),
      status: b.status,
      advancePaid: b.advancePaid,
      isAllocation: !!b.leaseGroupId?.startsWith(ALLOCATION_GROUP_PREFIX),
    })),
  };
  return { input, branchByBatch: new Map(branchLinks.map((l) => [l.batchId, l.branchId])) };
}
