"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { checkPermission, hasPermission, requirePermission } from "@/lib/membership";

/** Parse an optional non-negative integer form value. Empty → null. Invalid → undefined. */
function parseOptionalInt(value: FormDataEntryValue | null): number | null | undefined {
  if (value === null) return undefined;
  const raw = String(value).trim();
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return undefined;
  return n;
}

/**
 * Confirms `userId` is a current member of `orgId` who can coach a batch.
 * Coaches often work at several academies, so User.orgId is unreliable here —
 * membership is the authoritative source of truth.
 *
 * Returns the user's id if valid, otherwise null (so the caller can reject the
 * assignment with a clear error instead of silently falling back).
 */
async function validateBatchCoach(userId: string, orgId: string): Promise<string | null> {
  // Owner or manager of the org can always coach their own batches.
  const membership = await db.orgMembership.findUnique({
    where: { userId_orgId: { userId, orgId } },
    select: { role: true, status: true },
  });
  if (membership?.status === "ACTIVE" && ["OWNER", "MANAGER", "COACH"].includes(membership.role)) {
    return userId;
  }
  // Backward-compat: pre-membership rows where User.orgId points at the org and role is COACH/ADMIN.
  const legacy = await db.user.findFirst({
    where: {
      id: userId,
      orgId,
      role: { in: ["COACH", "ADMIN"] },
      memberships: { none: { orgId } },
    },
    select: { id: true },
  });
  return legacy?.id ?? null;
}

/** Returns the branch id if it belongs to the org; null for "no branch"; undefined if invalid. */
async function resolveBranchId(raw: FormDataEntryValue | null, orgId: string): Promise<string | null | undefined> {
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!id) return null;
  const branch = await db.branch.findFirst({ where: { id, orgId }, select: { id: true } });
  return branch ? branch.id : undefined;
}

export async function createBatch(formData: FormData) {
  const { session } = await requirePermission("batches.manage");
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

  // Membership-aware check: works for coaches who are members at several academies.
  const validatedCoachId = await validateBatchCoach(coachId, session.orgId);
  if (!validatedCoachId) throw new Error("Coach not found or not active in your academy");

  const branchId = await resolveBranchId(formData.get("branchId"), session.orgId);
  if (branchId === undefined) throw new Error("Branch not found in your academy");

  await db.batch.create({
    data: {
      name,
      sport,
      schedule,
      coachId: validatedCoachId,
      orgId: session.orgId,
      monthlyFee: monthlyFee ?? null,
      capacity: capacity ?? null,
      branchId,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/org");
}

/** ADMIN only: update a batch's monthly fee and/or capacity (org-scoped). */
export async function updateBatchSettings(batchId: string, formData: FormData) {
  const auth = await checkPermission("batches.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session, membership } = auth;

  const batch = await db.batch.findFirst({ where: { id: batchId, orgId: session.orgId }, select: { id: true, monthlyFee: true } });
  if (!batch) return { success: false, error: "Batch not found in your academy." };

  const monthlyFee = parseOptionalInt(formData.get("monthlyFee"));
  const capacity = parseOptionalInt(formData.get("capacity"));
  if (monthlyFee === undefined && formData.get("monthlyFee") !== null) {
    return { success: false, error: "Monthly fee must be a whole number (₹)." };
  }
  if (capacity === undefined && formData.get("capacity") !== null) {
    return { success: false, error: "Capacity must be a whole number." };
  }

  const data: { monthlyFee?: number | null; capacity?: number | null; branchId?: string | null } = {};
  if (monthlyFee !== undefined) data.monthlyFee = monthlyFee;
  if (capacity !== undefined) data.capacity = capacity;
  if (formData.get("branchId") !== null) {
    const branchId = await resolveBranchId(formData.get("branchId"), session.orgId);
    if (branchId === undefined) return { success: false, error: "Branch not found in your academy." };
    data.branchId = branchId;
  }
  // Changing what a batch charges is a fee decision, not just a schedule one
  if (data.monthlyFee !== undefined && data.monthlyFee !== batch.monthlyFee && !hasPermission(membership, "fees.manage")) {
    return { success: false, error: "You don't have permission to change fees." };
  }

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
  const auth = await checkPermission("batches.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session, membership } = auth;

  const batch = await db.batch.findFirst({
    where: { id: batchId, orgId: session.orgId },
  });
  if (!batch) return { success: false, error: "Batch not found" };
  if (data.monthlyFee !== undefined && data.monthlyFee !== batch.monthlyFee && !hasPermission(membership, "fees.manage")) {
    return { success: false, error: "You don't have permission to change fees." };
  }

  const updateData: any = {};
  if (data.name?.trim()) updateData.name = data.name.trim();
  if (data.sport?.trim()) updateData.sport = data.sport.trim();
  if (data.schedule?.trim()) updateData.schedule = data.schedule.trim();
  if (data.monthlyFee !== undefined) updateData.monthlyFee = data.monthlyFee;
  if (data.capacity !== undefined) updateData.capacity = data.capacity;

  if (data.coachId) {
    const validatedCoachId = await validateBatchCoach(data.coachId, session.orgId);
    if (!validatedCoachId) throw new Error("Coach not found or not active in your academy");
    updateData.coachId = validatedCoachId;
  }

  await db.batch.update({
    where: { id: batchId },
    data: updateData,
  });

  revalidatePath("/org");
  return { success: true };
}

export async function deleteBatch(batchId: string) {
  const auth = await checkPermission("batches.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;

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
