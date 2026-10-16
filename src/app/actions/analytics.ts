'use server'
import { db } from '@/lib/db'
import { requireAuth } from "@/lib/auth";

// NOTE: every function below scopes to the caller's own academy (session.orgId).
// The optional `orgId` argument is kept for backwards compatibility but is never
// trusted — server actions can be invoked directly from the browser.
const NO_ORG = "__no_org__";

async function adminOrgId() {
  const session = await requireAuth(['ADMIN']);
  return session.orgId || NO_ORG;
}

/**
 * All-time attendance totals per batch of the academy, computed in Postgres (one row per batch)
 * instead of loading every session with every attendance row (years of history) into memory.
 * Same scope as before: all sessions of the academy's batches, all their attendance rows.
 * Counts are cast to int (raw COUNT() is bigint).
 */
async function attendanceTotalsByBatch(orgId: string) {
  const rows = await db.$queryRaw<{ batchId: string; total: number; present: number }[]>`
    SELECT s."batchId" AS "batchId",
      COUNT(*)::int AS "total",
      (COUNT(*) FILTER (WHERE a."isPresent"))::int AS "present"
    FROM "Attendance" a
    JOIN "Session" s ON s."id" = a."sessionId"
    JOIN "Batch" b ON b."id" = s."batchId"
    WHERE b."orgId" = ${orgId}
    GROUP BY s."batchId"`;
  return new Map(rows.map((r) => [r.batchId, { total: Number(r.total), present: Number(r.present) }]));
}

export async function getAttendanceAnalytics(_orgId?: string) {
  const orgId = await adminOrgId();
  const [batches, totals] = await Promise.all([
    // Session count only (was: every session + every attendance row)
    db.batch.findMany({
      where: { orgId },
      select: { id: true, name: true, _count: { select: { sessions: true } } },
    }),
    attendanceTotalsByBatch(orgId),
  ]);

  return batches.map(batch => {
    const totalSessions = batch._count.sessions;
    const totalPresent = totals.get(batch.id)?.present ?? 0;
    const totalAttendances = totals.get(batch.id)?.total ?? 0;

    const avgAttendance = totalAttendances === 0 ? 0 : Math.round((totalPresent / totalAttendances) * 100);

    return {
      batchId: batch.id,
      batchName: batch.name,
      totalSessions,
      avgAttendance,
      atRiskStudents: []
    }
  })
}

export async function getRevenueAnalytics(_orgId?: string) {
  const orgId = await adminOrgId();
  // FeeRecord.orgId is optional on older rows — also match via the student's academy.
  // Totals per (month, status) instead of every fee record: the collected/pending sums and the
  // number of distinct months are all derivable from these buckets.
  const [feeGroups, currentStudents] = await Promise.all([
    db.feeRecord.groupBy({
      by: ['month', 'status'],
      where: { OR: [{ orgId }, { student: { orgId } }] },
      _sum: { amount: true },
    }),
    db.student.count({ where: { orgId } }),
  ]);

  let collected = 0;
  let pending = 0;

  feeGroups.forEach(group => {
    const amount = group._sum.amount ?? 0;
    if (group.status === 'PAID') {
      collected += amount;
    } else {
      pending += amount;
    }
  });

  const total = collected + pending;
  const collectionRate = total > 0 ? collected / total : 0;

  // Average billed per student per month (0 when nothing has been billed yet — no invented default)
  const months = new Set(feeGroups.map(g => g.month)).size || 1;
  const feeRate = total > 0 && currentStudents > 0 ? total / months / currentStudents : 0;

  const monthlyRevenue = [];
  let current = currentStudents;
  for (let i = 1; i <= 6; i++) {
    if (i > 1) {
      current = current * 1.05 * 0.97;
    }
    const val = current * feeRate * collectionRate;
    monthlyRevenue.push({ month: `Month ${i}`, revenue: Math.round(val) });
  }

  return {
    monthlyRevenue,
    projectedRevenue: monthlyRevenue[monthlyRevenue.length - 1]?.revenue || 0,
    collectionRate,
    pendingAmount: pending
  };
}

