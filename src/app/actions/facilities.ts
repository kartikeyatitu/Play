"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { checkPermission } from "@/lib/membership";

export async function createFacility(name: string, type: string) {
  const auth = await checkPermission("bookings.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  await db.facility.create({ data: { orgId: session.orgId,  name, type } });
  revalidatePath("/org");
  return { success: true };
}

export async function deleteFacility(id: string) {
  const auth = await checkPermission("bookings.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const result = await db.facility.deleteMany({ where: { id, orgId: session.orgId } });
  if (result.count === 0) return { success: false, error: "Facility not found" };
  revalidatePath("/org");
  return { success: true };
}

export async function createEquipment(name: string, quantity: number, condition: string) {
  const auth = await checkPermission("bookings.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  await db.equipment.create({ data: { name, quantity, orgId: session.orgId } });
  revalidatePath("/org");
  return { success: true };
}

export async function deleteEquipment(id: string) {
  const auth = await checkPermission("bookings.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const result = await db.equipment.deleteMany({ where: { id, orgId: session.orgId } });
  if (result.count === 0) return { success: false, error: "Equipment not found" };
  revalidatePath("/org");
  return { success: true };
}

export async function assignEquipment(equipmentId: string, userId: string) {
  const auth = await checkPermission("bookings.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const orgId = session.orgId;
  // Assignee must be a member of the same academy
  const user = await db.user.findFirst({ where: { id: userId, orgId }, select: { id: true } });
  if (!user) return { success: false, error: "User not found" };
  const result = await db.equipment.updateMany({ where: { id: equipmentId, orgId }, data: { assignedToId: user.id } });
  if (result.count === 0) return { success: false, error: "Equipment not found" };
  revalidatePath("/org");
  return { success: true };
}

export async function bookFacility(facilityId: string, date: string, startTime: string, endTime: string, batchId: string) {
  const auth = await checkPermission("bookings.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const orgId = session.orgId;
  const [facility, batch] = await Promise.all([
    db.facility.findFirst({ where: { id: facilityId, orgId }, select: { id: true } }),
    db.batch.findFirst({ where: { id: batchId, orgId }, select: { id: true } }),
  ]);
  if (!facility || !batch) return { success: false, error: "Facility or batch not found" };
  await db.booking.create({ data: { facilityId: facility.id, batchId: batch.id, startTime: new Date(startTime), endTime: new Date(endTime) } });
  revalidatePath("/org");
  return { success: true };
}
