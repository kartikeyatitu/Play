import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpayWebhookSignature } from "@/lib/gateways/razorpay";
import { finalizePayment, failPayment, PERMANENT_PAYMENT_ERRORS } from "@/lib/payment-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * LEGACY platform-level Razorpay fee webhook (from when fees were collected with Triq's own
 * RAZORPAY_KEY_ID). Academy fees now go to each academy's own Razorpay account and are reconciled
 * by /api/webhooks/razorpay/[orgId] (per-academy secret, set up in Settings → Razorpay). Platform
 * subscription billing uses /api/webhooks/razorpay/billing. Kept so any old orders still settle;
 * do not point new dashboards here.
 *
 * Verifies the HMAC over the RAW body with RAZORPAY_WEBHOOK_SECRET (fails closed: 503 without it,
 * 401 on a bad signature), then finalises/fails the matching Payment via payment-service
 * (idempotent). Returns 5xx only for transient failures so Razorpay retries; unknown orders return
 * 200 to avoid endless retries.
 */
export async function POST(req: NextRequest) {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") || "";
  if (!verifyRazorpayWebhookSignature(process.env.RAZORPAY_WEBHOOK_SECRET, rawBody, signature)) {
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
    const entity = body?.payload?.payment?.entity;

    if (event === "payment.captured" || event === "order.paid") {
      const orderId = entity?.order_id;
      if (!orderId || typeof entity?.amount !== "number") {
        return NextResponse.json({ status: "ignored" });
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
    } else if (event === "payment.failed") {
      const orderId = entity?.order_id;
      if (orderId) {
        await failPayment({
          providerOrderId: String(orderId),
          reason: String(entity?.error_description || "Payment failed").slice(0, 300),
        });
      }
    }
    return NextResponse.json({ status: "ok" });
  } catch (e) {
    console.error("Razorpay webhook error:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
