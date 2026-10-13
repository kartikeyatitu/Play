"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { resolveStudentFee } from "@/lib/fees";
import crypto from "crypto";


// ─── Mark Fee as Paid (ADMIN only — e.g. cash/UPI received in person) ───
export async function markFeePaid(studentId: string, month: string, paymentId: string) {
  const session = await requireAuth(["ADMIN"]);
  try {
    if (!session.orgId) return { success: false, error: "No academy found for your account." };
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) return { success: false, error: "Invalid month." };
    const student = await db.student.findFirst({
      where: { id: studentId, orgId: session.orgId },
      include: { enrollments: { include: { batch: true } }, org: true },
    });
    if (!student) return { success: false, error: "Student not found in your academy." };

    const fee = await db.feeRecord.findFirst({ where: { studentId, month } });
    let feeRecordId = fee?.id;
    let feeAmount = fee?.amount ?? 0;

    if (fee) {
      await db.feeRecord.update({
        where: { id: fee.id },
        data: { status: "PAID", paidAt: new Date(), orgId: fee.orgId ?? session.orgId },
      });
      feeAmount = fee.amount;
    } else {
      feeAmount = resolveStudentFee(student, student.org?.defaultMonthlyFee);
      const created = await db.feeRecord.create({
        data: { orgId: session.orgId, studentId, amount: feeAmount, month, status: "PAID", paidAt: new Date() },
      });
      feeRecordId = created.id;
    }

    let receiptData = null;
    try {
      const { getOrCreateReceipt } = await import("@/lib/receipt-service");
      const r = await getOrCreateReceipt({
        feeRecordId,
        studentId,
        orgId: session.orgId,
        amount: feeAmount,
        month,
        paymentMode: "MANUAL",
        transactionRef: paymentId,
      });
      receiptData = { receiptNumber: r.receiptNumber, url: r.url };
    } catch (err) {
      console.error("Receipt creation failed in markFeePaid:", err);
    }

    await logFeeAudit(session.id, session.orgId, "MARK_FEE_PAID", { studentId, month, paymentId, receiptNumber: receiptData?.receiptNumber });
    revalidatePath("/org");
    revalidatePath("/parent");
    return { success: true, receipt: receiptData };
  } catch (e: any) {
    return { success: false, error: e?.message || "Failed to mark paid" };
  }
}

// ─── Parent: "I've paid" → PENDING_VERIFICATION (admin must confirm) ───
export async function reportFeePaid(feeRecordId: string) {
  const session = await requireAuth(["PARENT"]);
  try {
    const fee = await db.feeRecord.findUnique({
      where: { id: feeRecordId },
      include: { student: { select: { parentId: true, orgId: true } } },
    });
    // Must be the parent's own child
    if (!fee || fee.student.parentId !== session.id) {
      return { success: false, error: "Fee record not found." };
    }
    if (fee.status === "PAID") return { success: true, status: "PAID" };

    const moved = await db.feeRecord.updateMany({
      where: { id: fee.id, status: { not: "PAID" } },
      data: { status: "PENDING_VERIFICATION" },
    });
    if (moved.count === 0) return { success: true, status: "PAID" };

    revalidatePath("/parent");
    revalidatePath("/org");
    return { success: true, status: "PENDING_VERIFICATION" };
  } catch (e: any) {
    return { success: false, error: e?.message || "Failed to update payment status" };
  }
}

// ─── Admin: confirm a parent's reported payment → PAID ───
export async function confirmFeePayment(feeRecordId: string) {
  return setFeeStatusAsAdmin(feeRecordId, "PAID");
}

// ─── Admin: reject a parent's reported payment → back to PENDING ───
export async function rejectFeePayment(feeRecordId: string) {
  return setFeeStatusAsAdmin(feeRecordId, "PENDING");
}

async function setFeeStatusAsAdmin(feeRecordId: string, status: "PAID" | "PENDING") {
  const session = await requireAuth(["ADMIN"]);
  try {
    if (!session.orgId) return { success: false, error: "No academy found for your account." };
    const fee = await db.feeRecord.findUnique({
      where: { id: feeRecordId },
      include: { student: { select: { orgId: true } } },
    });
    if (!fee || fee.student.orgId !== session.orgId) {
      return { success: false, error: "Fee record not found in your academy." };
    }
    let receiptData = null;
    if (status === "PAID") {
      try {
        const { getOrCreateReceipt } = await import("@/lib/receipt-service");
        const r = await getOrCreateReceipt({
          feeRecordId: fee.id,
          studentId: fee.studentId,
          orgId: session.orgId,
          amount: fee.amount,
          month: fee.month,
          paymentMode: "UPI",
        });
        receiptData = { receiptNumber: r.receiptNumber, url: r.url };
      } catch (err) {
        console.error("Receipt generation failed in setFeeStatusAsAdmin:", err);
      }
    }

    await logFeeAudit(session.id, session.orgId, status === "PAID" ? "CONFIRM_FEE_PAYMENT" : "REJECT_FEE_PAYMENT", {
      feeRecordId,
      studentId: fee.studentId,
      month: fee.month,
      receiptNumber: receiptData?.receiptNumber,
    });
    revalidatePath("/org");
    revalidatePath("/parent");
    return { success: true, status, receipt: receiptData };
  } catch (e: any) {
    return { success: false, error: e?.message || "Failed to update fee" };
  }
}

export async function getFeeReceiptAction(feeRecordId: string) {
  try {
    const receipt = await db.receipt.findUnique({
      where: { feeRecordId },
    });
    if (!receipt) return { success: false, error: "No receipt generated yet." };
    return { success: true, receipt: { receiptNumber: receipt.receiptNumber, url: `/r/${receipt.token}` } };
  } catch (e: any) {
    return { success: false, error: e?.message || "Failed to fetch receipt." };
  }
}

async function logFeeAudit(userId: string, orgId: string, action: string, details: Record<string, unknown>) {
  try {
    await db.auditLog.create({ data: { userId, orgId, action, details: JSON.stringify(details) } });
  } catch {
    // Audit logging must never block the main action
  }
}



