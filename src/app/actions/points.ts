"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/membership";
import { calculatePoints } from "@/lib/athlete/points-rules";

// Points rules live in src/lib/athlete/points-rules.ts (pure, unit-tested).
// Missing a session never reduces points: there is no deduction and the streak is only paused.

/** Skill reports that count towards points: the latest five. */
const SKILL_REPORTS_COUNTED = 5;

export async function recalculatePoints(studentId: string) {
  const { session } = await requirePermission("students.manage");
  const result = await recalculateStudentPoints(session.orgId, studentId);
  revalidatePath("/parent");
  revalidatePath("/org");
  return result;
}

/** Loads what the points rules need for one student of `orgId`, or null. */
async function loadPointsInputs(orgId: string, studentId: string) {
  return db.student.findFirst({
    where: { id: studentId, orgId },
    select: {
      id: true,
      points: true,
      attendances: { select: { isPresent: true, status: true, session: { select: { date: true } } } },
      skillReports: {
        orderBy: { createdAt: "desc" },
        take: SKILL_REPORTS_COUNTED,
        select: { technique: true, fitness: true, discipline: true },
      },
    },
  });
}

/** Recomputes one student's points (caller has already checked access to `orgId`). */
async function recalculateStudentPoints(orgId: string, studentId: string) {
  const student = await loadPointsInputs(orgId, studentId);
  if (!student) return { success: false };

  const { total } = calculatePoints(
    student.attendances.map((a) => ({ isPresent: a.isPresent, status: a.status, date: a.session?.date })),
    student.skillReports,
  );

  await db.student.update({ where: { id: student.id }, data: { points: total } });
  return { success: true, points: total };
}

export async function recalculateAllPoints() {
  const { session } = await requirePermission("students.manage");
  // Tenant scope: only this academy's students
  const students = await db.student.findMany({ where: { orgId: session.orgId }, select: { id: true } });
  const results = await Promise.all(students.map((s) => recalculateStudentPoints(session.orgId, s.id)));
  revalidatePath("/parent");
  revalidatePath("/org");
  return { success: true, updated: results.length };
}

// Get point breakdown for a student
export async function getPointBreakdown(studentId: string) {
  const { session } = await requirePermission("students.manage");
  const student = await loadPointsInputs(session.orgId, studentId);
  if (!student) return null;

  const b = calculatePoints(
    student.attendances.map((a) => ({ isPresent: a.isPresent, status: a.status, date: a.session?.date })),
    student.skillReports,
  );

  return {
    total: student.points,
    breakdown: {
      attendancePoints: b.attendancePoints,
      streakBonus: b.streakBonus,
      skillBonus: b.skillBonus,
      sessionsAttended: b.sessionsAttended,
      sessionsMissed: b.sessionsMissed,
      averageSkill: b.averageSkill,
    },
  };
}
