"use server";

// Triq ops credential verification. SUPER_ADMIN only — the single authorised path to VERIFIED.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { canSetCredentialStatus, credentialAuditAction, isCredentialStatus } from "@/lib/credentials";

const PATH = "/ops/credentials";

function validId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(id);
}

function back(error?: string): never {
  redirect(error ? `${PATH}?error=${encodeURIComponent(error)}` : `${PATH}?saved=1`);
}

function stamp(to: string, verifierId: string, reason: string | null) {
  const now = new Date();
  if (to === "REVIEWED") return { reviewedById: verifierId, reviewedAt: now, verifiedById: null, verifiedAt: null, rejectReason: null };
  if (to === "VERIFIED") return { verifiedById: verifierId, verifiedAt: now, rejectReason: null };
  if (to === "REJECTED") return { reviewedById: verifierId, reviewedAt: now, verifiedById: null, verifiedAt: null, rejectReason: reason };
  return {};
}

/** Verifier moves a professional credential (Careers). */
export async function reviewProfessionalCredential(formData: FormData): Promise<void> {
  const session = await requireAuth(["SUPER_ADMIN"]);
  if (!FEATURES.careers) back("Careers is switched off");
  const id = formData.get("id");
  const to = String(formData.get("status") || "");
  const reason = String(formData.get("reason") || "").trim().slice(0, 300) || null;
  if (!validId(id) || !isCredentialStatus(to)) back("Invalid request");
  const cred = await db.professionalCredential.findUnique({ where: { id }, select: { id: true, status: true, userId: true } });
  if (!cred || !isCredentialStatus(cred.status)) back("Credential not found");
  if (!canSetCredentialStatus(cred.status, to, "VERIFIER")) back("That status change is not allowed");
  if (to === "REJECTED" && !reason) back("Give a reason when rejecting");
  const { count } = await db.professionalCredential.updateMany({
    where: { id: cred.id, status: cred.status },
    data: { status: to, ...stamp(to, session.id, reason) },
  });
  if (!count) back("The credential changed meanwhile. Refresh and try again.");
  await db.auditLog.create({
    data: {
      userId: session.id,
      orgId: null,
      action: credentialAuditAction(cred.status, to),
      details: JSON.stringify({ credentialType: "PROFESSIONAL", credentialId: cred.id, subjectUserId: cred.userId, from: cred.status, to }),
    },
  });
  revalidatePath(PATH);
  back();
}

/** Verifier moves a wellness provider's credential (Wellness). */
export async function reviewProviderCredential(formData: FormData): Promise<void> {
  const session = await requireAuth(["SUPER_ADMIN"]);
  if (!FEATURES.wellness) back("Wellness is switched off");
  const id = formData.get("id");
  const to = String(formData.get("status") || "");
  const reason = String(formData.get("reason") || "").trim().slice(0, 300) || null;
  if (!validId(id) || !isCredentialStatus(to)) back("Invalid request");
  const p = await db.wellnessProvider.findUnique({ where: { id }, select: { id: true, credentialStatus: true, userId: true } });
  if (!p || !isCredentialStatus(p.credentialStatus)) back("Provider not found");
  if (!canSetCredentialStatus(p.credentialStatus, to, "VERIFIER")) back("That status change is not allowed");
  if (to === "REJECTED" && !reason) back("Give a reason when rejecting");
  const s = stamp(to, session.id, reason) as Record<string, unknown>;
  const data: Record<string, unknown> = { credentialStatus: to };
  if ("reviewedById" in s) data.credentialReviewedById = s.reviewedById;
  if ("reviewedAt" in s) data.credentialReviewedAt = s.reviewedAt;
  if ("verifiedById" in s) data.credentialVerifiedById = s.verifiedById;
  if ("verifiedAt" in s) data.credentialVerifiedAt = s.verifiedAt;
  if ("rejectReason" in s) data.credentialRejectReason = s.rejectReason;
  const { count } = await db.wellnessProvider.updateMany({ where: { id: p.id, credentialStatus: p.credentialStatus }, data });
  if (!count) back("The provider changed meanwhile. Refresh and try again.");
  await db.auditLog.create({
    data: {
      userId: session.id,
      orgId: null,
      action: credentialAuditAction(p.credentialStatus, to),
      details: JSON.stringify({ credentialType: "WELLNESS_PROVIDER", providerId: p.id, subjectUserId: p.userId, from: p.credentialStatus, to }),
    },
  });
  revalidatePath(PATH);
  back();
}
