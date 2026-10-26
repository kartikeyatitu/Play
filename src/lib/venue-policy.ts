// TRIQ Spaces booking policy: pure, client-safe. Spec: docs/specs/04-triq-spaces.md §7.
// TRIQ never issues or marks refunds — these functions only say what the policy owes, so the operator
// can refund through Razorpay / UPI / cash and the audit log records the quote.

export type VenuePolicy = {
  /** Cancel at least this many hours before start → everything received is refundable. */
  fullRefundHours: number;
  /** Cancel at least this many hours before start (but less than fullRefundHours) → partial refund. */
  partialRefundHours: number;
  /** Percentage of the money received that is refundable in the partial window. */
  partialRefundPct: number;
  /** A booking can be moved only up to this many hours before its original start. */
  rescheduleCutoffHours: number;
};

/** Defaults until per-venue configuration exists (open decision in the spec). */
export const DEFAULT_VENUE_POLICY: VenuePolicy = {
  fullRefundHours: 24,
  partialRefundHours: 4,
  partialRefundPct: 50,
  rescheduleCutoffHours: 4,
};

export const BLOCK_SOURCE = "BLOCK";

export type PolicyBooking = {
  status: string;
  source: string;
  startTime: Date;
  endTime: Date;
  advancePaid: number;
};

export type CancellationQuote = {
  allowed: boolean;
  tier: "FULL" | "PARTIAL" | "NONE" | "NOTHING_RECEIVED" | "BLOCK";
  /** Whole rupees the policy says should go back to the customer, out of the money recorded as received. */
  refundDue: number;
  hoursBefore: number;
  /** True when the gateway may hold money not yet recorded on the booking (paid-but-slot-taken). */
  checkGateway: boolean;
  message: string;
};

const CANCELLABLE = ["HOLD", "CONFIRMED", "PAID_CONFLICT"];

export function hoursUntil(start: Date, now: Date): number {
  return (start.getTime() - now.getTime()) / 3600_000;
}

export function cancellationQuote(b: PolicyBooking, now: Date, policy: VenuePolicy = DEFAULT_VENUE_POLICY): CancellationQuote {
  const hoursBefore = Math.round(hoursUntil(b.startTime, now) * 10) / 10;
  const base = { hoursBefore, checkGateway: false };
  if (!CANCELLABLE.includes(b.status)) {
    return { ...base, allowed: false, tier: "NONE", refundDue: 0, message: "This booking can't be cancelled." };
  }
  if (b.source === BLOCK_SOURCE) {
    return { ...base, allowed: true, tier: "BLOCK", refundDue: 0, message: "Removing the block frees the slot." };
  }
  const received = Math.max(0, Math.round(b.advancePaid));
  if (b.status === "PAID_CONFLICT") {
    // The customer paid but never got the slot: everything they paid goes back, whatever the timing.
    return {
      ...base,
      allowed: true,
      tier: "FULL",
      refundDue: received,
      checkGateway: true,
      message: "Customer paid but the slot wasn't available — refund everything they paid (check the gateway/UPI app for the exact amount).",
    };
  }
  if (received === 0) {
    return { ...base, allowed: true, tier: "NOTHING_RECEIVED", refundDue: 0, message: "No money recorded for this booking." };
  }
  const h = hoursUntil(b.startTime, now);
  if (h >= policy.fullRefundHours) {
    return { ...base, allowed: true, tier: "FULL", refundDue: received, message: `Cancelled ${policy.fullRefundHours}+ hours ahead: full refund due.` };
  }
  if (h >= policy.partialRefundHours) {
    const due = Math.floor((received * policy.partialRefundPct) / 100);
    return { ...base, allowed: true, tier: "PARTIAL", refundDue: due, message: `Cancelled ${policy.partialRefundHours}–${policy.fullRefundHours} hours ahead: ${policy.partialRefundPct}% refund due.` };
  }
  return { ...base, allowed: true, tier: "NONE", refundDue: 0, message: `Cancelled less than ${policy.partialRefundHours} hours ahead: no refund under the policy.` };
}

export type RescheduleTarget = {
  newStart: Date;
  newEnd: Date;
  sameSlot: boolean;
  /** Opening hours of the target facility and the requested start hour (venue local time). */
  startHour: number;
  openHour: number;
  closeHour: number;
};

export function rescheduleCheck(
  b: PolicyBooking,
  t: RescheduleTarget,
  now: Date,
  policy: VenuePolicy = DEFAULT_VENUE_POLICY
): { ok: true } | { ok: false; error: string } {
  if (b.source === BLOCK_SOURCE) return { ok: false, error: "Blocks can't be moved — remove it and block the new time." };
  if (b.status !== "CONFIRMED") return { ok: false, error: "Only confirmed bookings can be rescheduled." };
  if (hoursUntil(b.startTime, now) < policy.rescheduleCutoffHours) {
    return { ok: false, error: `Bookings can be moved up to ${policy.rescheduleCutoffHours} hours before they start.` };
  }
  if (t.newStart.getTime() <= now.getTime()) return { ok: false, error: "Pick a time in the future." };
  if (t.newEnd.getTime() - t.newStart.getTime() !== b.endTime.getTime() - b.startTime.getTime()) {
    return { ok: false, error: "The new slot must be the same length as the booking." };
  }
  const hours = Math.round((t.newEnd.getTime() - t.newStart.getTime()) / 3600_000);
  if (t.startHour < t.openHour || t.startHour + hours > t.closeHour) return { ok: false, error: "That time is outside the court's opening hours." };
  if (t.sameSlot) return { ok: false, error: "Pick a different time or court." };
  return { ok: true };
}

/** Booking actions that make no sense on a maintenance block. */
export function blockAllows(action: string): boolean {
  return action === "CANCEL";
}
