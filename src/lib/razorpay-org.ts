import { db } from "@/lib/db";
import { openSecret } from "@/lib/secret-box";
import type { RazorpayCreds } from "@/lib/gateways/razorpay";

/** Server-only: the academy's own Razorpay credentials, or null if not connected. */
export async function getOrgRazorpay(orgId: string): Promise<(RazorpayCreds & { webhookSecret: string | null }) | null> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { razorpayKeyId: true, razorpayKeySecretEnc: true, razorpayWebhookSecretEnc: true },
  });
  if (!org?.razorpayKeyId) return null;
  const keySecret = openSecret(org.razorpayKeySecretEnc);
  if (!keySecret) return null;
  return { keyId: org.razorpayKeyId, keySecret, webhookSecret: openSecret(org.razorpayWebhookSecretEnc) };
}

/** Strip credential columns before an Organization row is passed to a client component. */
export function publicOrg<T extends Record<string, any> | null | undefined>(org: T) {
  if (!org) return org;
  const { razorpayKeySecretEnc, razorpayWebhookSecretEnc, ...rest } = org as any;
  void razorpayKeySecretEnc;
  void razorpayWebhookSecretEnc;
  return { ...rest, razorpayConnected: Boolean(rest.razorpayKeyId && razorpayKeySecretEnc) } as Omit<NonNullable<T>, "razorpayKeySecretEnc" | "razorpayWebhookSecretEnc"> & { razorpayConnected: boolean };
}
