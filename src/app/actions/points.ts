"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

// Points rules:
// +10 for each session attended
// +5 bonus for 3+ consecutive sessions
// +20 for perfect week (all sessions in a week)
// +15 for good skill report (avg >= 4)
// -5 for each missed session

export async function recalculatePoints(studentId: string) {
    const session = await requireAuth(['ADMIN']);
  const student = await db.student.findFirst({
    where: { id: studentId, orgId: session.orgId || "__no_org__" },
    include: {
      attendances: { include: { session: true }, orderBy: { sessionId: "desc" } },
      skillReports: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!student) return { success: false };

  let points = 0;
  let streak = 0;

  // Attendance points
  for (const att of student.attendances) {
    if (att.isPresent) {
      points += 10;
      streak++;
      if (streak >= 3) points += 5; // streak bonus
    } else {
      points -= 5;
      streak = 0;
    }
  }

  // Skill report bonus
  for (const report of student.skillReports) {
    const avg = (report.technique + report.fitness + report.discipline) / 3;
    if (avg >= 4) points += 15;
    else if (avg >= 3) points += 5;
  }

  // Ensure non-negative
  points = Math.max(0, points);

  await db.student.update({ where: { id: student.id }, data: { points } });
  revalidatePath("/parent");
  revalidatePath("/org");
  return { success: true, points };
}

export async function recalculateAllPoints() {
    const session = await requireAuth(['ADMIN']);
  // Tenant scope: only this academy's students
  const students = await db.student.findMany({ where: { orgId: session.orgId || "__no_org__" }, select: { id: true } });
  const results = await Promise.all(students.map(s => recalculatePoints(s.id)));
  return { success: true, updated: results.length };
}

// Get point breakdown for a student
export async function getPointBreakdown(studentId: string) {
    const session = await requireAuth(['ADMIN']);
  const student = await db.student.findFirst({
    where: { id: studentId, orgId: session.orgId || "__no_org__" },
    include: {
      attendances: { include: { session: true } },
      skillReports: true,
    },
  });
  if (!student) return null;

  const attended = student.attendances.filter(a => a.isPresent).length;
  const missed = student.attendances.filter(a => !a.isPresent).length;
  const avgSkill = student.skillReports.length > 0
    ? student.skillReports.reduce((sum, r) => sum + (r.technique + r.fitness + r.discipline) / 3, 0) / student.skillReports.length
    : 0;

  return {
    total: student.points,
    breakdown: {
      attendancePoints: attended * 10,
      missedPenalty: missed * -5,
      skillBonus: student.skillReports.filter(r => (r.technique + r.fitness + r.discipline) / 3 >= 4).length * 15,
      sessionsAttended: attended,
      sessionsMissed: missed,
      averageSkill: Math.round(avgSkill * 10) / 10,
    },
  };
}
