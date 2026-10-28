/** Server-only loader for analytics step 3 (funnel + cohorts). Scoped to one orgId; callers check permissions. */
import { db } from "@/lib/db";
import { istDateString } from "@/lib/fees";
import { addDays, lastNMonths, startOfDayInZone, type MonthKey } from "@/lib/insights";
import { buildCohorts, buildFunnel, type CohortRow, type FunnelRow } from "@/lib/funnel";

export const FUNNEL_DAYS = 180;
export const COHORT_MONTHS = 6;

export type FunnelAndCohorts = { funnel: { rows: FunnelRow[]; total: FunnelRow }; cohorts: CohortRow[]; funnelDays: number };

export async function loadFunnelAndCohorts(orgId: string, now: Date = new Date()): Promise<FunnelAndCohorts> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { timezone: true } });
  const tz = org?.timezone || "Asia/Kolkata";
  const today = istDateString(now, tz);
  const currentMonth = today.slice(0, 7);
  const since = startOfDayInZone(addDays(today, -FUNNEL_DAYS), tz);
  const cohortMonths = lastNMonths(currentMonth, COHORT_MONTHS);
  const cohortStart = startOfDayInZone(`${cohortMonths[0]}-01`, tz);
  const cohortCalendar = new Date(`${cohortMonths[0]}-01T00:00:00.000Z`);

  const [leads, trials, recentStudents, cohortStudents, active] = await Promise.all([
    db.lead.findMany({ where: { orgId, createdAt: { gte: since } }, select: { source: true, status: true, parentPhone: true, createdAt: true } }),
    db.trialBooking.findMany({ where: { batch: { orgId }, createdAt: { gte: since } }, select: { parentPhone: true, status: true, createdAt: true } }),
    db.student.findMany({ where: { orgId, createdAt: { gte: since } }, select: { createdAt: true, parent: { select: { phone: true } } } }),
    db.student.findMany({ where: { orgId, createdAt: { gte: cohortStart } }, select: { id: true, createdAt: true } }),
    db.$queryRaw<{ studentId: string; month: string }[]>`
      SELECT DISTINCT a."studentId" AS "studentId", to_char(s."date", 'YYYY-MM') AS "month"
      FROM "Attendance" a
      JOIN "Session" s ON s."id" = a."sessionId"
      JOIN "Batch" b ON b."id" = s."batchId"
      WHERE b."orgId" = ${orgId} AND a."isPresent" = true AND s."status" <> 'CANCELLED' AND s."date" >= ${cohortCalendar}`,
  ]);

  const funnel = buildFunnel(
    leads.map((l) => ({ source: l.source, status: l.status, phone: l.parentPhone, createdAt: l.createdAt })),
    trials.map((t) => ({ phone: t.parentPhone, status: t.status, createdAt: t.createdAt })),
    recentStudents.map((s) => ({ phone: s.parent?.phone ?? "", createdAt: s.createdAt })),
  );

  const activeMonths = new Map<string, Set<MonthKey>>();
  for (const r of active) {
    const set = activeMonths.get(r.studentId) ?? new Set<MonthKey>();
    set.add(r.month);
    activeMonths.set(r.studentId, set);
  }
  const cohorts = buildCohorts(
    cohortStudents.map((s) => ({ id: s.id, joinedMonth: istDateString(s.createdAt, tz).slice(0, 7) })),
    activeMonths,
    currentMonth,
    COHORT_MONTHS,
  );

  return { funnel, cohorts, funnelDays: FUNNEL_DAYS };
}
