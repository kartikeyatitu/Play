import { NextRequest, NextResponse } from "next/server";
import { getOrgRazorpay } from "@/lib/razorpay-org";
import { verifyRazorpayWebhookSignature } from "@/lib/gateways/razorpay";
import { finalizePayment, failPayment, PERMANENT_PAYMENT_ERRORS } from "@/lib/payment-service";
import { confirmPaidBooking } from "@/lib/turf-engine";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Per-academy Razorpay webhook receiver.
 * URL: /api/webhooks/razorpay/[orgId]
 * Verifies HMAC using the academy's own webhook secret, then reconciles the payment.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  if (!orgId) {
    return NextResponse.json({ error: "Missing academy identifier" }, { status: 400 });
  }

  const creds = await getOrgRazorpay(orgId);
  if (!creds || !creds.webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured for this academy" }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") || "";
  if (!verifyRazorpayWebhookSignature(creds.webhookSecret, rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const event = body?.event as string | undefined;

    // 1. Payment Link paid: event "payment_link.paid"
    if (event === "payment_link.paid") {
      const plink = body?.payload?.payment_link?.entity;
      const plinkId = plink?.id;
      const amountPaid = typeof plink?.amount_paid === "number" ? plink.amount_paid : plink?.amount;
      const paymentEntity = body?.payload?.payment?.entity;
      const paymentId = paymentEntity?.id ? String(paymentEntity.id) : null;

      if (!plinkId || typeof amountPaid !== "number") {
        return NextResponse.json({ status: "ignored" });
      }

      // Verify the payment belongs to this org
      const payment = await db.payment.findFirst({
        where: { providerOrderId: String(plinkId), orgId },
      });
      if (!payment) {
        console.warn(`Razorpay webhook: payment link ${plinkId} not found for org ${orgId}`);
        return NextResponse.json({ status: "ignored" });
      }

      const r = await finalizePayment({
        provider: "RAZORPAY",
        providerOrderId: String(plinkId),
        providerPaymentId: paymentId,
        amountMinor: amountPaid,
        currency: "INR",
      });
      if (!r.ok && !(PERMANENT_PAYMENT_ERRORS as readonly string[]).includes(r.error ?? "")) {
        console.error("Razorpay webhook: payment_link.paid finalize failed", r.error);
        return NextResponse.json({ error: "Processing failed" }, { status: 500 });
      }
      return NextResponse.json({ status: "ok" });
    }

    // 2. Direct checkout / standard orders: "payment.captured" or "order.paid"
    const entity = body?.payload?.payment?.entity;
    if (event === "payment.captured" || event === "order.paid") {
      const orderId = entity?.order_id;
      if (!orderId || typeof entity?.amount !== "number") {
        return NextResponse.json({ status: "ignored" });
      }

      const payment = await db.payment.findFirst({
        where: { providerOrderId: String(orderId), orgId },
      });
      if (!payment) {
        // Not a fee payment: it may be a customer's turf-booking advance.
        const turf = await db.turfBooking.findFirst({ where: { providerOrderId: String(orderId), orgId }, select: { id: true } });
        if (!turf) return NextResponse.json({ status: "ignored" });
        const t = await confirmPaidBooking({
          providerOrderId: String(orderId),
          providerPaymentId: entity.id ? String(entity.id) : null,
          amountMinor: entity.amount,
        });
        if (!t.ok && t.error === "INTERNAL") {
          return NextResponse.json({ error: "Processing failed" }, { status: 500 });
        }
        return NextResponse.json({ status: "ok" });
      }

      const r = await finalizePayment({
        provider: "RAZORPAY",
        providerOrderId: String(orderId),
        providerPaymentId: entity.id ? String(entity.id) : null,
        amountMinor: entity.amount,
        currency: String(entity.currency || "INR").toUpperCase(),
      });
      if (!r.ok && !(PERMANENT_PAYMENT_ERRORS as readonly string[]).includes(r.error ?? "")) {
        console.error("Razorpay webhook: finalize failed", r.error);
        return NextResponse.json({ error: "Processing failed" }, { status: 500 });
      }
      return NextResponse.json({ status: "ok" });
    }

    // 3. Payment failed
    if (event === "payment.failed") {
      const orderId = entity?.order_id;
      if (orderId) {
        const payment = await db.payment.findFirst({
          where: { providerOrderId: String(orderId), orgId },
        });
        if (payment) {
          await failPayment({
            providerOrderId: String(orderId),
            reason: String(entity?.error_description || "Payment failed").slice(0, 300),
          });
        }
      }
      return NextResponse.json({ status: "ok" });
    }

    return NextResponse.json({ status: "ignored" });
  } catch (e) {
    console.error("Razorpay per-org webhook error:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
