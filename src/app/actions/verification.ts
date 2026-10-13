"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { coachesOfOrg } from "@/lib/membership";

export async function toggleCoachVerification(coachId: string, verified: boolean) {
    const session = await requireAuth(['ADMIN']);
  // Tenant scope: only coaches of the admin's own academy
  const result = await db.user.updateMany({
    where: { id: coachId, ...coachesOfOrg(session.orgId || "__no_org__") },
    data: { verified: !!verified },
  });
  if (result.count === 0) return { success: false, error: "Coach not found" };
  revalidatePath("/org");
  return { success: true };
}