export async function getBatchHealthAnalytics(_orgId?: string) {
  const orgId = await adminOrgId();
  const [batches, totals] = await Promise.all([
    // Enrollment count + capacity only (was: every enrollment, session and attendance row)
    db.batch.findMany({
      where: { orgId },
      select: { id: true, name: true, capacity: true, _count: { select: { enrollments: true } } },
    }),
    attendanceTotalsByBatch(orgId),
  ]);

  return {
    batches: batches.map(batch => {
      // Fill rate only exists when the admin has set a capacity
      const fillRate = batch.capacity && batch.capacity > 0
        ? Math.min((batch._count.enrollments / batch.capacity) * 100, 100)
        : null;

      const totalPresent = totals.get(batch.id)?.present ?? 0;
      const totalAttendances = totals.get(batch.id)?.total ?? 0;
      const attendanceRate = totalAttendances === 0 ? 0 : (totalPresent / totalAttendances) * 100;
      const trend = attendanceRate >= 70 ? 'up' : 'down';

      return {
        name: batch.name,
        fillRate,
        attendanceRate,
        trend
      };
    })
  };
}

export async function getStudentGrowthAnalytics(_orgId?: string) {
  const orgId = await adminOrgId();
  // Only the join date is read (was: full student rows)
  const students = await db.student.findMany({
    where: { orgId },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' }
  });

  const monthlyData: Record<string, number> = {};
  students.forEach(s => {
    const month = s.createdAt.toISOString().slice(0, 7);
    monthlyData[month] = (monthlyData[month] || 0) + 1;
  });

  const monthlyEnrollments = Object.entries(monthlyData).map(([month, count]) => ({ month, count }));

  return {
    monthlyEnrollments,
    // Churn isn't tracked yet (students have no "left" status) — UI shows "—"
    churnRate: null as number | null,
    netGrowth: students.length
  };
}

export async function getParentEngagementAnalytics(_orgId?: string) {
  const orgId = await adminOrgId();
  // Counts instead of rows: the parent list (with nested messages/fees), every RSVP and every
  // fee record were loaded before only to be counted.
  const [messageCount, parentCount, engaged, rsvpGroups, feeGroups] = await Promise.all([
    db.message.count({ where: { sender: { orgId } } }),
    db.user.count({ where: { orgId, role: 'PARENT' } }),
    // Engagement = share of parents who have messaged the academy or paid at least one fee
    db.user.count({
      where: {
        orgId,
        role: 'PARENT',
        OR: [
          { sentMessages: { some: {} } },
          { children: { some: { feeRecords: { some: { status: 'PAID' } } } } },
        ],
      },
    }),
    db.rSVP.groupBy({ by: ['status'], where: { student: { orgId } }, _count: { _all: true } }),
    db.feeRecord.groupBy({ by: ['status'], where: { student: { orgId } }, _count: { _all: true } }),
  ]);

  const engagementScore = parentCount > 0 ? Math.round((engaged / parentCount) * 100) : null;
  const rsvpTotal = rsvpGroups.reduce((n, g) => n + g._count._all, 0);
  const responded = rsvpGroups
    .filter(g => g.status === 'GOING' || g.status === 'NOT_GOING')
    .reduce((n, g) => n + g._count._all, 0);
  const rsvpRate = rsvpTotal > 0 ? responded / rsvpTotal : null;
  const feeTotal = feeGroups.reduce((n, g) => n + g._count._all, 0);
  const feesPaid = feeGroups.filter(g => g.status === 'PAID').reduce((n, g) => n + g._count._all, 0);
  const onTimePaymentRate = feeTotal > 0 ? feesPaid / feeTotal : null;

  return {
    engagementScore,
    messageCount,
    rsvpRate,
    onTimePaymentRate
  };
}
