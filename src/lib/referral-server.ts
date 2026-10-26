/**
 * Server-only referral helpers (not server actions). Shared by src/app/actions/referral.ts, referrals.ts and the
 * enrolment paths that convert referrals. Callers check FEATURES.growthTools.
 */
import { db } from "@/lib/db";
import { checkNewReferral, phoneKey, referralToConvert } from "@/lib/referral-rules";

type SessionLike = { id: string; role: string; orgId: string | null };

/** Parents refer as themselves; admins may record a referral for a user of their own academy. */
export async function resolveReferrer(session: SessionLike, referrerId: string | null | undefined) {
  if (!session.orgId) return null;
  const id = session.role === "PARENT" ? session.id : referrerId || null;
  if (!id) return null;
  return db.user.findFirst({ where: { id, orgId: session.orgId }, select: { id: true, phone: true } });
}

export async function createReferralRecord(
  session: SessionLike,
  referrerId: string | null | undefined,
  refereePhone: unknown,
): Promise<{ success: true; referralId: string } | { success: false; error: string }> {
  const referrer = await resolveReferrer(session, referrerId);
  if (!referrer || !session.orgId) return { success: false, error: "Referrer not found." };
  const orgId = session.orgId;

  const [pending, parents] = await Promise.all([
    db.referral.findMany({ where: { referrerId: referrer.id, status: "PENDING" }, select: { refereePhone: true } }),
    // Families already in this academy (to refuse referring someone who is already here)
    db.user.findMany({ where: { orgId, role: "PARENT", phone: { not: null } }, select: { phone: true } }),
  ]);
  const key = phoneKey(typeof refereePhone === "string" ? refereePhone : "");
  const check = checkNewReferral({
    refereePhone,
    referrerPhone: referrer.phone,
    pendingByReferrer: pending,
    refereeAlreadyInAcademy: !!key && parents.some((p) => phoneKey(p.phone) === key),
  });
  if (!check.ok) return { success: false, error: check.error };

  // `discount` keeps its column default; nothing reads it as a promise to the parent.
  const created = await db.referral.create({ data: { referrerId: referrer.id, refereePhone: check.phone, status: "PENDING" } });
  await db.auditLog
    .create({ data: { userId: session.id, orgId, action: "REFERRAL_CREATED", details: JSON.stringify({ referralId: created.id, referrerId: referrer.id }) } })
    .catch(() => {});
  return { success: true, referralId: created.id };
}

/**
 * After a student is enrolled: mark the earliest matching PENDING referral (from a referrer in the same academy) as
 * CONVERTED. Never throws — enrolment must not fail because of referral bookkeeping.
 */
export async function convertReferralOnEnrolment(orgId: string, parentPhone: string | null | undefined, studentId: string, actorId: string) {
  try {
    if (!phoneKey(parentPhone)) return;
    const pending = await db.referral.findMany({
      where: { status: "PENDING", referrer: { orgId } },
      select: { id: true, refereePhone: true, status: true, createdAt: true, referrerId: true },
      orderBy: { createdAt: "asc" },
      take: 2000,
    });
    const match = referralToConvert(pending, parentPhone);
    if (!match) return;
    // Compare-and-swap so two enrolments can't both convert it.
    const res = await db.referral.updateMany({ where: { id: match.id, status: "PENDING" }, data: { status: "CONVERTED" } });
    if (res.count === 0) return;
    await db.auditLog
      .create({
        data: {
          userId: actorId,
          orgId,
          action: "REFERRAL_CONVERTED",
          details: JSON.stringify({ referralId: match.id, referrerId: match.referrerId, studentId }),
        },
      })
      .catch(() => {});
  } catch (e) {
    console.error("[referrals] conversion failed", e instanceof Error ? e.message : e);
  }
}
