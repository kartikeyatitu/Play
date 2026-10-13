"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

/** Parse an optional non-negative integer form value. Empty → null. Invalid → undefined. */
function parseOptionalInt(value: FormDataEntryValue | null): number | null | undefined {
  if (value === null) return undefined;
  const raw = String(value).trim();
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return undefined;
  return n;
}

export async function createBatch(formData: FormData) {
    const session = await requireAuth(['ADMIN']);
  if (!session.orgId) throw new Error("No academy found for your account");
  const name = formData.get("name") as string;
  const sport = formData.get("sport") as string;
  const schedule = formData.get("schedule") as string;
  // Coach is optional: many owners coach their own batches, so default to the owner.
  const coachId = ((formData.get("coachId") as string) || "").trim() || session.id;
  const monthlyFee = parseOptionalInt(formData.get("monthlyFee"));
  const capacity = parseOptionalInt(formData.get("capacity"));

  if (!name || !sport || !schedule) {
    throw new Error("Missing required fields");
  }

  // Tenant check: the coach must belong to the admin's academy
  const coach = await db.user.findFirst({
    where: { id: coachId, orgId: session.orgId, role: { in: ["COACH", "ADMIN"] } },
    select: { id: true },
  });
  if (!coach) throw new Error("Coach not found in your academy");

  await db.batch.create({
    data: {
      name,
      sport,
      schedule,
      coachId,
      orgId: session.orgId,
      monthlyFee: monthlyFee ?? null,
      capacity: capacity ?? null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/org");
}

/** ADMIN only: update a batch's monthly fee and/or capacity (org-scoped). */
export async function updateBatchSettings(batchId: string, formData: FormData) {
  const session = await requireAuth(["ADMIN"]);
  if (!session.orgId) return { success: false, error: "No academy found for your account." };

  const batch = await db.batch.findFirst({ where: { id: batchId, orgId: session.orgId }, select: { id: true } });
  if (!batch) return { success: false, error: "Batch not found in your academy." };

  const monthlyFee = parseOptionalInt(formData.get("monthlyFee"));
  const capacity = parseOptionalInt(formData.get("capacity"));
  if (monthlyFee === undefined && formData.get("monthlyFee") !== null) {
    return { success: false, error: "Monthly fee must be a whole number (₹)." };
  }
  if (capacity === undefined && formData.get("capacity") !== null) {
    return { success: false, error: "Capacity must be a whole number." };
  }

  const data: { monthlyFee?: number | null; capacity?: number | null } = {};
  if (monthlyFee !== undefined) data.monthlyFee = monthlyFee;
  if (capacity !== undefined) data.capacity = capacity;

  await db.batch.update({ where: { id: batch.id }, data });
  revalidatePath("/org");
  return { success: true };
}

export async function updateBatch(
  batchId: string,
  data: {
    name?: string;
    sport?: string;
    schedule?: string;
    coachId?: string;
    monthlyFee?: number | null;
    capacity?: number | null;
  }
) {
  const session = await requireAuth(["ADMIN"]);
  if (!session.orgId) return { success: false, error: "No academy found" };

  const batch = await db.batch.findFirst({
    where: { id: batchId, orgId: session.orgId },
  });
  if (!batch) return { success: false, error: "Batch not found" };

  const updateData: any = {};
  if (data.name?.trim()) updateData.name = data.name.trim();
  if (data.sport?.trim()) updateData.sport = data.sport.trim();
  if (data.schedule?.trim()) updateData.schedule = data.schedule.trim();
  if (data.monthlyFee !== undefined) updateData.monthlyFee = data.monthlyFee;
  if (data.capacity !== undefined) updateData.capacity = data.capacity;

  if (data.coachId) {
    const coach = await db.user.findFirst({
      where: { id: data.coachId, orgId: session.orgId, role: { in: ["COACH", "ADMIN"] } },
    });
    if (coach) updateData.coachId = coach.id;
  }

  await db.batch.update({
    where: { id: batchId },
    data: updateData,
  });

  revalidatePath("/org");
  return { success: true };
}

export async function deleteBatch(batchId: string) {
  const session = await requireAuth(["ADMIN"]);
  if (!session.orgId) return { success: false, error: "No academy found" };

  const batch = await db.batch.findFirst({
    where: { id: batchId, orgId: session.orgId },
    include: { enrollments: true },
  });
  if (!batch) return { success: false, error: "Batch not found" };

  await db.$transaction(async (tx) => {
    // Delete enrollments and unassign sessions or delete batch
    await tx.batchEnrollment.deleteMany({ where: { batchId } });
    await tx.session.deleteMany({ where: { batchId } });
    await tx.batch.delete({ where: { id: batchId } });

    await tx.auditLog.create({
      data: {
        userId: session.id,
        orgId: session.orgId,
        action: "DELETE_BATCH",
        details: JSON.stringify({ batchId, name: batch.name }),
      },
    });
  });

  revalidatePath("/org");
  return { success: true };
}
