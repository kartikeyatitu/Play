"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

export async function createFeePlan(data: { name: string; duration: number; amount: number; sport?: string }) {
    const session = await requireAuth(['ADMIN']);
  if (!session.orgId) return { success: false, error: "No organization found" };
  // Whitelist fields + force session org (never spread client data into Prisma)
  await db.feePlan.create({
    data: {
      name: data.name,
      duration: data.duration,
      amount: data.amount,
      sport: data.sport,
      orgId: session.orgId,
    },
  });
  revalidatePath("/org");
  return { success: true };
}

export async function getFeePlans() {
    const session = await requireAuth(['ADMIN']);
  return db.feePlan.findMany({ where: { isActive: true, orgId: session.orgId || "__no_org__" }, orderBy: { duration: "asc" } });
}

export async function deleteFeePlan(id: string) {
    const session = await requireAuth(['ADMIN']);
  const result = await db.feePlan.updateMany({ where: { id, orgId: session.orgId || "__no_org__" }, data: { isActive: false } });
  if (result.count === 0) return { success: false, error: "Fee plan not found" };
  revalidatePath("/org");
  return { success: true };
}
