// Athlete Passport v1: loads one athlete's passport from existing production tables and the access facts
// for the policy. Server-only (DB). The assembly itself is pure: src/lib/athlete/passport-build.ts.
//
// Tables read: Student, User (coach names), Batch, BatchEnrollment, Session, Attendance, SkillReport,
// AthleteAchievement, AthleteGoal, AthleteMatchStat, LiveMatch, PerformanceResult, OrgMembership, and the
// academy's name from Organization. Never medical, incident or wellbeing data (Student.medicalInfo,
// bloodGroup, Incident) and no wave 2 table.

import { db } from "@/lib/db";
import { getMembership } from "@/lib/membership";
import { isMissingTableError } from "@/lib/schema-pending";
import { buildPassport, type Passport, type PassportSource } from "@/lib/athlete/passport-build";
import { decidePassportAccess, type PassportDecision } from "@/lib/athlete/passport-policy";

const ATTENDANCE_LIMIT = 500;
const MATCH_LIMIT = 300;
const RESULT_LIMIT = 500;
const SKILL_REPORT_LIMIT = 24;

/** Tables added after launch may be missing on an older database: treat them as empty. */
async function orEmpty<T>(p: Promise<T[]>): Promise<T[]> {
  try {
    return await p;
  } catch (e) {
    if (isMissingTableError(e)) return [];
    throw e;
  }
}

/** Loads the facts and applies the passport policy for this viewer and student. */
export async function passportAccess(viewerId: string | null, studentId: string): Promise<PassportDecision> {
  if (!viewerId || typeof studentId !== "string" || !studentId || studentId.length > 64) {
    return decidePassportAccess({ viewerId, student: null, membership: null, coachesStudent: false });
  }
  const student = await db.student.findUnique({ where: { id: studentId }, select: { id: true, orgId: true, parentId: true } });
  let membership = null;
  let coachesStudent = false;
  if (student && student.parentId !== viewerId && student.orgId) {
    membership = await getMembership(viewerId, student.orgId);
    if (membership) {
      const n = await db.batchEnrollment.count({
        where: { studentId: student.id, batch: { coachId: viewerId, orgId: student.orgId } },
      });
      coachesStudent = n > 0;
    }
  }
  return decidePassportAccess({ viewerId, student, membership, coachesStudent });
}

/** The passport for one athlete. Call only after passportAccess() allowed it. */
export async function loadPassport(studentId: string, now: Date = new Date()): Promise<Passport | null> {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      name: true,
      orgId: true,
      org: { select: { id: true, name: true } },
      enrollments: {
        orderBy: { joinedAt: "asc" },
        select: { batch: { select: { id: true, name: true, sport: true, schedule: true, orgId: true, coach: { select: { name: true } } } } },
      },
    },
  });
  if (!student) return null;
  const orgId = student.orgId;

  const [attendances, skillReports, achievements, goals, matchStats, performanceResults] = await Promise.all([
    db.attendance.findMany({
      where: { studentId: student.id },
      orderBy: { session: { date: "desc" } },
      take: ATTENDANCE_LIMIT,
      select: { isPresent: true, status: true, session: { select: { date: true, status: true } } },
    }),
    db.skillReport.findMany({
      where: { studentId: student.id },
      orderBy: { month: "desc" },
      take: SKILL_REPORT_LIMIT,
      select: { month: true, sport: true, technique: true, fitness: true, discipline: true, metrics: true, coach: { select: { name: true } } },
    }),
    orgId
      ? orEmpty(
          db.athleteAchievement.findMany({
            where: { orgId, studentId: student.id },
            orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
            select: {
              id: true,
              kind: true,
              title: true,
              competition: true,
              level: true,
              result: true,
              eventDate: true,
              status: true,
              submittedByRole: true,
              verifiedAt: true,
            },
          }),
        )
      : Promise.resolve([]),
    orgId
      ? orEmpty(
          db.athleteGoal.findMany({
            where: { orgId, studentId: student.id },
            orderBy: [{ status: "asc" }, { createdAt: "desc" }],
            select: { id: true, title: true, metric: true, baseline: true, target: true, dueDate: true, status: true, achievedAt: true },
          }),
        )
      : Promise.resolve([]),
    orgId
      ? orEmpty(
          db.athleteMatchStat.findMany({
            where: { orgId, studentId: student.id },
            orderBy: { playedAt: "desc" },
            take: MATCH_LIMIT,
            select: { matchId: true, sport: true, stats: true, playedAt: true, match: { select: { title: true, status: true } } },
          }),
        )
      : Promise.resolve([]),
    orgId
      ? orEmpty(
          db.performanceResult.findMany({
            where: { orgId, studentId: student.id },
            orderBy: { recordedAt: "desc" },
            take: RESULT_LIMIT,
            select: { sport: true, eventName: true, measure: true, value: true, status: true, recordedAt: true, matchId: true },
          }),
        )
      : Promise.resolve([]),
  ]);

  const source: PassportSource = {
    now,
    student: { id: student.id, name: student.name },
    academy: student.org ? { id: student.org.id, name: student.org.name } : null,
    batches: student.enrollments
      .map((e) => e.batch)
      .filter((b) => !orgId || b.orgId === orgId)
      .map((b) => ({ id: b.id, name: b.name, sport: b.sport, schedule: b.schedule, coachName: b.coach?.name ?? null })),
    attendances: attendances.map((a) => ({ isPresent: a.isPresent, status: a.status, date: a.session.date, sessionStatus: a.session.status })),
    matchStats: matchStats.map((m) => ({ matchId: m.matchId, sport: m.sport, stats: m.stats, playedAt: m.playedAt, title: m.match.title, matchStatus: m.match.status })),
    performanceResults,
    achievements,
    goals,
    skillReports: skillReports.map((r) => ({
      month: r.month,
      sport: r.sport,
      technique: r.technique,
      fitness: r.fitness,
      discipline: r.discipline,
      metrics: r.metrics,
      coachName: r.coach?.name ?? null,
    })),
  };
  return buildPassport(source);
}
