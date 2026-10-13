"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { isOrgOwner } from "@/lib/membership";
import { rateLimit } from "@/lib/rate-limit";
import { sealSecret } from "@/lib/secret-box";
import { razorpayKeyMode, verifyRazorpayCreds } from "@/lib/gateways/razorpay";

type Result = { success: true; mode: "test" | "live" } | { success: false; error: string };

/**
 * ADMIN: connect the academy's OWN Razorpay account. Keys are verified live with Razorpay,
 * then the secrets are stored encrypted. Fee money settles straight to the academy.
 */
export async function connectRazorpay(input: { keyId: string; keySecret: string; webhookSecret?: string }): Promise<Result> {
  const session = await requireAuth(["ADMIN"]);
  if (!session.orgId) return { success: false, error: "No academy found for your account." };
  if (!(await isOrgOwner(session.id, session.orgId))) return { success: false, error: "Only the academy owner can change this." };
  if (!rateLimit(`rzp-connect:${session.orgId}`, 8, 10 * 60_000).allowed) {
    return { success: false, error: "Too many attempts. Please wait a few minutes." };
  }

  const keyId = String(input?.keyId || "").trim();
  const keySecret = String(input?.keySecret || "").trim();
  const webhookSecret = String(input?.webhookSecret || "").trim();
  const mode = razorpayKeyMode(keyId);
  if (!mode) return { success: false, error: "Key ID should start with rzp_test_ or rzp_live_." };
  if (keySecret.length < 10 || keySecret.length > 100) return { success: false, error: "Key Secret looks wrong. Copy it again from Razorpay." };
  if (webhookSecret.length > 200) return { success: false, error: "Webhook secret is too long." };

  const check = await verifyRazorpayCreds({ keyId, keySecret });
  if (check === "invalid") return { success: false, error: "Razorpay rejected these keys. Check the Key ID and Secret (same mode: test or live)." };
  if (check === "unreachable") return { success: false, error: "Couldn't reach Razorpay right now. Please try again." };

  await db.organization.update({
    where: { id: session.orgId },
    data: {
      razorpayKeyId: keyId,
      razorpayKeySecretEnc: sealSecret(keySecret),
      ...(webhookSecret ? { razorpayWebhookSecretEnc: sealSecret(webhookSecret) } : {}),
      razorpayConnectedAt: new Date(),
    },
  });
  await db.auditLog
    .create({ data: { userId: session.id, orgId: session.orgId, action: "RAZORPAY_CONNECTED", details: JSON.stringify({ keyId, mode, webhook: Boolean(webhookSecret) }) } })
    .catch(() => {});
  revalidatePath("/org");
  return { success: true, mode };
}

export async function disconnectRazorpay(): Promise<{ success: boolean; error?: string }> {
  const session = await requireAuth(["ADMIN"]);
  if (!session.orgId) return { success: false, error: "No academy found for your account." };
  if (!(await isOrgOwner(session.id, session.orgId))) return { success: false, error: "Only the academy owner can change this." };
  await db.organization.update({
    where: { id: session.orgId },
    data: { razorpayKeyId: null, razorpayKeySecretEnc: null, razorpayWebhookSecretEnc: null, razorpayConnectedAt: null },
  });
  await db.auditLog.create({ data: { userId: session.id, orgId: session.orgId, action: "RAZORPAY_DISCONNECTED", details: "{}" } }).catch(() => {});
  revalidatePath("/org");
  return { success: true };
}

/** Non-secret status for the Settings card. */
export async function getRazorpayStatus(): Promise<{
  connected: boolean;
  keyId: string | null;
  mode: "test" | "live" | null;
  webhook: boolean;
  connectedAt: string | null;
  webhookUrl: string;
}> {
  const session = await requireAuth(["ADMIN"]);
  const org = session.orgId
    ? await db.organization.findUnique({
        where: { id: session.orgId },
        select: { id: true, razorpayKeyId: true, razorpayKeySecretEnc: true, razorpayWebhookSecretEnc: true, razorpayConnectedAt: true },
      })
    : null;
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://triqsports.vercel.app").replace(/\/+$/, "");
  const keyId = org?.razorpayKeyId || null;
  return {
    connected: Boolean(keyId && org?.razorpayKeySecretEnc),
    keyId: keyId ? `${keyId.slice(0, 13)}…${keyId.slice(-4)}` : null,
    mode: keyId ? razorpayKeyMode(keyId) : null,
    webhook: Boolean(org?.razorpayWebhookSecretEnc),
    connectedAt: org?.razorpayConnectedAt?.toISOString() ?? null,
    webhookUrl: `${base}/api/webhooks/razorpay/${org?.id ?? "<academy-id>"}`,
  };
}
