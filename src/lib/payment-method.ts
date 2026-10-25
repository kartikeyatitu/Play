/**
 * How a fee was settled. Plan Phase 3 requires recorded offline payments to be
 * distinguishable from verified online payments.
 *
 * - OFFLINE_RECORDED      staff recorded cash / UPI / other outside the system (not verified by a gateway)
 * - PARENT_REPORTED_UPI   parent tapped "I've paid"; not yet confirmed (status stays PENDING_VERIFICATION)
 * - ADMIN_CONFIRMED_UPI   staff confirmed a parent-reported UPI payment (still not gateway-verified)
 * - ONLINE_VERIFIED       settled through a gateway webhook (Razorpay), signature-verified
 */
export const PAYMENT_METHODS = [
  "OFFLINE_RECORDED",
  "PARENT_REPORTED_UPI",
  "ADMIN_CONFIRMED_UPI",
  "ONLINE_VERIFIED",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && (PAYMENT_METHODS as readonly string[]).includes(value);
}

/** Only gateway-verified payments count as verified online money. */
export function isVerifiedOnline(method: string | null | undefined): boolean {
  return method === "ONLINE_VERIFIED";
}

/** Human label for admin screens and receipts. */
export function paymentMethodLabel(method: string | null | undefined): string {
  switch (method) {
    case "OFFLINE_RECORDED":
      return "Recorded offline";
    case "PARENT_REPORTED_UPI":
      return "Reported by parent (UPI)";
    case "ADMIN_CONFIRMED_UPI":
      return "UPI, confirmed by staff";
    case "ONLINE_VERIFIED":
      return "Verified online";
    default:
      return "Not recorded";
  }
}
