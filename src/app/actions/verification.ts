"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { checkPermission, coachesOfOrg } from "@/lib/membership";

export async function toggleCoachVerification(coachId: string, verified: boolean) {
  const auth = await checkPermission("team.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  // Tenant scope: only coaches of the admin's own academy
  const result = await db.user.updateMany({
    where: { id: coachId, ...coachesOfOrg(session.orgId) },
    data: { verified: !!verified },
  });
  if (result.count === 0) return { success: false, error: "Coach not found" };
  revalidatePath("/org");
  return { success: true };
}
