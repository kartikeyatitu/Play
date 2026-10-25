"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { checkPermission } from "@/lib/membership";
import { resolveStudentFee, istToday } from "@/lib/fees";

/**
 * Mark a student's fee for `month` as PAID. Idempotent — returns success if already paid.
 *
 * Replaces the old bidirectional `toggleFeeStatus`. A single admin tap on a "mark paid" chip
 * should NEVER accidentally revert a paid fee (especially a Razorpay-reconciled one). To
 * reverse a paid fee, callers must use `reverseFeePayment` with an explicit reason.
 */
export async function markFeeAsPaid(studentId: string, month: string) {
  const auth = await checkPermission("fees.collect");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) {
    return { success: false, error: "Invalid month (expected YYYY-MM)." };
  }

  const student = await db.student.findFirst({
    where: { id: studentId, orgId: session.orgId },
    include: { enrollments: { include: { batch: true } }, org: true },
  });
  if (!student) return { success: false, error: "Student not found in your academy." };

  const existing = await db.feeRecord.findUnique({
    where: { studentId_month: { studentId, month } },
  });

  // Idempotent: already paid → no-op.
  if (existing?.status === "PAID") {
    return { success: true, newStatus: "PAID" as const, alreadyPaid: true };
  }

  let feeRecordId: string;
  let amount: number;

  if (existing) {
    const updated = await db.feeRecord.update({
      where: { id: existing.id },
      data: { status: "PAID", paidAt: new Date(), paymentMethod: "OFFLINE_RECORDED" },
    });
    feeRecordId = updated.id;
    amount = updated.amount;
  } else {
    amount = resolveStudentFee(student, student.org?.defaultMonthlyFee);
    const created = await db.feeRecord.create({
      data: {
        orgId: session.orgId,
        studentId,
        month,
        status: "PAID",
        paidAt: new Date(),
        paymentMethod: "OFFLINE_RECORDED",
        amount,
      },
    });
    feeRecordId = created.id;
  }

  try {
    const { getOrCreateReceipt } = await import("@/lib/receipt-service");
    await getOrCreateReceipt({
      feeRecordId,
      studentId,
      orgId: session.orgId,
      amount,
      month,
      paymentMode: "MANUAL",
    });
  } catch (err) {
    console.error("Receipt generation on markFeeAsPaid failed:", err);
  }

  revalidatePath("/org");
  return { success: true, newStatus: "PAID" as const };
}

/**
 * Reverse a PAID fee back to PENDING. Requires an explicit reason (logged).
 * Refuses to reverse a Razorpay-reconciled payment — those must be refunded through
 * the gateway, not just marked unpaid in the DB.
 */
export async function reverseFeePayment(studentId: string, month: string, reason: string) {
  const auth = await checkPermission("fees.collect");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) {
    return { success: false, error: "Invalid month (expected YYYY-MM)." };
  }
  if (!reason || reason.trim().length < 3) {
    return { success: false, error: "Please provide a reason (min 3 characters) for the correction." };
  }

  const existing = await db.feeRecord.findUnique({
    where: { studentId_month: { studentId, month } },
    include: { student: { select: { orgId: true } } },
  });
  if (!existing || existing.student?.orgId !== session.orgId) {
    return { success: false, error: "Fee record not found in your academy." };
  }
  if (existing.status !== "PAID") {
    return { success: false, error: `Fee is already ${existing.status}, nothing to reverse.` };
  }

  // Guardrail: a reconciled online payment must go through refund, not a DB flip.
  const onlinePayment = await db.payment.findFirst({
    where: { feeRecordId: existing.id, status: "PAID" },
    select: { id: true, provider: true, providerPaymentId: true },
  });
  if (onlinePayment?.providerPaymentId) {
    return {
      success: false,
      error: `This fee was paid online via ${onlinePayment.provider}. Issue a refund from the gateway dashboard instead of reversing the status.`,
    };
  }

  await db.feeRecord.update({
    where: { id: existing.id },
    data: { status: "PENDING", paidAt: null, paymentMethod: null },
  });

  console.log(
    `[fees] reverseFeePayment orgId=${session.orgId} studentId=${studentId} month=${month} by=${session.id} reason="${reason.trim()}"`,
  );

  revalidatePath("/org");
  return { success: true, newStatus: "PENDING" as const };
}

/**
 * @deprecated Use `markFeeAsPaid` (safe, idempotent) or `reverseFeePayment` (explicit, audited).
 * The old toggle could silently revert a reconciled online payment on a stray click.
 *
 * Kept as a thin wrapper so existing callers don't break mid-deploy; they should migrate.
 */
export async function toggleFeeStatus(studentId: string, month: string) {
  return markFeeAsPaid(studentId, month);
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

export interface RecentPaidFeeRow {
  feeRecordId: string;
  studentName: string;
  amount: number;
  month: string;
  paidAt: string | null;
  paymentMethod: string | null;
}

/** ADMIN: fees paid in the last 14 days (newest first), with how each was paid. */
export async function getRecentPaidFees(): Promise<{ success: true; rows: RecentPaidFeeRow[] } | { success: false; error: string }> {
  const auth = await checkPermission("fees.collect");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  try {
    const fees = await db.feeRecord.findMany({
      where: { orgId: session.orgId, status: "PAID", paidAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
      select: { id: true, amount: true, month: true, paidAt: true, paymentMethod: true, student: { select: { name: true } } },
      orderBy: { paidAt: "desc" },
      take: 20,
    });
    return {
      success: true,
      rows: fees.map((f) => ({
        feeRecordId: f.id,
        studentName: f.student?.name || "Student",
        amount: f.amount,
        month: f.month,
        paidAt: f.paidAt ? f.paidAt.toISOString() : null,
        paymentMethod: f.paymentMethod ?? null,
      })),
    };
  } catch (e: any) {
    console.error("getRecentPaidFees failed:", e?.message || e);
    return { success: false, error: "Couldn't load recent payments." };
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

