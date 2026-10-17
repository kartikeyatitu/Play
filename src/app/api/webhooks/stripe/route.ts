import { NextRequest, NextResponse } from "next/server";
import { verifyStripeWebhook } from "@/lib/gateways/stripe";
import { finalizePayment, failPayment, PERMANENT_PAYMENT_ERRORS } from "@/lib/payment-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook receiver. Verifies the Stripe-Signature over the RAW body (5 min tolerance),
 * then finalises/fails the matching Payment via payment-service (idempotent).
 *
 * New Stripe fee checkouts only start when PLATFORM_COLLECTS_FEES is on (see gateways/stripe.ts);
 * this receiver stays live so sessions started earlier still reconcile.
 */
export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  if (!verifyStripeWebhook(rawBody, req.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const type = event?.type as string | undefined;
    const obj = event?.data?.object;

    if (
      (type === "checkout.session.completed" && obj?.payment_status === "paid") ||
      type === "checkout.session.async_payment_succeeded"
    ) {
      if (!obj?.id || typeof obj.amount_total !== "number" || !obj.currency) {
        return NextResponse.json({ status: "ignored" });
      }
      const pi = obj.payment_intent;
      const r = await finalizePayment({
        provider: "STRIPE",
        providerOrderId: String(obj.id),
        providerPaymentId: typeof pi === "string" ? pi : (pi?.id ?? null),
        amountMinor: obj.amount_total,
        currency: String(obj.currency).toUpperCase(),
      });
      if (!r.ok && !(PERMANENT_PAYMENT_ERRORS as readonly string[]).includes(r.error ?? "")) {
        console.error("Stripe webhook: finalize failed", r.error);
        return NextResponse.json({ error: "Processing failed" }, { status: 500 });
      }
    } else if (type === "checkout.session.async_payment_failed" || type === "checkout.session.expired") {
      if (obj?.id) {
        await failPayment({
          providerOrderId: String(obj.id),
          reason: type === "checkout.session.expired" ? "Checkout session expired" : "Payment failed",
        });
      }
    }
    return NextResponse.json({ status: "ok" });
  } catch (e) {
    console.error("Stripe webhook error:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
