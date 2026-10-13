import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

/**
 * Shared, gateway-agnostic payment finalisation. Called from BOTH the browser-confirm path and the
 * webhooks, in any order and any number of times, so it must be idempotent.
 *
 * Rules:
 *  - The amount/currency we expect were fixed server-side when the Payment row was created.
 *    We only mark a fee PAID if the gateway reports exactly that, so a tampered or partial payment can't clear a fee.
 *  - Payment + FeeRecord + AuditLog change in ONE transaction.
 *  - A fee that is already PAID is never touched again (no double-credit, no clobbered paidAt).
 */

export type FinalizeResult = { ok: boolean; alreadyPaid?: boolean; error?: string };

// Errors that retrying can never fix. Webhook handlers should answer 200 for these so the gateway stops retrying.
export const PERMANENT_PAYMENT_ERRORS = ["NOT_FOUND", "PROVIDER_MISMATCH", "AMOUNT_MISMATCH"] as const;

export async function finalizePayment(a: {
  provider: "RAZORPAY" | "STRIPE";
  providerOrderId: string;
  providerPaymentId?: string | null;
  amountMinor: number;
  currency: string;
}): Promise<FinalizeResult> {
  try {
    const payment = await db.payment.findUnique({ where: { providerOrderId: a.providerOrderId } });
    if (!payment) return { ok: false, error: "NOT_FOUND" };
    if (payment.provider !== a.provider) return { ok: false, error: "PROVIDER_MISMATCH" };
    if (payment.status === "PAID") return { ok: true, alreadyPaid: true };

    if (a.amountMinor !== payment.amount || String(a.currency).toUpperCase() !== payment.currency) {
      // Money moved but not the amount we asked for: park it for a human, never auto-clear the fee.
      await db.payment.updateMany({
        where: { id: payment.id, status: { not: "PAID" } },
        data: {
          status: "NEEDS_REVIEW",
          providerPaymentId: a.providerPaymentId ?? null,
          failureReason: `Gateway reported ${a.amountMinor} ${a.currency}, expected ${payment.amount} ${payment.currency}`.slice(0, 200),
        },
      });
      await audit(payment.parentId, payment.orgId, "ONLINE_PAYMENT_AMOUNT_MISMATCH", {
        paymentId: payment.id,
        feeRecordId: payment.feeRecordId,
        expected: payment.amount,
        got: a.amountMinor,
      });
      return { ok: false, error: "AMOUNT_MISMATCH" };
    }

    const now = new Date();
    await db.$transaction(async (tx) => {
      // First check if the fee was already marked PAID through another channel or payment
      const fee = await tx.feeRecord.findUnique({
        where: { id: payment.feeRecordId },
        select: { status: true },
      });

      if (fee?.status === "PAID") {
        // Double payment detected! Park this payment as DUPLICATE_PAID for owner review/refund
        await tx.payment.updateMany({
          where: { id: payment.id, status: { in: ["CREATED", "FAILED", "NEEDS_REVIEW"] } },
          data: {
            status: "NEEDS_REVIEW",
            providerPaymentId: a.providerPaymentId ?? null,
            paidAt: now,
            failureReason: "Fee was already settled. Potential duplicate payment requiring refund.",
          },
        });
        await tx.auditLog.create({
          data: {
            userId: payment.parentId,
            orgId: payment.orgId,
            action: "FEE_DUPLICATE_PAYMENT_ALERT",
            details: JSON.stringify({
              paymentId: payment.id,
              feeRecordId: payment.feeRecordId,
              providerPaymentId: a.providerPaymentId ?? null,
              amountMinor: payment.amount,
            }),
          },
        });
        return;
      }

      const moved = await tx.payment.updateMany({
        where: { id: payment.id, status: { in: ["CREATED", "FAILED", "NEEDS_REVIEW"] } },
        data: { status: "PAID", providerPaymentId: a.providerPaymentId ?? null, paidAt: now, failureReason: null },
      });
      if (moved.count === 0) return; // a concurrent webhook/confirm already finalised it

      await tx.feeRecord.updateMany({
        where: { id: payment.feeRecordId, status: { not: "PAID" } },
        data: { status: "PAID", paidAt: now },
      });
      await tx.auditLog.create({
        data: {
          userId: payment.parentId,
          orgId: payment.orgId,
          action: "ONLINE_FEE_PAYMENT",
          details: JSON.stringify({
            paymentId: payment.id,
            provider: payment.provider,
            providerPaymentId: a.providerPaymentId ?? null,
            feeRecordId: payment.feeRecordId,
            studentId: payment.studentId,
            amountMinor: payment.amount,
            currency: payment.currency,
          }),
        },
      });
    });

    // Auto-generate verified digital receipt
    try {
      const { getOrCreateReceipt } = await import("@/lib/receipt-service");
      const fee = await db.feeRecord.findUnique({
        where: { id: payment.feeRecordId },
        select: { month: true, amount: true },
      });
      if (fee) {
        await getOrCreateReceipt({
          feeRecordId: payment.feeRecordId,
          studentId: payment.studentId,
          orgId: payment.orgId,
          amount: fee.amount,
          month: fee.month,
          paymentMode: payment.provider,
          transactionRef: a.providerPaymentId ?? a.providerOrderId,
        });
      }
    } catch (receiptErr) {
      console.error("Failed to generate digital receipt:", receiptErr);
    }

    try {
      revalidatePath("/parent");
      revalidatePath("/org");
    } catch {
      // revalidation can be unavailable outside a request scope; the data is already saved
    }
    return { ok: true };
  } catch (e) {
    console.error("finalizePayment failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "INTERNAL" };
  }
}

/** Record a failed/expired attempt. Never downgrades a payment that already succeeded. */
export async function failPayment(a: { providerOrderId: string; reason: string }): Promise<void> {
  try {
    await db.payment.updateMany({
      where: { providerOrderId: a.providerOrderId, status: "CREATED" },
      data: { status: "FAILED", failureReason: String(a.reason || "Payment failed").slice(0, 200) },
    });
  } catch (e) {
    console.error("failPayment failed:", e instanceof Error ? e.message : e);
  }
}

async function audit(userId: string, orgId: string, action: string, details: Record<string, unknown>) {
  try {
    await db.auditLog.create({ data: { userId, orgId, action, details: JSON.stringify(details) } });
  } catch {
    // audit logging must never block the main action
  }
}
