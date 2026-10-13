import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpayWebhookSignature } from "@/lib/gateways/razorpay";
import { db } from "@/lib/db";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook handler for Triq's platform SaaS subscriptions & billing invoices.
 * Events handled:
 *  - subscription.charged
 *  - subscription.activated
 *  - subscription.halted
 *  - subscription.cancelled
 */
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.RAZORPAY_BILLING_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: "Billing webhook secret not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") || "";

  if (!verifyRazorpayWebhookSignature(webhookSecret, rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const event = body?.event as string | undefined;
  const subEntity = body?.payload?.subscription?.entity;
  const paymentEntity = body?.payload?.payment?.entity;

  if (!subEntity?.id) {
    return NextResponse.json({ status: "ignored — no subscription entity" });
  }

  const razorpaySubId = String(subEntity.id);
  const notes = subEntity.notes || {};
  const orgId = notes.orgId as string | undefined;

  try {
    // 1. Subscription charged (recurring renewal or initial payment)
    if (event === "subscription.charged") {
      const currentEnd = subEntity.current_end ? new Date(subEntity.current_end * 1000) : new Date(Date.now() + 30 * 24 * 3600 * 1000);
      const currentStart = subEntity.current_start ? new Date(subEntity.current_start * 1000) : new Date();
      const planName = String(notes.plan || "STARTER").toUpperCase();
      const maxStudents = planName === "PRO" ? 500 : 150;
      const amountPaise = typeof paymentEntity?.amount === "number" ? paymentEntity.amount : 99900;

      // Find existing subscription by razorpaySubscriptionId or orgId
      let sub = await db.subscription.findFirst({
        where: { OR: [{ razorpaySubscriptionId: razorpaySubId }, ...(orgId ? [{ orgId }] : [])] },
      });

      if (sub) {
        sub = await db.subscription.update({
          where: { id: sub.id },
          data: {
            status: "ACTIVE",
            plan: planName,
            maxStudents,
            currentPeriodStart: currentStart,
            currentPeriodEnd: currentEnd,
            gracePeriodEndsAt: null, // Clear any grace period since they're paid
            razorpaySubscriptionId: razorpaySubId,
          },
        });
      } else if (orgId) {
        sub = await db.subscription.create({
          data: {
            orgId,
            plan: planName,
            status: "ACTIVE",
            maxStudents,
            currentPeriodStart: currentStart,
            currentPeriodEnd: currentEnd,
            razorpaySubscriptionId: razorpaySubId,
          },
        });
      }

      // Generate BillingInvoice record if subscription was resolved
      if (sub) {
        const year = new Date().getFullYear();
        const invoiceCount = await db.billingInvoice.count({ where: { subscriptionId: sub.id } });
        const seq = String(invoiceCount + 1).padStart(4, "0");
        const invoiceNumber = `TRIQ-INV-${year}-${seq}`;

        await db.billingInvoice.create({
          data: {
            subscriptionId: sub.id,
            orgId: sub.orgId,
            invoiceNumber,
            amount: Math.round(amountPaise / 100),
            currency: "INR",
            status: "PAID",
            billingPeriodStart: currentStart,
            billingPeriodEnd: currentEnd,
            paidAt: new Date(),
          },
        });
      }
    }
    // 2. Subscription halted or past due
    else if (event === "subscription.halted") {
      await db.subscription.updateMany({
        where: { razorpaySubscriptionId: razorpaySubId },
        data: { status: "PAST_DUE" },
      });
    }
    // 3. Subscription cancelled
    else if (event === "subscription.cancelled") {
      await db.subscription.updateMany({
        where: { razorpaySubscriptionId: razorpaySubId },
        data: { status: "CANCELED" },
      });
    }

    return NextResponse.json({ status: "ok" });
  } catch (err: any) {
    console.error("Razorpay billing webhook processing failed:", err?.message || err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
