// Server-only consent helpers. ConsentRecord is queried only when FEATURES.consentLedger is on.
import crypto from "crypto";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { rateLimitDb } from "@/lib/rate-limit";
import { hasConsent, type ConsentRow } from "./ledger";
import type { ConsentPurpose } from "./purposes";

/** Every ledger row for a child (oldest first). Empty when the flag is off. */
export async function consentRowsForStudent(studentId: string): Promise<ConsentRow[]> {
  if (!FEATURES.consentLedger) return [];
  return db.consentRecord.findMany({ where: { studentId }, orderBy: { createdAt: "asc" } });
}

/**
 * Point-of-use check (for example before building AI context).
 * Flag off: { enforced: false, allowed: true } so existing behaviour is unchanged until the ledger
 * goes live. Flag on: allowed only with an active grant on the ledger.
 */
export async function checkConsentAtUse(studentId: string, purpose: ConsentPurpose): Promise<{ enforced: boolean; allowed: boolean }> {
  if (!FEATURES.consentLedger) return { enforced: false, allowed: true };
  const rows = await db.consentRecord.findMany({ where: { studentId, purpose }, orderBy: { createdAt: "asc" } });
  return { enforced: true, allowed: hasConsent(rows, studentId, purpose) };
}

const MAX_OTP_ATTEMPTS = 5;
const hashOtp = (otp: string) => crypto.createHash("sha256").update(otp).digest("hex");

/**
 * Checks a code sent by sendOtp (src/app/actions/auth.ts) for the signed-in guardian's own stored
 * phone, WITHOUT signing anyone in. Same storage and limits as verifyOtpAndLogin: sha256-hashed code,
 * 5 wrong guesses burn it, one-time use.
 */
export async function verifyGuardianOtp(storedPhone: string, otp: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const guess = String(otp ?? "").trim();
  if (!storedPhone || !/^\d{4,8}$/.test(guess)) return { ok: false, error: "Enter the code we sent you." };
  const limit = await rateLimitDb(`consent-otp-verify:${storedPhone}`, 10, 5 * 60_000);
  if (!limit.allowed) return { ok: false, error: "Too many attempts. Please wait a few minutes and request a new code." };

  const latest = await db.verificationToken.findFirst({
    where: { phone: storedPhone, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) return { ok: false, error: "Invalid or expired code." };
  if (latest.attempts >= MAX_OTP_ATTEMPTS) {
    await db.verificationToken.deleteMany({ where: { phone: storedPhone } });
    return { ok: false, error: "Too many wrong attempts. Please request a new code." };
  }
  const a = Buffer.from(latest.token);
  const b = Buffer.from(hashOtp(guess));
  if (!(a.length === b.length && crypto.timingSafeEqual(a, b))) {
    await db.verificationToken.update({ where: { id: latest.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: "Invalid or expired code." };
  }
  // One-time use (these are login codes for the same phone; consuming them is the expected behaviour).
  await db.verificationToken.deleteMany({ where: { phone: storedPhone } });
  return { ok: true };
}
