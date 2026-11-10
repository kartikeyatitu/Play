// Server-only: fee reminders sent through the WhatsApp Business API (via sendMessage), for academies
// that have it configured. Without it, the overdue panel keeps opening wa.me links as before.
// Not a "use server" file: only actions/reminders.ts and the retry cron import it.
import { db } from "@/lib/db";
import { formatMoney, normalizePhoneForOrg } from "@/lib/i18n";
import { registerRetryResolver, sendMessage, type RetryPayload } from "@/lib/messaging";
import { whatsappProvider } from "@/lib/messaging/providers";

export const FEE_REMINDER_RELATED = "FEE_REMINDER";
/** WhatsApp template (approved in Meta Business Manager) with body params {{1}} parent, {{2}} amount, {{3}} academy. */
export const feeReminderTemplate = () => process.env.WHATSAPP_FEE_REMINDER_TEMPLATE || "fee_reminder";

/** True when reminders can go straight from TRIQ instead of through the coach's own WhatsApp. */
export function feeReminderAutoSendReady(): boolean {
  return whatsappProvider.enabled;
}

const relatedIdFor = (orgId: string, familyId: string) => `${orgId}:${familyId}`;

/**
 * The reminder as of now, built from the family's unpaid fees. Null when nothing is due any more
 * (paid since), so a retry never chases a family that has already paid.
 */
export async function feeReminderPayload(orgId: string, familyId: string): Promise<(RetryPayload & { feeRecordIds: string[]; amount: number }) | null> {
  const [org, fees] = await Promise.all([
    db.organization.findUnique({ where: { id: orgId }, select: { name: true, currency: true, locale: true, country: true, phoneCountry: true } }),
    db.feeRecord.findMany({
      where: { orgId, status: { notIn: ["PAID", "PENDING_VERIFICATION"] }, amount: { gt: 0 }, student: { parentId: familyId, orgId } },
      select: { id: true, amount: true, student: { select: { parent: { select: { id: true, name: true, phone: true } } } } },
    }),
  ]);
  const parent = fees[0]?.student?.parent;
  if (!org || !fees.length || !parent?.phone) return null;
  const amount = fees.reduce((s, f) => s + f.amount, 0);
  return {
    to: normalizePhoneForOrg(parent.phone, org),
    userId: parent.id,
    category: "FEES",
    template: feeReminderTemplate(),
    params: [parent.name?.split(/\s+/)[0] || "Parent", formatMoney(amount, org), org.name],
    feeRecordIds: fees.map((f) => f.id),
    amount,
  };
}

registerRetryResolver(FEE_REMINDER_RELATED, async (relatedId) => {
  const [orgId, familyId] = relatedId.split(":");
  if (!orgId || !familyId) return null;
  return feeReminderPayload(orgId, familyId);
});

/** Send now. One reminder per family per day, whoever presses the button. */
export async function sendFeeReminderNow(orgId: string, familyId: string, day: string) {
  const p = await feeReminderPayload(orgId, familyId);
  if (!p) return { ok: false as const, error: "This family has nothing overdue, or no phone number on file." };
  const r = await sendMessage({
    channel: "WHATSAPP",
    category: "FEES",
    to: p.to,
    template: p.template!,
    params: p.params,
    orgId,
    userId: p.userId,
    relatedType: FEE_REMINDER_RELATED,
    relatedId: relatedIdFor(orgId, familyId),
    idempotencyKey: `fee-reminder:${orgId}:${familyId}:${day}`,
  });
  return { ok: true as const, result: r, feeRecordIds: p.feeRecordIds, amount: p.amount, to: p.to };
}
