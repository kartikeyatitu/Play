// One-tap pay-link helper for reminders.
//
// Produces either a Razorpay payment link (if the academy has connected Razorpay) or a UPI deep
// link (if the academy has a valid UPI ID), or falls back to "none" for a text-only reminder.
// Also renders the short, India-friendly WhatsApp message that embeds that link.
//
// This file is server-safe (it imports a server action from payment-links.ts). Clients can call
// `payOptionForFee` through a server action wrapper; the plain `buildReminderMessage` is pure
// and client-safe.

import { buildUpiLink, isValidUpiId } from "@/lib/fees";

export type PayOption =
  | { kind: "razorpay"; url: string }
  | { kind: "upi"; upi: string; amount?: number; payee: string; note?: string }
  | { kind: "none" };

export interface PayOptionOrg {
  id: string;
  name: string;
  upiId: string | null;
  razorpayKeyId: string | null;
}

export interface PayOptionFee {
  amount: number;
  studentId: string;
  month: string;
}

/**
 * Pick the best "one-tap pay" option for a given fee, given the academy's payment setup:
 *   1) Razorpay (preferred) — creates/reuses a Payment Link; falls back to UPI if it errors.
 *   2) UPI deep link — if upiId is set and syntactically valid.
 *   3) None — the message will say "pay cash/transfer and tell us when done".
 */
export async function payOptionForFee(fee: PayOptionFee, org: PayOptionOrg): Promise<PayOption> {
  const amount = Number(fee.amount) || 0;

  if (org.razorpayKeyId) {
    try {
      // Server action; safe to import conditionally so clients that only use the message helper
      // don't drag the server action's dependencies into their bundle.
      const { createFeePaymentLink } = await import("@/app/actions/payment-links");
      const res = await createFeePaymentLink(fee.studentId, fee.month);
      if (res.success && res.url) return { kind: "razorpay", url: res.url };
    } catch (e) {
      console.error("payOptionForFee: razorpay path failed, falling back to UPI:", e instanceof Error ? e.message : e);
    }
  }

  if (org.upiId && isValidUpiId(org.upiId)) {
    return {
      kind: "upi",
      upi: org.upiId,
      amount: amount > 0 ? amount : undefined,
      payee: org.name,
      note: fee.month ? `${fee.month} fee` : undefined,
    };
  }

  return { kind: "none" };
}

export interface BuildReminderOpts {
  parentName?: string | null;
  studentName: string;
  amount: number;
  month: string; // "YYYY-MM"
  academyName: string;
  pay: PayOption;
}

export interface ReminderMessage {
  text: string;
  /** The one-tap pay URL embedded in the text, if any. */
  url?: string;
  /** Public QR image URL for the UPI link (fallback to api.qrserver.com). */
  qrUrl?: string;
}

function formatMonthHuman(monthStr: string): string {
  if (!monthStr || !monthStr.includes("-")) return monthStr;
  const [y, m] = monthStr.split("-").map(Number);
  if (!y || !m) return monthStr;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * Short, India-friendly reminder with (optionally) a one-tap pay link. No marketing emojis;
 * at most one small symbol so Meta keeps the message as UTILITY, not MARKETING.
 */
export function buildReminderMessage(opts: BuildReminderOpts): ReminderMessage {
  const parent = (opts.parentName || "").trim();
  const studentName = opts.studentName || "your child";
  const amount = Number(opts.amount) || 0;
  const monthLabel = formatMonthHuman(opts.month);
  const academy = opts.academyName || "the academy";
  const amountText = amount > 0 ? amount.toLocaleString() : "the monthly fee";

  const greeting = parent ? `Hi ${parent}` : "Hi";
  const opening = `${greeting}, ${studentName}'s ${monthLabel} fee of ${amountText} is pending at ${academy}.`;

  if (opts.pay.kind === "razorpay") {
    const text = `${opening}\nPay here: ${opts.pay.url}\nThank you.`;
    return { text, url: opts.pay.url };
  }

  if (opts.pay.kind === "upi") {
    const upiLink = buildUpiLink({
      upiId: opts.pay.upi,
      payeeName: opts.pay.payee || academy,
      amount: opts.pay.amount,
      note: opts.pay.note || `${studentName} fee ${monthLabel}`,
    });
    const text =
      `${opening}\n` +
      `Pay via UPI: ${upiLink}\n` +
      `(or scan to pay to ${opts.pay.upi})\n` +
      `Thank you.`;
    // Public QR fallback. For a self-contained server-generated QR we expose a route
    // (/api/qr?data=…) that uses the `qrcode` package server side; here we use api.qrserver
    // as a universally renderable fallback that embeds inline in WhatsApp previews.
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiLink)}`;
    return { text, url: upiLink, qrUrl };
  }

  const text =
    `${opening}\n` +
    `Please pay via cash or bank transfer and let us know once done.\n` +
    `Thank you.`;
  return { text };
}
