/**
 * V1 Business — UPI AutoPay fee mandates (flag `upiAutopay`). Pure, client-safe, no DB, no network.
 *
 * Built on Razorpay Recurring Payments (UPI) using the ACADEMY'S OWN Razorpay account:
 *   1. customer + order with a `token` block (max_amount, frequency monthly)   → mandate CREATED
 *   2. parent approves in their UPI app through Checkout (recurring: "1")     → AUTHENTICATED (signature verified)
 *   3. NPCI confirms the mandate (webhook token.confirmed or a status sync)    → ACTIVE
 *   4. each month: order + POST /payments/create/recurring for the fee record. Razorpay sends the pre-debit
 *      notification and debits ~25h later. The fee becomes PAID only through the existing verified
 *      payment.captured → finalizePayment path (paymentMethod ONLINE_VERIFIED).
 * Spec: docs/specs/01-triq-business.md §"UPI AutoPay".
 */

export const UPI_AUTOPAY_DISABLED_ERROR = "UPI AutoPay is not enabled for this academy yet.";

export const MANDATE_STATUSES = ["CREATED", "AUTHENTICATED", "ACTIVE", "PAUSED", "CANCELLED", "EXPIRED", "FAILED"] as const;
export type MandateStatus = (typeof MANDATE_STATUSES)[number];

export const TERMINAL_MANDATE_STATUSES: readonly MandateStatus[] = ["CANCELLED", "EXPIRED", "FAILED"];
/** Statuses that block a parent from starting a second mandate for the same child. */
export const LIVE_MANDATE_STATUSES: readonly MandateStatus[] = ["CREATED", "AUTHENTICATED", "ACTIVE", "PAUSED"];

const TRANSITIONS: Record<MandateStatus, readonly MandateStatus[]> = {
  // CREATED → ACTIVE is allowed because the token.confirmed webhook can arrive before the checkout handler returns.
  CREATED: ["AUTHENTICATED", "ACTIVE", "CANCELLED", "EXPIRED", "FAILED"],
  AUTHENTICATED: ["ACTIVE", "CANCELLED", "EXPIRED", "FAILED"],
  ACTIVE: ["PAUSED", "CANCELLED", "EXPIRED"],
  PAUSED: ["ACTIVE", "CANCELLED", "EXPIRED"],
  CANCELLED: [],
  EXPIRED: [],
  FAILED: [],
};

