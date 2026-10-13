"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

// COACH added: skill reports are submitted from the coach dashboard (EvaluateModal).
export async function submitSkillReport(studentId: string, coachId: string, month: string, technique: number, fitness: number, discipline: number, notes: string) {
    const session = await requireAuth(['ADMIN', 'COACH']);
  const orgId = session.orgId || "__no_org__";

  // Tenant scope: coaches only for students in their own batches; admins for any student in-org
  const student = await db.student.findFirst({
    where: session.role === "COACH"
      ? { id: studentId, orgId, enrollments: { some: { batch: { coachId: session.id, orgId } } } }
      : { id: studentId, orgId },
    select: { id: true, orgId: true },
  });
  if (!student) return { success: false, error: "Student not found" };

  // Never trust coachId: coaches always submit as themselves; admins may attribute to a staff member in-org
  let authorId = session.id as string;
  if (session.role === "ADMIN" && coachId && coachId !== session.id) {
    const staff = await db.user.findFirst({ where: { id: coachId, orgId, role: { in: ["COACH", "ADMIN"] } }, select: { id: true } });
    if (staff) authorId = staff.id;
  }

  await db.skillReport.upsert({
    where: {
      studentId_month: { studentId: student.id, month }
    },
    update: {
      technique, fitness, discipline, notes, coachId: authorId, orgId: student.orgId
    },
    create: {
      studentId: student.id, month, coachId: authorId, technique, fitness, discipline, notes, orgId: student.orgId
    }
  });

  revalidatePath("/coach");
  revalidatePath("/parent");
  return { success: true };
}
