"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { safeHttpUrl } from "@/lib/safe-url";

// COACH added: highlight reels are added from the coach dashboard (AddMediaModal).
export async function addHighlightReel(studentId: string, coachId: string, title: string, videoUrl: string) {
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

  // Rendered as a link for parents/admins: only accept absolute http(s) URLs (no javascript:/data:)
  const safeUrl = safeHttpUrl(videoUrl);
  if (!safeUrl) return { success: false, error: "Please enter a valid http(s) video link" };
  const safeTitle = String(title ?? "").trim().slice(0, 120);
  if (!safeTitle) return { success: false, error: "Please enter a title" };

  // Never trust coachId: coaches always upload as themselves; admins may attribute to a staff member in-org
  let uploaderId = session.id as string;
  if (session.role === "ADMIN" && coachId && coachId !== session.id) {
    const staff = await db.user.findFirst({ where: { id: coachId, orgId, role: { in: ["COACH", "ADMIN"] } }, select: { id: true } });
    if (staff) uploaderId = staff.id;
  }

  await db.media.create({
    data: { studentId: student.id, coachId: uploaderId, title: safeTitle, videoUrl: safeUrl, orgId: student.orgId }
  });
  revalidatePath("/coach");
  revalidatePath("/parent");
  return { success: true };
}
