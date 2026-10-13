"use server";

import crypto from "crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { cleanPhone } from "@/lib/coach";

// Same one-tap link format as src/app/actions/login-links.ts:
// 32 random bytes hex token in the URL, only its sha256 stored, single use, 7-day expiry,
// redeemed at /auth/link/[token].
const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_INVITES_PER_CALL = 100;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function appOrigin() {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");
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
  return "https://triqsports.vercel.app";
}

export interface ParentInvite {
  parentId: string;
  parentName: string;
  /** "Aarav" or "Aarav & Diya" when the parent has several kids in the coach's batches */
  childName: string;
  studentIds: string[];
  /** digits only, with 91 prefix */
  phone: string;
  url: string;
}

export type CreateParentInviteLinksResult =
  | { success: true; invites: ParentInvite[] }
  | { success: false; error: string };

/**
 * COACH / ADMIN. Creates one-tap login links for parents of students in the caller's batches
 * (ADMIN: any batch in their academy), so the coach can invite them on WhatsApp.
 *
 * - `studentIds` given → only those students (still scoped to the caller's batches).
 * - omitted → every parent in scope who has never opened the app (`lastSeenAt` null).
 * Only PARENT accounts of the same academy that have a usable phone number are included.
 */
export async function createParentInviteLinks(studentIds?: string[]): Promise<CreateParentInviteLinksResult> {
  const session = await requireAuth(["COACH", "ADMIN"]);
  const orgId = session.orgId;
  if (!orgId) return { success: false, error: "No academy found for your account." };

  const rl = rateLimit(`parent-invites:${session.id}`, 10, 10 * 60_000);
  if (!rl.allowed) return { success: false, error: "Too many invite requests. Please wait a few minutes and try again." };

  const ids = Array.isArray(studentIds)
    ? Array.from(new Set(studentIds.filter((s): s is string => typeof s === "string" && s.length > 0 && s.length < 64))).slice(0, 500)
    : undefined;
  if (ids && ids.length === 0) return { success: true, invites: [] };

  const isAdmin = session.role === "ADMIN";
  const batchScope = isAdmin ? { orgId } : { orgId, coachId: session.id as string };

  const students = await db.student.findMany({
    where: {
      ...(ids ? { id: { in: ids } } : {}),
      enrollments: { some: { batch: batchScope } },
      parent: {
        role: "PARENT",
        orgId,
        phone: { not: null },
        ...(ids ? {} : { lastSeenAt: null }),
      },
    },
    select: {
      id: true,
      name: true,
      parent: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { name: "asc" },
  });

  // Group by parent: one link per parent, even with several children
  const byParent = new Map<string, { parentName: string; phone: string; children: { id: string; name: string }[] }>();
  for (const s of students) {
    const phone = cleanPhone(s.parent.phone);
    if (!phone) continue;
    const entry = byParent.get(s.parent.id);
    if (entry) entry.children.push({ id: s.id, name: s.name });
    else byParent.set(s.parent.id, { parentName: s.parent.name, phone, children: [{ id: s.id, name: s.name }] });
  }

  const parents = Array.from(byParent.entries()).slice(0, MAX_INVITES_PER_CALL);
  if (parents.length === 0) return { success: true, invites: [] };

  const origin = await appOrigin();
  const expiresAt = new Date(Date.now() + LINK_TTL_MS);
  const rows = parents.map(([parentId, p]) => ({ parentId, p, token: crypto.randomBytes(32).toString("hex") }));

  await db.loginToken.createMany({
    data: rows.map((r) => ({
      userId: r.parentId,
      tokenHash: hashToken(r.token),
      expiresAt,
      createdById: session.id as string,
    })),
  });

  try {
    await db.auditLog.create({
      data: {
        userId: session.id,
        orgId,
        action: "CREATE_PARENT_INVITES",
        details: JSON.stringify({ count: rows.length, parentIds: rows.map((r) => r.parentId) }),
      },
    });
  } catch {
    // never block on audit logging
  }

  const firstNameOf = (n: string) => n.trim().split(/\s+/)[0] || n;
  return {
    success: true,
    invites: rows.map(({ parentId, p, token }) => {
      const names = p.children.map((c) => firstNameOf(c.name));
      const childName = names.length <= 2 ? names.join(" & ") : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
      return {
        parentId,
        parentName: p.parentName,
        childName,
        studentIds: p.children.map((c) => c.id),
        phone: p.phone,
        url: `${origin}/auth/link/${token}`,
      };
    }),
  };
}
