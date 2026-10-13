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

export async function getAttendanceAnalytics(_orgId?: string) {
  const orgId = await adminOrgId();
  const batches = await db.batch.findMany({
    where: { orgId },
    include: {
      sessions: {
        include: { attendances: true }
      }
    }
  })
  
  return batches.map(batch => {
    let totalSessions = batch.sessions.length;
    let totalPresent = 0;
    let totalAttendances = 0;
    
    batch.sessions.forEach(session => {
      totalAttendances += session.attendances.length;
      totalPresent += session.attendances.filter(a => a.isPresent).length;
    })
    
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
  // FeeRecord.orgId is optional on older rows — also match via the student's academy
  const feeRecords = await db.feeRecord.findMany({ where: { OR: [{ orgId }, { student: { orgId } }] } });
  
  let collected = 0;
  let pending = 0;
  
  feeRecords.forEach(record => {
    if (record.status === 'PAID') {
      collected += record.amount;
    } else {
      pending += record.amount;
    }
  });

  const total = collected + pending;
  const collectionRate = total > 0 ? collected / total : 0;
  
  const currentStudents = await db.student.count({ where: { orgId } });
  // Average billed per student per month (0 when nothing has been billed yet — no invented default)
  const months = new Set(feeRecords.map(r => r.month)).size || 1;
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
  const batches = await db.batch.findMany({
    where: { orgId },
    include: {
      enrollments: true,
      sessions: {
        include: { attendances: true }
      }
    }
  });

  return {
    batches: batches.map(batch => {
      // Fill rate only exists when the admin has set a capacity
      const fillRate = batch.capacity && batch.capacity > 0
        ? Math.min((batch.enrollments.length / batch.capacity) * 100, 100)
        : null;
      
      let totalPresent = 0;
      let totalAttendances = 0;
      batch.sessions.forEach(session => {
        totalAttendances += session.attendances.length;
        totalPresent += session.attendances.filter(a => a.isPresent).length;
      });
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
  const students = await db.student.findMany({
    where: { orgId },
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
  const [messageCount, parents, rsvps, fees] = await Promise.all([
    db.message.count({ where: { sender: { orgId } } }),
    db.user.findMany({
      where: { orgId, role: 'PARENT' },
      select: {
        id: true,
        sentMessages: { select: { id: true }, take: 1 },
        children: { select: { feeRecords: { where: { status: 'PAID' }, select: { id: true }, take: 1 } } },
      },
    }),
    db.rSVP.findMany({ where: { student: { orgId } }, select: { status: true } }),
    db.feeRecord.findMany({ where: { student: { orgId } }, select: { status: true } }),
  ]);

  // Engagement = share of parents who have messaged the academy or paid at least one fee
  const engaged = parents.filter(p => p.sentMessages.length > 0 || p.children.some(s => s.feeRecords.length > 0)).length;
  const engagementScore = parents.length > 0 ? Math.round((engaged / parents.length) * 100) : null;
  const responded = rsvps.filter(r => r.status === 'GOING' || r.status === 'NOT_GOING').length;
  const rsvpRate = rsvps.length > 0 ? responded / rsvps.length : null;
  const onTimePaymentRate = fees.length > 0 ? fees.filter(f => f.status === 'PAID').length / fees.length : null;

  return { 
    engagementScore, 
    messageCount, 
    rsvpRate, 
    onTimePaymentRate 
  };
}
