import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { TERMINAL_MANDATE_STATUSES, isAutopayWebhookEvent, mandateStatusFromEvent, type MandateStatus } from "@/lib/autopay";
import { applyMandateStatus, revokeOrphanToken } from "@/lib/autopay-service";

/**
 * UPI AutoPay webhook handling (flag `upiAutopay`). Called by /api/webhooks/razorpay/[orgId] AFTER the academy's
 * signature check and JSON parse, which stay exactly as they were.
 *
 * Returns null when the event is not ours — the route then continues with its existing logic unchanged. Only
 * token.* events and a payment.authorized whose order is a mandate authorisation are claimed. Fee and turf
 * payment events (payment.captured, order.paid, payment.failed, payment_link.*) are never claimed here, so monthly
 * debits settle through the existing finalizePayment path (fee PAID only from a verified captured payment).
 */
export async function handleAutopayWebhook(orgId: string, event: string | undefined, body: any): Promise<{ status: number; body: Record<string, string> } | null> {
  if (!FEATURES.upiAutopay || !isAutopayWebhookEvent(event)) return null;
  try {
    if (event === "payment.authorized") {
      const p = body?.payload?.payment?.entity;
      const orderId = p?.order_id ? String(p.order_id) : null;
      if (!orderId) return null;
      const mandate = await db.feeMandate.findFirst({ where: { orgId, authOrderId: orderId } });
      if (!mandate) return null; // an ordinary payment: leave it to the existing handler
      const tokenId = p?.token_id ? String(p.token_id) : null;
      if (TERMINAL_MANDATE_STATUSES.includes(mandate.status as MandateStatus)) {
        if (tokenId) await revokeOrphanToken(orgId, mandate.providerCustomerId, tokenId);
        return { status: 200, body: { status: "ok" } };
      }
      await applyMandateStatus(mandate, "AUTHENTICATED", { tokenId, authPaymentId: p?.id ? String(p.id) : null, source: "webhook:payment.authorized" });
      return { status: 200, body: { status: "ok" } };
    }

    const token = body?.payload?.token?.entity;
    const tokenId = token?.id ? String(token.id) : null;
    if (!tokenId) return { status: 200, body: { status: "ignored" } };
    const mandate = await db.feeMandate.findFirst({ where: { orgId, providerTokenId: tokenId } });
    // Unknown token (e.g. confirmation raced ahead of the checkout handler): acknowledge; status sync recovers it.
    if (!mandate) return { status: 200, body: { status: "ignored" } };
    const providerStatus = token?.recurring_details?.status ? String(token.recurring_details.status) : null;
    const reason = token?.recurring_details?.failure_reason ? String(token.recurring_details.failure_reason) : null;
    await applyMandateStatus(mandate, mandateStatusFromEvent(String(event)), { providerStatus, reason, source: `webhook:${event}` });
    return { status: 200, body: { status: "ok" } };
  } catch (e) {
    console.error("Autopay webhook error:", e instanceof Error ? e.message : "unknown");
    return { status: 500, body: { error: "Webhook processing failed" } };
  }
}
