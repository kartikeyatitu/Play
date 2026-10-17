"use server";

import crypto from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { setSessionCookie, homePathForRole } from "@/lib/auth";
import { checkPermission, hasPermission } from "@/lib/membership";
import { getAppUrl } from "@/lib/app-url";

const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function appOrigin() {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // headers() unavailable — fall through
  }
  return getAppUrl();
}

/**
 * ADMIN only. Creates a single-use, 7-day one-tap login link for a coach/parent/admin
 * in the admin's own academy. Only the sha256 hash of the token is stored.
 * Parents need students.manage, coaches team.manage; links for admin accounts are owner-only
 * (a link signs in AS that person, so a manager must not be able to mint one for the owner).
 */
export async function createLoginLink(userId: string) {
  const auth = await checkPermission(null);
  if (!auth.ok) return { success: false as const, error: auth.error };
  const { session, membership } = auth;

  const user = await db.user.findFirst({
    where: { id: userId, orgId: session.orgId },
    select: { id: true, name: true, phone: true, role: true },
  });
  if (!user) return { success: false as const, error: "User not found in your academy." };
  if (!["COACH", "PARENT", "ADMIN"].includes(user.role)) {
    return { success: false as const, error: "Login links are only available for coaches, parents and admins." };
  }
  const allowed =
    user.role === "ADMIN"
      ? membership.role === "OWNER"
      : hasPermission(membership, user.role === "PARENT" ? "students.manage" : "team.manage");
  if (!allowed) return { success: false as const, error: "You don't have permission to do this" };

  const token = crypto.randomBytes(32).toString("hex");
  await db.loginToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + LINK_TTL_MS),
      createdById: session.id,
    },
  });

  try {
    await db.auditLog.create({
      data: { userId: session.id, orgId: session.orgId, action: "CREATE_LOGIN_LINK", details: JSON.stringify({ targetUserId: user.id }) },
    });
  } catch {
    // never block on audit logging
  }

  const url = `${await appOrigin()}/auth/link/${token}`;
  return {
    success: true as const,
    url,
    name: user.name,
    phone: user.phone,
    role: user.role,
    academyName: session.orgName || "your academy",
  };
}

/** Look up a link without consuming it (safe for WhatsApp link previews). */
export async function inspectLoginLink(token: string) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return { valid: false as const, reason: "invalid" };
  const record = await db.loginToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { name: true, role: true, org: { select: { name: true } } } } },
  });
  if (!record) return { valid: false as const, reason: "invalid" };
  if (record.usedAt) return { valid: false as const, reason: "used" };
  if (record.expiresAt < new Date()) return { valid: false as const, reason: "expired" };
  return { valid: true as const, name: record.user.name, role: record.user.role, academyName: record.user.org?.name || null };
}

/** Consumes the link (single use), sets the session cookie and redirects by role. */
export async function redeemLoginLink(formData: FormData) {
  const token = String(formData.get("token") || "");
  if (!/^[a-f0-9]{64}$/.test(token)) redirect("/auth/link/invalid");
  const tokenHash = hashToken(token);

  // Atomically mark as used only if still unused and unexpired
  const now = new Date();
  const updated = await db.loginToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (updated.count !== 1) redirect(`/auth/link/${token}`);

  const record = await db.loginToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, role: true, orgId: true } } },
  });
  if (!record) redirect("/login");

  await setSessionCookie(record.user.id, record.user.role);
  redirect(homePathForRole(record.user.role, !!record.user.orgId));
}
