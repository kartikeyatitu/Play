"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

export async function transferStudent(
  studentId: string,
  fromBatchId: string,
  toBatchId: string
) {
    const session = await requireAuth(['ADMIN']);
  try {
    if (fromBatchId === toBatchId) {
      return { success: false, error: "Cannot transfer to the same batch" };
    }

    // Tenant scope: student and both batches must belong to the admin's academy
    const orgId = session.orgId || "__no_org__";
    const [student, fromBatch, toBatch] = await Promise.all([
      db.student.findFirst({ where: { id: studentId, orgId }, select: { id: true } }),
      db.batch.findFirst({ where: { id: fromBatchId, orgId }, select: { id: true } }),
      db.batch.findFirst({ where: { id: toBatchId, orgId }, select: { id: true } }),
    ]);
    if (!student || !fromBatch || !toBatch) {
      return { success: false, error: "Student or batch not found" };
    }

    await db.$transaction(async (tx) => {
      // Find the existing enrollment
      const existingEnrollment = await tx.batchEnrollment.findUnique({
        where: {
          batchId_studentId: {
            batchId: fromBatchId,
            studentId,
          }
        }
      });

      if (!existingEnrollment) {
        throw new Error("Student is not enrolled in the source batch");
      }

      // Check if already enrolled in the target batch
      const targetEnrollment = await tx.batchEnrollment.findUnique({
        where: {
          batchId_studentId: {
            batchId: toBatchId,
            studentId,
          }
        }
      });

      if (targetEnrollment) {
        throw new Error("Student is already enrolled in the target batch");
      }

      // Delete old enrollment
      await tx.batchEnrollment.delete({
        where: {
          id: existingEnrollment.id
        }
      });

      // Create new enrollment
      await tx.batchEnrollment.create({
        data: {
          batchId: toBatchId,
          studentId,
        }
      });
    });

    revalidatePath("/org/batches");
    revalidatePath("/org/students");
    return { success: true };
  } catch (error: any) {
    console.error("Error transferring student:", error);
    return { success: false, error: error.message || "Failed to transfer student" };
  }
}
