"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { rateLimitDb } from "@/lib/rate-limit";
import { phoneLookupKeys } from "@/lib/phone";

/**
 * Records an account-deletion REQUEST for manual review. This action deletes nothing:
 * the actual purge pipeline is not built yet and needs founder approval.
 */

export type AccountDeletionResult =
  | { ok: true; referenceId: string; method: "session" | "phone" }
  | { ok: false; error: string };

export const ACCOUNT_DELETION_AUDIT_ACTION = "ACCOUNT_DELETION_REQUEST";

const HOUR_MS = 60 * 60_000;
const MAX_REASON_LENGTH = 500;
const PRIVACY_EMAIL = "privacy@triq.app";

async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    return (h.get("x-forwarded-for") || h.get("x-real-ip") || "unknown").split(",")[0].trim() || "unknown";
  } catch {
    return "unknown";
  }
}

export async function requestAccountDeletion(input: {
  phone?: string;
  reason?: string;
  confirmed: boolean;
}): Promise<AccountDeletionResult> {
  if (!input.confirmed) {
    return { ok: false, error: "Please tick the confirmation box to submit your request." };
  }

  const ip = await clientIp();
  if (!(await rateLimitDb(`acct-del:ip:${ip}`, 10, HOUR_MS)).allowed) {
    return { ok: false, error: "Too many requests from this network. Please try again later." };
  }

  const reason = String(input.reason ?? "").trim().slice(0, MAX_REASON_LENGTH) || null;

  // Signed-in users are identified by their session. Everyone else must give the registered number.
  const session = await getSession();
  let userId: string | null = null;
  let orgId: string | null = null;
  let method: "session" | "phone";

  if (session?.id) {
    method = "session";
    const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, orgId: true } });
    if (!user) return { ok: false, error: "Your session has expired. Please sign in again." };
    userId = user.id;
    orgId = user.orgId ?? null;
  } else {
    method = "phone";
    const keys = phoneLookupKeys(input.phone);
    if (keys.length === 0 || !keys[0] || keys[0].length < 10) {
      return { ok: false, error: "Enter the 10-digit mobile number registered on your account." };
    }
    if (!(await rateLimitDb(`acct-del:phone:${keys[0]}`, 3, HOUR_MS)).allowed) {
      return { ok: false, error: "Too many requests for this number. Please try again later." };
    }

    const user = await db.user.findFirst({
      where: { phone: { in: keys } },
      select: { id: true, orgId: true },
    });
    if (!user) {
      // The audit log requires a known user, so an unmatched number cannot be logged here.
      return {
        ok: false,
        error: `We could not find an account for that number. Email ${PRIVACY_EMAIL} and we will review your request manually.`,
      };
    }
    userId = user.id;
    orgId = user.orgId ?? null;
  }

  try {
    const row = await db.auditLog.create({
      data: {
        userId: userId!,
        orgId,
        action: ACCOUNT_DELETION_AUDIT_ACTION,
        details: JSON.stringify({
          method,
          reason,
          requestedAt: new Date().toISOString(),
          status: "PENDING_MANUAL_REVIEW",
        }),
      },
      select: { id: true },
    });
    return { ok: true, referenceId: row.id, method };
  } catch (e) {
    console.error("requestAccountDeletion: failed to record request", e);
    return {
      ok: false,
      error: `We could not record your request. Please try again, or email ${PRIVACY_EMAIL}.`,
    };
  }
}
