"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { requirePermission } from "@/lib/membership";

export async function convertTrialToStudent(trialId: string) {
  const { session } = await requirePermission("students.manage");
  // Tenant scope: TrialBooking has no orgId column — scope via its batch
  const trial = await db.trialBooking.findFirst({
    where: { id: trialId, batch: { orgId: session.orgId } },
    include: { batch: true }
  });

  if (!trial) throw new Error("Trial not found");
  
  if (trial.status === "ENROLLED") throw new Error("Trial already converted");

  const orgId = trial.batch.orgId;

  await db.$transaction(async (tx) => {
    // 1. Create or Find Parent
    let parent = await tx.user.findFirst({
      where: { phone: trial.parentPhone, role: "PARENT", orgId }
    });

    if (!parent) {
      // Phone is globally unique: refuse to hijack/attach to a user of another academy
      const existing = await tx.user.findUnique({ where: { phone: trial.parentPhone } });
      if (existing) {
        if (existing.orgId && existing.orgId !== orgId) {
          throw new Error("This phone number is registered with another academy");
        }
        if (!existing.orgId && existing.role !== "PARENT") {
          // Never claim an org-less staff/admin account (e.g. an admin mid-onboarding) into this academy
          throw new Error("This phone number belongs to a staff account, not a parent");
        }
        // Org-less parent: link them to this academy so the child and parent share one tenant
        parent = existing.orgId ? existing : await tx.user.update({ where: { id: existing.id }, data: { orgId } });
      }
    }
    
    if (!parent) {
      parent = await tx.user.create({
        data: {
          name: trial.parentName,
          phone: trial.parentPhone,
          role: "PARENT",
          orgId
        }
      });
    }

    // 2. Create Student
    const student = await tx.student.create({
      data: {
        name: trial.childName,
        parentId: parent.id,
        dob: new Date(new Date().getFullYear() - trial.childAge, 0, 1), // Approximate DOB from age
        orgId
      }
    });

    // 3. Create BatchEnrollment
    await tx.batchEnrollment.create({
      data: {
        studentId: student.id,
        batchId: trial.batchId
      }
    });

    // 4. Update trial status
    await tx.trialBooking.update({
      where: { id: trial.id },
      data: { status: "ENROLLED" }
    });
  });

  revalidatePath("/org");
}

/** Allowed lifecycle values for a TrialBooking. */
const TRIAL_STATUSES = [
  // Lifecycle used by the admin Trials screen, coach dashboard and schema default.
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "NO_SHOW",
  "ENROLLED",
  // Accepted for compatibility with earlier validation; nothing writes these today.
  "SCHEDULED",
  "ATTENDED",
  "DECLINED",
  "CANCELLED",
] as const;
export type TrialStatus = (typeof TRIAL_STATUSES)[number];

export async function updateTrialStatus(trialId: string, status: string) {
  const { session } = await requirePermission("leads.manage");

  if (!TRIAL_STATUSES.includes(status as TrialStatus)) {
    throw new Error(
      `Invalid trial status "${status}". Allowed: ${TRIAL_STATUSES.join(", ")}`,
    );
  }

  const result = await db.trialBooking.updateMany({
    where: { id: trialId, batch: { orgId: session.orgId } },
    data: { status },
  });
  if (result.count === 0) throw new Error("Trial not found");
  revalidatePath("/org");
}
