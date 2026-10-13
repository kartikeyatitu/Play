"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

export async function createFacility(name: string, type: string) {
    const session = await requireAuth(['ADMIN']);
  if (!session.orgId) return { success: false, error: "No organization found" };
  await db.facility.create({ data: { orgId: session.orgId,  name, type } });
  revalidatePath("/org");
  return { success: true };
}

export async function deleteFacility(id: string) {
    const session = await requireAuth(['ADMIN']);
  const result = await db.facility.deleteMany({ where: { id, orgId: session.orgId || "__no_org__" } });
  if (result.count === 0) return { success: false, error: "Facility not found" };
  revalidatePath("/org");
  return { success: true };
}

export async function createEquipment(name: string, quantity: number, condition: string) {
    const session = await requireAuth(['ADMIN']);
  if (!session.orgId) return { success: false, error: "No organization found" };
  await db.equipment.create({ data: { name, quantity, orgId: session.orgId } });
  revalidatePath("/org");
  return { success: true };
}

export async function deleteEquipment(id: string) {
    const session = await requireAuth(['ADMIN']);
  const result = await db.equipment.deleteMany({ where: { id, orgId: session.orgId || "__no_org__" } });
  if (result.count === 0) return { success: false, error: "Equipment not found" };
  revalidatePath("/org");
  return { success: true };
}

export async function assignEquipment(equipmentId: string, userId: string) {
    const session = await requireAuth(['ADMIN']);
  const orgId = session.orgId || "__no_org__";
  // Assignee must be a member of the same academy
  const user = await db.user.findFirst({ where: { id: userId, orgId }, select: { id: true } });
  if (!user) return { success: false, error: "User not found" };
  const result = await db.equipment.updateMany({ where: { id: equipmentId, orgId }, data: { assignedToId: user.id } });
  if (result.count === 0) return { success: false, error: "Equipment not found" };
  revalidatePath("/org");
  return { success: true };
}

export async function bookFacility(facilityId: string, date: string, startTime: string, endTime: string, batchId: string) {
    const session = await requireAuth(['ADMIN']);
  const orgId = session.orgId || "__no_org__";
  const [facility, batch] = await Promise.all([
    db.facility.findFirst({ where: { id: facilityId, orgId }, select: { id: true } }),
    db.batch.findFirst({ where: { id: batchId, orgId }, select: { id: true } }),
  ]);
  if (!facility || !batch) return { success: false, error: "Facility or batch not found" };
  await db.booking.create({ data: { facilityId: facility.id, batchId: batch.id, startTime: new Date(startTime), endTime: new Date(endTime) } });
  revalidatePath("/org");
  return { success: true };
}