export function canTransition(from: MandateStatus, to: MandateStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isMandateStatus(s: unknown): s is MandateStatus {
  return typeof s === "string" && (MANDATE_STATUSES as readonly string[]).includes(s);
}

/** Razorpay token `recurring_details.status` → our mandate status (null = unknown, leave as is). */
export function mandateStatusFromProvider(providerStatus: string | null | undefined): MandateStatus | null {
  switch (String(providerStatus || "").toLowerCase()) {
    case "initiated":
      return "AUTHENTICATED";
    case "confirmed":
      return "ACTIVE";
    case "paused":
      return "PAUSED";
    case "rejected":
      return "FAILED";
    case "cancellation_initiated":
    case "cancelled":
      return "CANCELLED";
    case "expired":
      return "EXPIRED";
    default:
      return null;
  }
}

/** Webhook event → status. Only token.* events change a mandate. */
export function mandateStatusFromEvent(event: string): MandateStatus | null {
  switch (event) {
    case "token.confirmed":
      return "ACTIVE";
    case "token.paused":
      return "PAUSED";
    case "token.cancelled":
      return "CANCELLED";
    case "token.rejected":
      return "FAILED";
    default:
      return null;
  }
}

/**
 * Events the AutoPay handler may claim. payment.captured / order.paid / payment.failed are deliberately NOT here:
 * monthly debits settle through the existing fee-payment handler unchanged.
 */
export const AUTOPAY_WEBHOOK_EVENTS = ["token.confirmed", "token.paused", "token.cancelled", "token.rejected", "payment.authorized"] as const;

export function isAutopayWebhookEvent(event: unknown): boolean {
  return typeof event === "string" && (AUTOPAY_WEBHOOK_EVENTS as readonly string[]).includes(event);
}

/**
 * Decide the next status for an incoming signal. Returns null when nothing should change
 * (same status, illegal or out-of-order transition) — callers then just acknowledge.
 */
export function nextMandateStatus(current: MandateStatus, incoming: MandateStatus | null): MandateStatus | null {
  if (!incoming || incoming === current) return null;
  return canTransition(current, incoming) ? incoming : null;
}

// ─── Mandate setup ──────────────────────────────────────────────────────────

/** Razorpay UPI token limits: max_amount between ₹1 and ₹99,999 (paise 100–9,999,900). */
export const MIN_MAX_AMOUNT_MINOR = 100;
export const MAX_MAX_AMOUNT_MINOR = 9_999_900;
/** Above ₹15,000 the parent must approve each debit with their UPI PIN (NPCI additional factor of authentication). */
export const AFA_THRESHOLD_MINOR = 1_500_000;
/**
 * Amount of the one-time authorisation payment. Razorpay's docs are inconsistent (0 vs minimum ₹1); ₹1 is the stated
 * minimum for UPI. Confirm in test mode before going live (open decision in the spec).
 */
export const AUTH_AMOUNT_MINOR = 100;
/** Mandates run for at most this many years. */
export const MANDATE_YEARS = 3;
export const CONSENT_VERSION = "2026-10-26.v1";

/** Default cap shown to the parent: the current fee rounded up to the next ₹500 (no extra headroom). */
export function suggestedMaxAmountMinor(feeMinor: number): number {
  const base = Math.max(feeMinor, MIN_MAX_AMOUNT_MINOR);
  return Math.min(MAX_MAX_AMOUNT_MINOR, Math.ceil(base / 50_000) * 50_000);
}

export function validateMaxAmount(rupees: unknown, currentFeeMinor: number): { ok: true; maxAmountMinor: number } | { ok: false; error: string } {
  const n = Number(rupees);
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: "Enter the maximum monthly amount." };
  const minor = Math.round(n * 100);
  if (minor % 100 !== 0) return { ok: false, error: "Use a whole rupee amount." };
  if (minor < MIN_MAX_AMOUNT_MINOR || minor > MAX_MAX_AMOUNT_MINOR) return { ok: false, error: "The limit must be between ₹1 and ₹99,999." };
  if (currentFeeMinor > 0 && minor < currentFeeMinor) return { ok: false, error: "The limit can't be lower than this month's fee." };
  return { ok: true, maxAmountMinor: minor };
}

