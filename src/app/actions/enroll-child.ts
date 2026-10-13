"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

export async function enrollAdditionalChild(
  childName: string,
  dob: string,
  batchId: string
) {
  try {
    const session = await requireAuth(["PARENT"]);
    
    if (!session || !session.id) {
      return { success: false, error: "Unauthorized" };
    }
    if (!session.orgId) {
      return { success: false, error: "Your account is not linked to an academy" };
    }

    const parentId = session.id;

    // Tenant scope: the batch must belong to the parent's academy
    const batch = await db.batch.findFirst({ where: { id: batchId, orgId: session.orgId } });
    if (!batch) {
      return { success: false, error: "Batch not found" };
    }

    const student = await db.student.create({
      data: {
        name: childName,
        parentId: parentId,
        dob: new Date(dob),
        orgId: session.orgId, // Link to the same org if the parent has one
      },
    });

    await db.batchEnrollment.create({
      data: {
        batchId: batch.id,
        studentId: student.id,
      },
    });

    revalidatePath("/parent");
    return { success: true, data: student };
  } catch (error: any) {
    console.error("Error enrolling child:", error);
    return { success: false, error: error.message || "Failed to enroll child" };
  }
}
