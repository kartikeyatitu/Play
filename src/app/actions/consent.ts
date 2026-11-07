"use server";

// DPDP parental consent ledger (ConsentRecord, flag FEATURES.consentLedger). Append-only: every
// grant and every withdrawal is a new row. Exports only async functions.
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { getSession } from "@/lib/auth";
import { rateLimitDb } from "@/lib/rate-limit";
import { sendOtp } from "@/app/actions/auth";
import { guardianStudent } from "@/lib/family/guardians";
import { consentRowsToAppend } from "@/lib/consent/ledger";
import { CONSENT_METHOD_ENROLMENT_OTP, CONSENT_NOTICE_VERSION, isConsentPurpose, type ConsentPurpose } from "@/lib/consent/purposes";
import { consentRowsForStudent, verifyGuardianOtp } from "@/lib/consent/server";

const OFF_ERROR = "The consent centre is not switched on yet.";

async function signedInGuardian() {
  const session = await getSession();
  if (!session?.id) return null;
  return db.user.findUnique({ where: { id: session.id }, select: { id: true, phone: true, role: true } });
}

/** Sends a one-time code to the signed-in guardian's own registered phone (existing OTP sender). */
export async function requestConsentCode(): Promise<{ ok: true; testMode?: boolean } | { ok: false; error: string }> {
  if (!FEATURES.consentLedger) return { ok: false, error: OFF_ERROR };
  const user = await signedInGuardian();
  if (!user) return { ok: false, error: "Please sign in again." };
  if (!user.phone) return { ok: false, error: "Your account has no phone number. Ask the academy to add it." };
  const res = await sendOtp(user.phone);
  if ("error" in res && res.error) {
    // COUNSEL: when no OTP channel is available, should the academy be able to record consent in person
    // (method IN_PERSON / SIGNED_FORM) instead? Not built: we refuse rather than record weaker evidence.
    return { ok: false, error: res.error };
  }
  return { ok: true, testMode: "testMode" in res ? !!res.testMode : undefined };
}

/**
 * Records a guardian's choices for one child. Verification ("enrolment+otp"): the signed-in user must
 * be a guardian on the child's enrolment record (Student.parentId or GuardianLink) AND enter the code
 * sent to their registered phone.
 * COUNSEL: DPDP Rules, Rule 10 (verifiable parental consent) — confirm that enrolment record plus
 * phone OTP is due diligence enough to establish the person is the child's parent and an adult.
 */
export async function saveConsentChoices(input: {
  studentId: string;
  changes: { purpose: string; granted: boolean }[];
  otp: string;
}): Promise<{ ok: true; recorded: number } | { ok: false; error: string }> {
  if (!FEATURES.consentLedger) return { ok: false, error: OFF_ERROR };
  const user = await signedInGuardian();
  if (!user) return { ok: false, error: "Please sign in again." };
  const rl = await rateLimitDb(`consent-save:${user.id}`, 20, 10 * 60_000);
  if (!rl.allowed) return { ok: false, error: "Too many attempts. Please wait a few minutes." };

  const changes = (Array.isArray(input.changes) ? input.changes : [])
    .filter((c): c is { purpose: ConsentPurpose; granted: boolean } => !!c && isConsentPurpose(c.purpose) && typeof c.granted === "boolean")
    .slice(0, 20);
  if (changes.length === 0) return { ok: false, error: "Nothing to save." };

  const student = await guardianStudent(user.id, String(input.studentId ?? ""));
  if (!student || !student.orgId) return { ok: false, error: "You are not listed as a guardian of this child." };
  if (!user.phone) return { ok: false, error: "Your account has no phone number. Ask the academy to add it." };

  const otp = await verifyGuardianOtp(user.phone, input.otp);
  if (!otp.ok) return otp;

  const existing = await consentRowsForStudent(student.id);
  const rows = consentRowsToAppend(
    existing,
    { orgId: student.orgId, studentId: student.id, guardianUserId: user.id, now: new Date(), method: CONSENT_METHOD_ENROLMENT_OTP, noticeVersion: CONSENT_NOTICE_VERSION },
    changes,
  );
  if (rows.length) await db.consentRecord.createMany({ data: rows });

  try {
    await db.auditLog.create({
      data: {
        userId: user.id,
        orgId: student.orgId,
        action: "CONSENT_RECORDED",
        details: JSON.stringify({ studentId: student.id, method: CONSENT_METHOD_ENROLMENT_OTP, noticeVersion: CONSENT_NOTICE_VERSION, changes: rows.map((r) => ({ purpose: r.purpose, granted: r.granted })) }),
      },
    });
  } catch {
    // never block on audit logging
  }
  revalidatePath("/consent");
  return { ok: true, recorded: rows.length };
}