/** Unix seconds when a mandate created at `now` expires. */
export function mandateExpiry(now: Date, years = MANDATE_YEARS): number {
  const d = new Date(now.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return Math.floor(d.getTime() / 1000);
}

/** The exact text the parent agrees to. Stored on the mandate with its version. */
export function consentText(a: { academyName: string; studentName: string; maxAmountLabel: string; authAmountLabel: string }): string {
  return [
    `I authorise ${a.academyName} to collect ${a.studentName}'s monthly academy fee from my UPI account using UPI AutoPay.`,
    `Each debit will be for that month's fee as shown in the app and will never exceed ${a.maxAmountLabel}.`,
    `I will get a pre-debit notification from my UPI app at least 24 hours before each debit.`,
    `A one-time ${a.authAmountLabel} payment is taken to set up the mandate.`,
    `I can pause or cancel this mandate at any time from my UPI app or from the academy app; cancelling stops future debits only.`,
    `Payments go directly to ${a.academyName}'s Razorpay account.`,
  ].join(" ");
}

// ─── Monthly charges ────────────────────────────────────────────────────────

export const CHARGE_STATUSES = ["PENDING_SUBMIT", "SUBMITTED", "SUBMIT_FAILED"] as const;
export type ChargeStatus = (typeof CHARGE_STATUSES)[number];

/** One charge per mandate per fee month. Used as the DB unique key and as the Razorpay order receipt. */
export function chargeIdempotencyKey(mandateId: string, month: string): string {
  return `autopay:${mandateId}:${month}`;
}

/** Razorpay order `receipt` (≤ 40 chars) derived from the idempotency key. */
export function chargeReceipt(mandateId: string, month: string): string {
  return `ap_${mandateId.slice(-24)}_${month.replace("-", "")}`.slice(0, 40);
}

export type ChargeCandidate = {
  mandate: { status: MandateStatus; maxAmountMinor: number; providerTokenId: string | null; expireAt: Date };
  fee: { status: string; amount: number; month: string };
  /** YYYY-MM-DD today in the academy's timezone. */
  today: string;
  /** A charge for this mandate+month already exists (any status). */
  alreadyCharged: boolean;
  /** Another charge for this mandate is submitted and its payment has not reached PAID/FAILED yet. */
  inFlight: boolean;
};

export type ChargeDecision =
  | { ok: true; amountMinor: number; needsPin: boolean }
  | { ok: false; reason: "NOT_ACTIVE" | "NO_TOKEN" | "EXPIRED" | "FEE_NOT_DUE" | "NO_AMOUNT" | "OVER_LIMIT" | "ALREADY_CHARGED" | "IN_FLIGHT" | "WRONG_MONTH" | "LAST_DAY" };

function lastDayOfMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Whether this month's fee may be debited now. Follows Razorpay's UPI rules: one debit per cycle, wait for the
 * previous debit's outcome, never on the last day of the cycle (the debit would land in the next cycle and fail).
 */
export function decideCharge(c: ChargeCandidate): ChargeDecision {
  if (c.mandate.status !== "ACTIVE") return { ok: false, reason: "NOT_ACTIVE" };
  if (!c.mandate.providerTokenId) return { ok: false, reason: "NO_TOKEN" };
  if (c.mandate.expireAt.getTime() <= Date.parse(`${c.today}T00:00:00Z`)) return { ok: false, reason: "EXPIRED" };
  if (c.fee.month !== c.today.slice(0, 7)) return { ok: false, reason: "WRONG_MONTH" };
  if (Number(c.today.slice(8, 10)) >= lastDayOfMonth(c.fee.month)) return { ok: false, reason: "LAST_DAY" };
  if (c.fee.status !== "PENDING") return { ok: false, reason: "FEE_NOT_DUE" };
  const amountMinor = Math.round(Number(c.fee.amount) * 100);
  if (!(amountMinor > 0)) return { ok: false, reason: "NO_AMOUNT" };
  if (amountMinor > c.mandate.maxAmountMinor) return { ok: false, reason: "OVER_LIMIT" };
  if (c.alreadyCharged) return { ok: false, reason: "ALREADY_CHARGED" };
  if (c.inFlight) return { ok: false, reason: "IN_FLIGHT" };
  return { ok: true, amountMinor, needsPin: amountMinor > AFA_THRESHOLD_MINOR };
}

export const CHARGE_SKIP_LABELS: Record<Exclude<ChargeDecision, { ok: true }>["reason"], string> = {
  NOT_ACTIVE: "Mandate is not active",
  NO_TOKEN: "Mandate has no Razorpay token yet",
  EXPIRED: "Mandate has expired",
  FEE_NOT_DUE: "Fee is not pending",
  NO_AMOUNT: "Fee amount is not set",
  OVER_LIMIT: "Fee is above the parent's AutoPay limit",
  ALREADY_CHARGED: "Already charged this month",
  IN_FLIGHT: "Previous debit still in progress",
  WRONG_MONTH: "Only the current month is charged",
  LAST_DAY: "Not charged on the last day of the month",
};

export const MANDATE_STATUS_LABELS: Record<MandateStatus, string> = {
  CREATED: "Waiting for approval",
  AUTHENTICATED: "Approved — confirming with bank",
  ACTIVE: "Active",
  PAUSED: "Paused",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
  FAILED: "Failed",
};

// ─── Shapes returned by src/app/actions/autopay.ts (types can't live in a "use server" file) ───

export type AutopayParentView = {
  available: boolean;
  academyName: string;
  studentName: string;
  currentFeeMinor: number;
  suggestedMaxRupees: number;
  consentPreview: string;
  mandate: null | { id: string; status: string; statusLabel: string; maxAmountMinor: number; createdAt: string };
};

export type AutopayAdminRow = {
  id: string;
  studentName: string;
  parentName: string | null;
  status: string;
  statusLabel: string;
  maxAmountMinor: number;
  createdAt: string;
  lastCharge: null | { id: string; month: string; amountMinor: number; status: string; paymentStatus: string | null; failureReason: string | null };
};
