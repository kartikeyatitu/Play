/** Server-only loader for coach insights (current month). Scoped to one orgId; callers check permissions. */
import { db } from "@/lib/db";
import { istDateString } from "@/lib/fees";
import { addMonths } from "@/lib/insights";
import { buildCoachInsights, type CoachRow } from "@/lib/coach-insights";

export async function loadCoachInsights(orgId: string, now: Date = new Date()): Promise<{ month: string; coaches: CoachRow[] }> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { timezone: true } });
  const today = istDateString(now, org?.timezone || "Asia/Kolkata");
  const month = today.slice(0, 7);
  const from = new Date(`${month}-01T00:00:00.000Z`);
  const to = new Date(`${addMonths(month, 1)}-01T00:00:00.000Z`);
  const sessionWhere = { batch: { orgId }, date: { gte: from, lt: to }, status: { not: "CANCELLED" } };

  const [batches, sessions, attendance, reports] = await Promise.all([
    db.batch.findMany({ where: { orgId }, select: { id: true, coachId: true, coach: { select: { name: true } }, enrollments: { select: { studentId: true } } } }),
    db.session.findMany({ where: sessionWhere, select: { id: true, batchId: true, date: true } }),
    db.attendance.groupBy({ by: ["sessionId", "isPresent"], where: { session: sessionWhere }, _count: { _all: true } }),
    db.skillReport.findMany({ where: { month, student: { orgId } }, select: { studentId: true } }),
  ]);

  const perSession = new Map<string, { marked: number; present: number }>();
  for (const g of attendance) {
    const e = perSession.get(g.sessionId) ?? { marked: 0, present: 0 };
    e.marked += g._count._all;
    if (g.isPresent) e.present += g._count._all;
    perSession.set(g.sessionId, e);
  }
  return {
    month,
    coaches: buildCoachInsights({
      batches: batches.map((b) => ({ id: b.id, coachId: b.coachId, coachName: b.coach?.name || "Coach", studentIds: b.enrollments.map((e) => e.studentId) })),
      sessions: sessions.map((s) => ({ batchId: s.batchId, date: s.date.toISOString().slice(0, 10), ...(perSession.get(s.id) ?? { marked: 0, present: 0 }) })),
      evaluatedStudentIds: new Set(reports.map((r) => r.studentId)),
      today,
    }),
  };
}
