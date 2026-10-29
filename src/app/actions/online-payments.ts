"use server";

import { randomUUID } from "crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { getSession, requireAuth } from "@/lib/auth";
import { rateLimitDb } from "@/lib/rate-limit";
import { finalizePayment } from "@/lib/payment-service";
import {
  createRazorpayOrder,
  verifyRazorpayCheckoutSignature,
} from "@/lib/gateways/razorpay";
import { getOrgRazorpay } from "@/lib/razorpay-org";
import {
  stripeFeeCheckoutEnabled,
  createStripeCheckoutSession,
  retrieveStripeCheckoutSession,
} from "@/lib/gateways/stripe";

/**
 * Online fee payments for parents.
 *
 * Provider choice: Razorpay (INR) when the academy has connected their own Razorpay account
 * (the primary path). Stripe checkout would collect into Triq's platform account, so it is only
 * offered when PLATFORM_COLLECTS_FEES is explicitly on (default off; see gateways/stripe.ts).
 *
 * Money safety: the amount is ALWAYS read from the FeeRecord on the server. The client never sends one,
 * and finalisation re-checks what the gateway reports against what we stored (see payment-service.ts).
 *
 * Fee money settles directly into the academy's own Razorpay account.
 */

// Not exported: "use server" files may only export async functions.
const NOT_SET_UP_MESSAGE = "Online payment isn't set up for this academy yet — please pay the academy directly.";

export type StartPaymentResult =
  | { success: false; error: string }
  | {
      success: true;
      provider: "RAZORPAY";
      orderId: string;
      amountMinor: number;
      currency: string;
      keyId: string;
      name: string;
      description: string;
      prefill: { name?: string; contact?: string; email?: string };
    }
  | { success: true; provider: "STRIPE"; url: string };

export async function getOnlinePaymentOptions(feeRecordId?: string): Promise<{ razorpay: boolean; stripe: boolean }> {
  const session = await getSession();
  if (!session || session.role !== "PARENT") return { razorpay: false, stripe: false };

  let rzp = false;
  if (feeRecordId) {
    const fee = await db.feeRecord.findUnique({
      where: { id: feeRecordId },
      select: { student: { select: { orgId: true } }, orgId: true },
    });
    const orgId = fee?.student?.orgId || fee?.orgId;
    if (orgId) {
      const creds = await getOrgRazorpay(orgId);
      rzp = Boolean(creds);
    }
  } else {
    const student = await db.student.findFirst({
      where: { parentId: session.id, org: { razorpayKeyId: { not: null } } },
      select: { orgId: true },
    });
    if (student?.orgId) {
      const creds = await getOrgRazorpay(student.orgId);
      rzp = Boolean(creds);
    }
  }
  return { razorpay: rzp, stripe: stripeFeeCheckoutEnabled() };
}

async function appOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function startOnlineFeePayment(feeRecordId: string): Promise<StartPaymentResult> {
  const session = await requireAuth(["PARENT"]);
  try {
    if (!feeRecordId) return { success: false, error: "Fee not found." };
    if (!(await rateLimitDb(`pay:${session.id}`, 10, 60_000)).allowed) {
      return { success: false, error: "Too many attempts. Please wait a minute." };
    }

    const fee = await db.feeRecord.findUnique({
      where: { id: feeRecordId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            parentId: true,
            orgId: true,
            parent: { select: { name: true, phone: true, email: true } },
            org: { select: { name: true } },
          },
        },
      },
    });
    // Must be this parent's own child's fee
    if (!fee || fee.student.parentId !== session.id) return { success: false, error: "Fee not found." };
    const orgId = fee.student.orgId || fee.orgId;
    if (!orgId) return { success: false, error: "This fee isn't linked to an academy yet." };

    const creds = await getOrgRazorpay(orgId);
    // Never fall through to the platform's own account unless explicitly allowed.
    if (!creds && !stripeFeeCheckoutEnabled()) {
      return { success: false, error: NOT_SET_UP_MESSAGE };
    }

    if (fee.status === "PAID") return { success: false, error: "This fee is already paid." };
    if (fee.status !== "PENDING") {
      return { success: false, error: "You've already told the academy this was paid. They'll confirm it shortly." };
    }
    if (!(fee.amount > 0)) return { success: false, error: "The academy hasn't set this fee amount yet." };

    const amountMinor = Math.round(fee.amount * 100);
    const academy = fee.student.org?.name || "Academy";
    const description = `${fee.student.name} - ${fee.month} fee`;

    if (creds) {
      const currency = "INR";
      const order = await createRazorpayOrder(creds, {
        amountMinor,
        currency,
        receipt: `fee_${fee.id.slice(-12)}_${Date.now().toString(36)}`.slice(0, 40),
        notes: { feeRecordId: fee.id, studentId: fee.student.id, month: fee.month, orgId },
      });
      await db.payment.create({
        data: {
          orgId,
          studentId: fee.student.id,
          feeRecordId: fee.id,
          parentId: session.id,
          provider: "RAZORPAY",
          providerOrderId: order.id,
          amount: amountMinor,
          currency,
        },
      });
      return {
        success: true,
        provider: "RAZORPAY",
        orderId: order.id,
        amountMinor,
        currency,
        keyId: creds.keyId,
        name: academy,
        description,
        prefill: {
          name: fee.student.parent?.name || undefined,
          contact: fee.student.parent?.phone || undefined,
          email: fee.student.parent?.email || undefined,
        },
      };
    }

    // Stripe (platform account; only reachable with PLATFORM_COLLECTS_FEES on — re-checked here on purpose).
    if (!stripeFeeCheckoutEnabled()) return { success: false, error: NOT_SET_UP_MESSAGE };
    // Create our row first (its id travels to Stripe as client_reference_id), then attach the session id.
    const currency = (process.env.STRIPE_CURRENCY || "INR").toUpperCase();
    const payment = await db.payment.create({
      data: {
        orgId,
        studentId: fee.student.id,
        feeRecordId: fee.id,
        parentId: session.id,
        provider: "STRIPE",
        providerOrderId: `pending_${randomUUID()}`,
        amount: amountMinor,
        currency,
      },
    });
    try {
      const origin = await appOrigin();
      const checkout = await createStripeCheckoutSession({
        amountMinor,
        currency,
        productName: `${academy}: ${description}`,
        paymentId: payment.id,
        // {CHECKOUT_SESSION_ID} is a Stripe placeholder and must stay literal
        successUrl: `${origin}/parent?pay=stripe&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/parent?pay=cancelled`,
        customerEmail: fee.student.parent?.email || undefined,
      });
      await db.payment.update({ where: { id: payment.id }, data: { providerOrderId: checkout.id } });
      return { success: true, provider: "STRIPE", url: checkout.url };
    } catch (e) {
      await db.payment.delete({ where: { id: payment.id } }).catch(() => {});
      throw e;
    }
  } catch (e) {
    console.error("startOnlineFeePayment failed:", e instanceof Error ? e.message : e);
    return { success: false, error: "Couldn't start the payment. Please try again, or pay by UPI." };
  }
}

