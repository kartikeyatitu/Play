"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { safeHttpUrl } from "@/lib/safe-url";

// Tenant/role scope: ADMIN → any student in their academy; COACH → students in their own batches.
function staffStudentWhere(session: { id: string; role: string; orgId: string | null }, studentId: string) {
  const orgId = session.orgId || "__no_org__";
  return session.role === "COACH"
    ? { id: studentId, orgId, enrollments: { some: { batch: { coachId: session.id, orgId } } } }
    : { id: studentId, orgId };
}

// COACH added: these are triggered from the coach dashboard (CoachActions).
export async function awardPoints(studentId: string, points: number) {
    const session = await requireAuth(['ADMIN', 'COACH']);
  if (!Number.isFinite(points)) return { success: false, error: "Invalid points" };
  const result = await db.student.updateMany({
    where: staffStudentWhere(session, studentId),
    data: { points: { increment: Math.trunc(points) } }
  });
  if (result.count === 0) return { success: false, error: "Student not found" };
  revalidatePath("/coach");
  revalidatePath("/parent");
  return { success: true };
}

export async function updateDietPlan(studentId: string, dietPlanUrl: string) {
    const session = await requireAuth(['ADMIN', 'COACH']);
  // Rendered as a link on the parent dashboard: only absolute http(s) URLs (no javascript:/data:). Empty clears it.
  const cleared = !dietPlanUrl || !String(dietPlanUrl).trim();
  const safeUrl = cleared ? null : safeHttpUrl(dietPlanUrl);
  if (!cleared && !safeUrl) return { success: false, error: "Please enter a valid http(s) link" };
  const result = await db.student.updateMany({
    where: staffStudentWhere(session, studentId),
    data: { dietPlanUrl: safeUrl }
  });
  if (result.count === 0) return { success: false, error: "Student not found" };
  revalidatePath("/coach");
  revalidatePath("/parent");
  return { success: true };
}
