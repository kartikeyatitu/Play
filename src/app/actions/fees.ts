"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { checkPermission } from "@/lib/membership";
import { resolveStudentFee } from "@/lib/fees";

export async function toggleFeeStatus(studentId: string, month: string) {
  const auth = await checkPermission("fees.collect");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) return { success: false, error: "Invalid month." };

  // Student must belong to the admin's academy
  const student = await db.student.findFirst({
    where: { id: studentId, orgId: session.orgId },
    include: { enrollments: { include: { batch: true } }, org: true },
  });
  if (!student) return { success: false, error: "Student not found in your academy." };

  // Find if a record exists
  const existing = await db.feeRecord.findUnique({
    where: {
      studentId_month: {
        studentId,
        month,
      }
    }
  });

  if (existing) {
    // Toggle status (PENDING / PENDING_VERIFICATION → PAID, PAID → PENDING)
    const newStatus = existing.status === "PAID" ? "PENDING" : "PAID";
    await db.feeRecord.update({
      where: { id: existing.id },
      data: {
        status: newStatus,
        paidAt: newStatus === "PAID" ? new Date() : null,
      }
    });

    if (newStatus === "PAID") {
      try {
        const { getOrCreateReceipt } = await import("@/lib/receipt-service");
        await getOrCreateReceipt({
          feeRecordId: existing.id,
          studentId,
          orgId: session.orgId,
          amount: existing.amount,
          month,
          paymentMode: "MANUAL",
        });
      } catch (err) {
        console.error("Receipt generation on fee toggle failed:", err);
      }
    }

    revalidatePath("/org");
    return { success: true, newStatus };
  } else {
    // Create new as PAID, using the student's real fee (override → batch → academy default)
    const amount = resolveStudentFee(student, student.org?.defaultMonthlyFee);
    const created = await db.feeRecord.create({ data: { orgId: session.orgId, 
        studentId,
        month,
        status: "PAID",
        paidAt: new Date(),
        amount,
      }
    });

    try {
      const { getOrCreateReceipt } = await import("@/lib/receipt-service");
      await getOrCreateReceipt({
        feeRecordId: created.id,
        studentId,
        orgId: session.orgId,
        amount,
        month,
        paymentMode: "MANUAL",
      });
    } catch (err) {
      console.error("Receipt generation on fee creation failed:", err);
    }

    revalidatePath("/org");
    return { success: true, newStatus: "PAID" };
  }
}
