"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { checkPermission } from "@/lib/membership";

export async function addToWaitlist(
  batchId: string,
  parentName: string,
  parentPhone: string,
  childName: string
) {
  const auth = await checkPermission("students.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  try {
    // Tenant scope: batch must belong to the admin's academy
    const batch = await db.batch.findFirst({ where: { id: batchId, orgId: session.orgId } });
    if (!batch) return { success: false, error: "Batch not found" };

    const entry = await db.waitlist.create({
      data: {
        batchId: batch.id,
        parentName,
        parentPhone,
        childName,
        status: "WAITING",
        orgId: batch.orgId,
      },
    });
    revalidatePath("/org/waitlist");
    return { success: true, data: entry };
  } catch (error) {
    console.error("Error adding to waitlist:", error);
    return { success: false, error: "Failed to add to waitlist" };
  }
}

export async function updateWaitlistStatus(id: string, status: string) {
  const auth = await checkPermission("students.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  try {
    const orgId = session.orgId;
    if (!["WAITING", "NOTIFIED", "ENROLLED"].includes(status)) throw new Error("Invalid waitlist status");
    // Scope via the batch (Waitlist.orgId was not populated historically)
    const waitlist = await db.waitlist.findFirst({ where: { id, batch: { orgId } } });
    if (!waitlist) throw new Error("Waitlist entry not found");

    if (status === "ENROLLED") {
      // 1. Find or create User (Parent)
      let parent = await db.user.findUnique({
        where: { phone: waitlist.parentPhone },
      });
      if (parent && parent.orgId && parent.orgId !== orgId) {
        throw new Error("This phone number is registered with another academy");
      }
      if (parent && !parent.orgId && parent.role !== "PARENT") {
        // Never claim an org-less staff/admin account (e.g. an admin mid-onboarding) into this academy
        throw new Error("This phone number belongs to a staff account, not a parent");
      }
      if (parent && !parent.orgId) {
        // Org-less parent: link them to this academy so the child and parent share one tenant
        parent = await db.user.update({ where: { id: parent.id }, data: { orgId } });
      }
      if (!parent) {
        parent = await db.user.create({
          data: {
            name: waitlist.parentName,
            phone: waitlist.parentPhone,
            role: "PARENT",
            orgId,
          },
        });
      }

      // 2. Create Student
      const student = await db.student.create({
        data: {
          name: waitlist.childName,
          parentId: parent.id,
          dob: null, // Waitlist doesn't have DOB (optional on Student)
          orgId,
        },
      });

      // 3. Create BatchEnrollment
      await db.batchEnrollment.create({
        data: {
          batchId: waitlist.batchId,
          studentId: student.id,
        },
      });
    }

    // 4. Update waitlist status
    const entry = await db.waitlist.update({
      where: { id: waitlist.id },
      data: { status },
    });
    revalidatePath("/org/waitlist");
    return { success: true, data: entry };
  } catch (error) {
    console.error("Error updating waitlist status:", error);
    return { success: false, error: "Failed to update status" };
  }
}