/** Browser-side confirmation after Razorpay Checkout succeeds. The webhook may also finalise; both are idempotent. */
export async function confirmRazorpayCheckout(a: {
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await requireAuth(["PARENT"]);
  try {
    if (!a?.orderId || !a?.paymentId || !a?.signature) return { success: false, error: "Missing payment details." };

    const payment = await db.payment.findUnique({ where: { providerOrderId: a.orderId } });
    if (!payment || payment.parentId !== session.id || payment.provider !== "RAZORPAY") {
      return { success: false, error: "Payment not found." };
    }
    const creds = await getOrgRazorpay(payment.orgId);
    if (!creds) {
      return { success: false, error: "Academy payment credentials not found." };
    }
    if (!verifyRazorpayCheckoutSignature(creds.keySecret, a.orderId, a.paymentId, a.signature)) {
      return { success: false, error: "We couldn't verify this payment. If money was deducted, it will be matched automatically." };
    }
    // The order amount was fixed server-side at creation, so a signed payment for this order is for that amount.
    const res = await finalizePayment({
      provider: "RAZORPAY",
      providerOrderId: a.orderId,
      providerPaymentId: a.paymentId,
      amountMinor: payment.amount,
      currency: payment.currency,
    });
    return res.ok ? { success: true } : { success: false, error: "Payment received but couldn't be recorded yet. It will update shortly." };
  } catch (e) {
    console.error("confirmRazorpayCheckout failed:", e instanceof Error ? e.message : e);
    return { success: false, error: "Something went wrong confirming your payment." };
  }
}

/** Called when the parent returns from Stripe. Asks Stripe directly, so it works even before the webhook arrives. */
export async function syncStripeCheckout(sessionId: string): Promise<{ success: boolean; paid?: boolean; error?: string }> {
  const session = await requireAuth(["PARENT"]);
  try {
    if (!sessionId) return { success: false, error: "Missing session." };
    const payment = await db.payment.findUnique({ where: { providerOrderId: sessionId } });
    if (!payment || payment.parentId !== session.id || payment.provider !== "STRIPE") {
      return { success: false, error: "Payment not found." };
    }
    if (payment.status === "PAID") return { success: true, paid: true };

    const s = await retrieveStripeCheckoutSession(sessionId);
    if (s.payment_status !== "paid") return { success: true, paid: false };

    const res = await finalizePayment({
      provider: "STRIPE",
      providerOrderId: sessionId,
      providerPaymentId: s.payment_intent,
      amountMinor: s.amount_total ?? -1,
      currency: (s.currency || "").toUpperCase(),
    });
    return res.ok ? { success: true, paid: true } : { success: false, error: "Payment received but couldn't be recorded yet." };
  } catch (e) {
    console.error("syncStripeCheckout failed:", e instanceof Error ? e.message : e);
    return { success: false, error: "Something went wrong checking your payment." };
  }
}
