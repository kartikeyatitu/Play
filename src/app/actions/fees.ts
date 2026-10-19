"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { checkPermission } from "@/lib/membership";
import { resolveStudentFee, istToday } from "@/lib/fees";

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

export interface UnpaidFeeRow {
  feeRecordId: string;
  studentId: string;
  studentName: string;
  parentName: string | null;
  parentPhone: string | null;
  amount: number;
  month: string;
  overdueDays: number;
  batchName?: string | null;
  /** Receipt token if the fee has been paid (always null here since this returns unpaid rows). */
  receiptToken?: string | null;
}

/**
 * ADMIN view: every un-collected FeeRecord in the current academy, sorted by how overdue it is.
 * "Overdue days" is measured from the 1st of the fee's month (IST). Negative values = fee for a
 * future month, which we still include so owners can see what's upcoming.
 */
export async function getUnpaidFees(): Promise<{ success: true; rows: UnpaidFeeRow[] } | { success: false; error: string }> {
  const auth = await checkPermission("fees.collect");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  try {
    const fees = await db.feeRecord.findMany({
      where: {
        orgId: session.orgId,
        status: { not: "PAID" },
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            parent: { select: { name: true, phone: true } },
            enrollments: { include: { batch: { select: { name: true } } }, take: 1 },
          },
        },
      },
    });

    const today = istToday();
    const rows: UnpaidFeeRow[] = fees.map((f) => {
      const [y, m] = f.month.split("-").map(Number);
      const monthStart = new Date(Date.UTC(y, (m || 1) - 1, 1));
      const overdueDays = Math.floor((today.getTime() - monthStart.getTime()) / (24 * 60 * 60 * 1000));
      return {
        feeRecordId: f.id,
        studentId: f.studentId,
        studentName: f.student?.name || "Student",
        parentName: f.student?.parent?.name || null,
        parentPhone: f.student?.parent?.phone || null,
        amount: f.amount,
        month: f.month,
        overdueDays,
        batchName: f.student?.enrollments?.[0]?.batch?.name || null,
      };
    });
    rows.sort((a, b) => b.overdueDays - a.overdueDays);
    return { success: true, rows };
  } catch (e: any) {
    console.error("getUnpaidFees failed:", e?.message || e);
    return { success: false, error: "Couldn't load unpaid fees." };
  }
}

/**
 * ADMIN: resolve the best one-tap payment option for a given fee (razorpay / upi / none), used
 * by the Collect Fees screen to build its WhatsApp reminder text with a real pay link.
 * (This is a thin wrapper around `payOptionForFee` that attaches `fees.collect` scoping and
 * returns a value a client component can read.)
 */
export async function resolvePayOption(studentId: string, month: string, amount: number) {
  const auth = await checkPermission("fees.collect");
  if (!auth.ok) return { success: false as const, error: auth.error };
  const { session } = auth;
  const org = await db.organization.findUnique({
    where: { id: session.orgId },
    select: { id: true, name: true, upiId: true, razorpayKeyId: true },
  });
  if (!org) return { success: false as const, error: "Academy not found." };
  const { payOptionForFee } = await import("@/lib/pay-link");
  const pay = await payOptionForFee({ studentId, month, amount }, org);
  return { success: true as const, pay };
}

export async function getFeeReceiptToken(feeRecordId: string): Promise<{ token: string | null }> {
  const auth = await checkPermission("fees.collect");
  if (!auth.ok) return { token: null };
  const { session } = auth;
  const r = await db.receipt.findFirst({ where: { feeRecordId, orgId: session.orgId }, select: { token: true } });
  return { token: r?.token ?? null };
}

// For the cron job: no session, no permission check. Server-only; callers in the API route verify
// the CRON_SECRET bearer token before invoking this.
export async function generateMonthlyFeesForOrg(orgId: string, month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) return { feesCreated: 0 };
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { defaultMonthlyFee: true, isActive: true } });
  if (!org || org.isActive === false) return { feesCreated: 0 };

  const students = await db.student.findMany({
    where: { orgId },
    include: { enrollments: { include: { batch: true } } },
  });
  let feesCreated = 0;
  for (const student of students) {
    const amount = resolveStudentFee(student, org.defaultMonthlyFee);
    if (amount <= 0) continue;
    const existing = await db.feeRecord.findUnique({
      where: { studentId_month: { studentId: student.id, month } },
      select: { id: true },
    });
    if (existing) continue;
    await db.feeRecord.create({
      data: { orgId, studentId: student.id, month, amount, status: "PENDING" },
    });
    feesCreated++;
  }
  return { feesCreated };
}

