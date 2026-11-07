"use server";

// Family accounts (GuardianLink, flag FEATURES.familyAccounts). Exports only async functions.
import crypto from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { checkPermission } from "@/lib/membership";
import { getAppUrl } from "@/lib/app-url";
import { phoneLookupKeys, phoneStorageKey, toWaMeNumber } from "@/lib/phone";
import { rateLimitDb } from "@/lib/rate-limit";
import { belongsToOtherAcademy } from "@/lib/team";
import { canAddGuardian, normaliseRelation } from "@/lib/family/rules";

const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OFF_ERROR = "Family accounts are not switched on yet.";

type InviteResult =
  | { ok: true; guardianName: string; childName: string; loginUrl: string | null; whatsappUrl: string | null; note?: string }
  | { ok: false; error: string };

async function appOrigin() {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    if (host) return `${h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  } catch {
    // headers() unavailable
  }
  return getAppUrl();
}

/**
 * Owner/manager (students.manage): add a second guardian to a child by phone. Finds or creates a
 * PARENT user in this academy (same rules as adding a student), links them with GuardianLink, and
 * returns a single-use 7-day login link plus a WhatsApp share link (same pattern as createLoginLink).
 * Student.parentId is untouched and stays the primary guardian.
 */
export async function inviteSecondGuardian(input: { studentId: string; name: string; phone: string; relation?: string }): Promise<InviteResult> {
  if (!FEATURES.familyAccounts) return { ok: false, error: OFF_ERROR };
  const auth = await checkPermission("students.manage");
  if (!auth.ok) return { ok: false, error: auth.error };
  const { session } = auth;
  const orgId = session.orgId;

  const rl = await rateLimitDb(`guardian-invite:${session.id}`, 20, 10 * 60_000);
  if (!rl.allowed) return { ok: false, error: "Too many invites. Please wait a few minutes." };

  const name = String(input.name ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (name.length < 2) return { ok: false, error: "Enter the guardian's name." };
  const phoneKey = phoneStorageKey(input.phone);
  if (!phoneKey) return { ok: false, error: "Enter a valid mobile number." };
  const relation = normaliseRelation(input.relation);

  const student = await db.student.findFirst({
    where: { id: String(input.studentId ?? ""), orgId },
    select: { id: true, name: true, parentId: true },
  });
  if (!student) return { ok: false, error: "Student not found in your academy." };

  let user = await db.user.findFirst({
    where: { phone: { in: phoneLookupKeys(input.phone) } },
    select: { id: true, name: true, role: true, orgId: true, phone: true, memberships: { select: { orgId: true, status: true } } },
  });
  if (user && belongsToOtherAcademy(user, orgId, { countInvites: true })) {
    return { ok: false, error: "This number is registered with another academy." };
  }
  if (user && user.role !== "PARENT") return { ok: false, error: "This number belongs to a staff account, not a parent." };

  const links = await db.guardianLink.findMany({ where: { studentId: student.id }, select: { userId: true, isPrimary: true } });
  const check = canAddGuardian(student.parentId, links, user?.id ?? "__new_user__");
  if (!check.ok) return check;

  const now = new Date();
  const guardianId = await db.$transaction(async (tx) => {
    if (!user) {
      user = await tx.user.create({
        data: { name, phone: phoneKey, role: "PARENT", orgId },
        select: { id: true, name: true, role: true, orgId: true, phone: true, memberships: { select: { orgId: true, status: true } } },
      });
    } else if (!user.orgId) {
      await tx.user.update({ where: { id: user.id }, data: { orgId } });
    }
    // Mirror the legacy primary into GuardianLink once, so the table alone lists every guardian.
    if (!links.some((l) => l.isPrimary) && !links.some((l) => l.userId === student.parentId)) {
      await tx.guardianLink.create({
        data: { orgId, userId: student.parentId, studentId: student.id, relation: "GUARDIAN", isPrimary: true },
      });
    }
    // COUNSEL: the academy vouches for this guardian ("ADMIN"). Confirm whether a second guardian must
    // also confirm by OTP before they can give or withdraw consent for the child.
    await tx.guardianLink.create({
      data: { orgId, userId: user!.id, studentId: student.id, relation, isPrimary: false, verifiedAt: now, verificationMethod: "ADMIN" },
    });
    return user!.id;
  });

  try {
    await db.auditLog.create({
      data: { userId: session.id, orgId, action: "GUARDIAN_LINKED", details: JSON.stringify({ studentId: student.id, guardianUserId: guardianId, relation }) },
    });
  } catch {
    // never block on audit logging
  }
  revalidatePath("/org/waivers");

  // One-tap login link, as for other parents (createLoginLink / createParentInviteLinks pattern).
  const token = crypto.randomBytes(32).toString("hex");
  await db.loginToken.create({
    data: {
      userId: guardianId,
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + LINK_TTL_MS),
      createdById: session.id,
    },
  });
  const loginUrl = `${await appOrigin()}/auth/link/${token}`;
  const wa = toWaMeNumber(input.phone);
  const firstName = student.name.trim().split(/\s+/)[0] || student.name;
  const text = `Hi ${name}, you've been added as a guardian for ${firstName} at ${session.orgName || "the academy"} on TRIQ. Tap to sign in: ${loginUrl}`;
  return {
    ok: true,
    guardianName: user?.name || name,
    childName: student.name,
    loginUrl,
    whatsappUrl: wa ? `https://wa.me/${wa}?text=${encodeURIComponent(text)}` : null,
  };
}

/** Form-action wrapper for the owner page. Returns the result for the client form. */
export async function inviteSecondGuardianForm(_prev: InviteResult | null, formData: FormData): Promise<InviteResult> {
  return inviteSecondGuardian({
    studentId: String(formData.get("studentId") ?? ""),
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    relation: String(formData.get("relation") ?? ""),
  });
}

/** Owner/manager: guardians of one child in this academy. */
export async function listGuardiansForStudent(studentId: string) {
  const auth = await checkPermission("students.manage");
  if (!auth.ok) return { ok: false as const, error: auth.error };
  const student = await db.student.findFirst({ where: { id: studentId, orgId: auth.session.orgId }, select: { id: true } });
  if (!student) return { ok: false as const, error: "Student not found in your academy." };
  const { guardiansOfStudent } = await import("@/lib/family/guardians");
  const guardians = await guardiansOfStudent(student.id);
  return { ok: true as const, guardians: guardians.map((g) => ({ ...g, phone: g.phone ? `••••${g.phone.slice(-4)}` : null })) };
}
