// Coach OS reads. Server only (imports the database). Pages under src/app/coach use these; the access
// rules themselves live in ./access.ts so they can be unit tested.
//
// Medical data: nothing here selects Student.medicalInfo or bloodGroup, so Coach OS screens can never
// show more than src/lib/athlete/medical-visibility.ts allows.

import { db } from "@/lib/db";
import { requireMember } from "@/lib/membership";
import { istMonthString, istToday, istWeekday, scheduleRunsOn } from "@/lib/fees";
import { attendanceStatusOf, scheduleStartMinutes, scheduleTime } from "@/lib/coach";
import { batchWhereFor, canAssessStudent, canViewAllBatches, resolveScope, type BatchScope } from "./access";
import { ATTENDANCE_WINDOW_DAYS, buildRoster, type RosterRow } from "./roster";
import type { StoredReport } from "./assessment";
import type { DaySession } from "./day";

export type { DaySession };

export type CoachOsContext = Awaited<ReturnType<typeof loadCoachOsContext>>;

/** Signed-in team member plus the batch scope they may use. */
export async function loadCoachOsContext(scopeParam?: string | null) {
  const { session, membership } = await requireMember(["ADMIN", "COACH", "STAFF"]);
  const scope: BatchScope = resolveScope(scopeParam, membership);
  return {
    userId: session.id as string,
    orgId: session.orgId,
    membership,
    scope,
    canViewAll: canViewAllBatches(membership),
    batchWhere: batchWhereFor(scope, session.id, session.orgId),
  };
}

export async function loadRoster(ctx: CoachOsContext): Promise<{ rows: RosterRow[]; batchCount: number; currentMonth: string }> {
  const batches = await db.batch.findMany({
    where: ctx.batchWhere,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      sport: true,
      enrollments: { where: { student: { orgId: ctx.orgId } }, select: { student: { select: { id: true, name: true } } } },
    },
  });
  const batchIds = batches.map((b) => b.id);
  const studentIds = [...new Set(batches.flatMap((b) => b.enrollments.map((e) => e.student.id)))];
  const since = new Date(istToday().getTime() - ATTENDANCE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [marks, reports] = studentIds.length
    ? await Promise.all([
        // Only attendance in batches within scope: a coach doesn't see another coach's registers.
        db.attendance.findMany({
          where: { studentId: { in: studentIds }, session: { batchId: { in: batchIds }, date: { gte: since }, status: { not: "CANCELLED" } } },
          select: { studentId: true, status: true, isPresent: true },
        }),
        db.skillReport.findMany({
          where: { studentId: { in: studentIds } },
          orderBy: { month: "desc" },
          distinct: ["studentId"],
          select: { studentId: true, month: true },
        }),
      ])
    : [[], []];

  const rows = buildRoster(
    batches.map((b) => ({ id: b.id, name: b.name, sport: b.sport, students: b.enrollments.map((e) => e.student) })),
    marks,
    new Map(reports.map((r) => [r.studentId, r.month])),
  );
  return { rows, batchCount: batches.length, currentMonth: istMonthString() };
}

export interface AssessTarget {
  student: { id: string; name: string };
  batchSports: string[];
  currentMonth: string;
  thisMonth: StoredReport | null;
  previous: StoredReport | null;
}

/** A student the member may assess, with this month's and the previous report; null when refused or missing. */
export async function loadAssessTarget(ctx: CoachOsContext, studentId: string): Promise<AssessTarget | null> {
  const student = await db.student.findFirst({
    where: { id: studentId, orgId: ctx.orgId },
    select: {
      id: true,
      name: true,
      enrollments: { select: { batch: { select: { coachId: true, orgId: true, sport: true } } } },
    },
  });
  if (!student) return null;
  const ownBatches = student.enrollments.filter((e) => e.batch.orgId === ctx.orgId && e.batch.coachId === ctx.userId);
  if (!canAssessStudent(ctx.membership, ownBatches.length > 0)) return null;

  const currentMonth = istMonthString();
  const select = { month: true, sport: true, technique: true, fitness: true, discipline: true, metrics: true } as const;
  const [thisMonth, previous] = await Promise.all([
    db.skillReport.findUnique({ where: { studentId_month: { studentId, month: currentMonth } }, select: { ...select, notes: true } }),
    db.skillReport.findFirst({ where: { studentId, month: { lt: currentMonth } }, orderBy: { month: "desc" }, select }),
  ]);
  const sportsFrom = ownBatches.length ? ownBatches : student.enrollments.filter((e) => e.batch.orgId === ctx.orgId);
  return {
    student: { id: student.id, name: student.name },
    batchSports: [...new Set(sportsFrom.map((e) => e.batch.sport).filter(Boolean))],
    currentMonth,
    thisMonth,
    previous,
  };
}

/** Today's sessions in scope (scheduled for today or already opened), ordered by start time. */
export async function loadTodaySessions(ctx: CoachOsContext): Promise<DaySession[]> {
  const today = istToday();
  const weekday = istWeekday();
  const batches = await db.batch.findMany({
    where: ctx.batchWhere,
    select: {
      id: true,
      name: true,
      sport: true,
      schedule: true,
      enrollments: {
        where: { student: { orgId: ctx.orgId } },
        orderBy: { student: { name: "asc" } },
        select: { student: { select: { id: true, name: true } } },
      },
      sessions: {
        where: { date: today },
        select: { status: true, attendances: { select: { studentId: true, status: true, isPresent: true } } },
      },
    },
  });
  return batches
    .filter((b) => b.sessions.length > 0 || scheduleRunsOn(b.schedule, weekday) !== false)
    .sort((a, b) => scheduleStartMinutes(a.schedule) - scheduleStartMinutes(b.schedule))
    .map((b) => {
      const s = b.sessions[0];
      const marks = new Map((s?.attendances ?? []).map((a) => [a.studentId, attendanceStatusOf(a)]));
      return {
        batchId: b.id,
        batchName: b.name,
        sport: b.sport,
        time: scheduleTime(b.schedule) || b.schedule || null,
        cancelled: s?.status === "CANCELLED",
        students: b.enrollments.map((e) => ({ id: e.student.id, name: e.student.name, status: marks.get(e.student.id) ?? null })),
      };
    });
}
