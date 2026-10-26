/**
 * V1 Business growth tools (ex-Rewards) — referral rules (pure, no DB).
 *
 * A referral is a parent telling the academy "this family may join". It is PENDING until a student is enrolled whose
 * parent phone matches the referee phone, then CONVERTED. Referral has no orgId column: the academy is the
 * referrer's academy. No reward is promised or granted here — Triq has no fee-credit mechanism yet, so the UI must
 * not promise a discount.
 */

export const GROWTH_TOOLS_DISABLED_ERROR = "Referrals and coupons are not enabled for this academy yet.";
/** Most PENDING referrals one parent may have at a time (abuse guard). */
export const MAX_PENDING_PER_REFERRER = 20;

/** Comparable key for a phone number: its last 10 digits (stored phones mix "+91…", "91…" and bare formats). */
export function phoneKey(phone: string | null | undefined): string | null {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

/** Validate a referee phone for an Indian-number academy: 10 digits starting 6-9 (after dropping +91 / 0). */
export function normaliseRefereePhone(raw: unknown): string | null {
  const key = phoneKey(typeof raw === "string" ? raw : "");
  return key && /^[6-9]\d{9}$/.test(key) ? key : null;
}

export type ReferralCheck =
  | { ok: true; phone: string }
  | { ok: false; error: string };

/** Rules for creating a referral, given what the server already looked up. */
export function checkNewReferral(input: {
  refereePhone: unknown;
  referrerPhone: string | null;
  pendingByReferrer: ReadonlyArray<{ refereePhone: string }>;
  refereeAlreadyInAcademy: boolean;
}): ReferralCheck {
  const phone = normaliseRefereePhone(input.refereePhone);
  if (!phone) return { ok: false, error: "Enter a valid 10-digit mobile number." };
  if (phoneKey(input.referrerPhone) === phone) return { ok: false, error: "You can't refer your own number." };
  if (input.refereeAlreadyInAcademy) return { ok: false, error: "This family is already part of the academy." };
  if (input.pendingByReferrer.some((r) => phoneKey(r.refereePhone) === phone)) {
    return { ok: false, error: "You have already referred this number." };
  }
  if (input.pendingByReferrer.length >= MAX_PENDING_PER_REFERRER) {
    return { ok: false, error: `You can have at most ${MAX_PENDING_PER_REFERRER} open referrals.` };
  }
  return { ok: true, phone };
}

/**
 * Which pending referral converts when a family with `parentPhone` enrols: the earliest one for that phone (one
 * family converts one referral — the first parent who referred them gets the credit).
 */
export function referralToConvert<T extends { id: string; refereePhone: string; status: string; createdAt: Date | string }>(
  referrals: readonly T[],
  parentPhone: string | null | undefined,
): T | null {
  const key = phoneKey(parentPhone);
  if (!key) return null;
  const matches = referrals
    .filter((r) => r.status === "PENDING" && phoneKey(r.refereePhone) === key)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return matches[0] ?? null;
}
