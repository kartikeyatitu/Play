"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { checkPermission, requirePermission } from "@/lib/membership";

export async function createFeePlan(data: { name: string; duration: number; amount: number; sport?: string }) {
  const auth = await checkPermission("fees.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
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
  const { session } = await requirePermission("fees.manage");
  return db.feePlan.findMany({ where: { isActive: true, orgId: session.orgId }, orderBy: { duration: "asc" } });
}

export async function deleteFeePlan(id: string) {
  const auth = await checkPermission("fees.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const result = await db.feePlan.updateMany({ where: { id, orgId: session.orgId }, data: { isActive: false } });
  if (result.count === 0) return { success: false, error: "Fee plan not found" };
  revalidatePath("/org");
  return { success: true };
}
