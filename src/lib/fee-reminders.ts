// Family fee reminder text + wa.me link for the Overdue panel. Pure and client-safe.
//
// One message per family (a parent with two children gets one WhatsApp, not two). The pay line uses
// the academy's UPI ID when it has one (deep link for the family total); otherwise it points the
// parent to the parent app, where online payment and "I've paid" already live. No Razorpay links
// are created here: creating a payment link is a side effect, and a list view must not create one
// per family just by rendering.

import { buildUpiLink, isValidUpiId } from "@/lib/fees";

export interface FamilyReminderLine {
  studentName: string;
  month: string; // YYYY-MM
  amount: number;
}

export interface FamilyReminderInput {
  parentName: string | null;
  lines: FamilyReminderLine[];
  academyName: string;
  upiId?: string | null;
  /** Absolute URL of the parent app (e.g. https://…/parent) */
  parentAppUrl?: string | null;
  /** Formats an amount in the academy's currency */
  formatAmount?: (n: number) => string;
}

function monthLabel(m: string): string {
  const [y, mo] = (m || "").split("-").map(Number);
  if (!y || !mo) return m;
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function buildFamilyReminderText(input: FamilyReminderInput): string {
  const fmt = input.formatAmount ?? ((n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`);
  const lines = input.lines.filter((l) => (Number(l.amount) || 0) > 0);
  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const parent = (input.parentName || "").trim();
  const greeting = parent ? `Hi ${parent}` : "Hi";
  const academy = input.academyName || "the academy";

  const body =
    lines.length === 1
      ? `${greeting}, ${lines[0].studentName}'s ${monthLabel(lines[0].month)} fee of ${fmt(lines[0].amount)} is pending at ${academy}.`
      : `${greeting}, these fees are pending at ${academy}:\n` +
        lines.map((l) => `• ${l.studentName} – ${monthLabel(l.month)}: ${fmt(l.amount)}`).join("\n") +
        `\nTotal: ${fmt(total)}`;

  let pay: string;
  if (input.upiId && isValidUpiId(input.upiId)) {
    const link = buildUpiLink({ upiId: input.upiId, payeeName: academy, amount: total, note: "Academy fees" });
    pay = `Pay via UPI: ${link}\n(or pay to ${input.upiId})`;
  } else if (input.parentAppUrl) {
    pay = `Pay or view details in the parent app: ${input.parentAppUrl}`;
  } else {
    pay = "Please pay at the front desk or by bank transfer and let us know once done.";
  }
  return `${body}\n${pay}\nThank you.`;
}

/** wa.me link; 10-digit numbers get the academy's calling code (default 91). Null without a usable phone. */
export function familyWaLink(phone: string | null | undefined, text: string, callingCode = "91"): string | null {
  const clean = String(phone || "").replace(/\D/g, "");
  if (clean.length < 10) return null;
  const num = clean.length === 10 ? `${callingCode}${clean}` : clean;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

/** Families reminded within this window are skipped by "Remind all". */
export const BULK_REMINDER_COOLDOWN_HOURS = 20;
/** At most this many families per "Remind all" run. */
export const BULK_REMINDER_MAX_FAMILIES = 40;

/**
 * Which families a bulk run should include: those with a phone, not reminded inside the cooldown,
 * capped at `max`. Input order is kept (the panel already sorts by amount owed).
 */
export function pickBulkReminderFamilies<T extends { familyId: string; familyPhone: string | null; lastRemindedAt?: string | null }>(
  families: T[],
  now: Date,
  opts: { cooldownHours?: number; max?: number } = {},
): { send: T[]; skippedRecent: T[]; skippedNoPhone: T[] } {
  const cooldownMs = (opts.cooldownHours ?? BULK_REMINDER_COOLDOWN_HOURS) * 3_600_000;
  const max = opts.max ?? BULK_REMINDER_MAX_FAMILIES;
  const send: T[] = [];
  const skippedRecent: T[] = [];
  const skippedNoPhone: T[] = [];
  for (const f of families) {
    if (String(f.familyPhone || "").replace(/\D/g, "").length < 10) {
      skippedNoPhone.push(f);
      continue;
    }
    const last = f.lastRemindedAt ? Date.parse(f.lastRemindedAt) : NaN;
    if (Number.isFinite(last) && now.getTime() - last < cooldownMs) {
      skippedRecent.push(f);
      continue;
    }
    if (send.length < max) send.push(f);
  }
  return { send, skippedRecent, skippedNoPhone };
}
