// sendMessage: channel-agnostic outbound send with a delivery log. Server-only.
//
// Flow: preference check -> recipient normalised and hashed (toRef) -> idempotency check -> provider
// send -> MessageDelivery row (status, attempts, nextAttemptAt). The raw phone/email is never stored.
// While FEATURES.messageDelivery is off, MessageDelivery / NotificationPreference are never touched:
// the provider is called directly and nothing is logged.

import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { providerFor } from "./providers";
import { shouldSend } from "./preferences-server";
import { normaliseRecipient, toRef } from "./recipient";
import { isDue, isRetryableError, MAX_ATTEMPTS, nextAttempt } from "./retry";
import type { MessageChannel, SendMessageInput, SendMessageResult } from "./types";

const clip = (s: string | undefined | null, n = 300) => (s ? String(s).slice(0, n) : null);

export async function sendMessage(input: SendMessageInput, now: Date = new Date()): Promise<SendMessageResult> {
  if (!(await shouldSend(input.userId, input.channel, input.category))) {
    return { ok: false, status: "SKIPPED", error: "Recipient has switched this notification off." };
  }
  const to = normaliseRecipient(input.channel, input.to);
  if (!to) return { ok: false, status: "FAILED", error: "Invalid recipient" };
  const provider = providerFor(input.channel);

  if (!FEATURES.messageDelivery) {
    const r = await provider.send({ to, template: input.template, language: input.language, params: input.params });
    return r.ok ? { ok: true, status: "SENT" } : { ok: false, status: "FAILED", error: r.error };
  }

  const ref = toRef(input.channel, to);
  const key = input.idempotencyKey ? clip(input.idempotencyKey, 200) : null;
  if (key) {
    const existing = await db.messageDelivery.findUnique({ where: { idempotencyKey: key }, select: { id: true, status: true } });
    if (existing) return { ok: existing.status !== "FAILED", status: existing.status as SendMessageResult["status"], deliveryId: existing.id };
  }

  let row: { id: string };
  try {
    row = await db.messageDelivery.create({
      data: {
        orgId: input.orgId ?? null,
        channel: input.channel,
        toRef: ref,
        template: input.template.slice(0, 120),
        status: "QUEUED",
        relatedType: clip(input.relatedType, 40),
        relatedId: clip(input.relatedId, 64),
        idempotencyKey: key,
      },
      select: { id: true },
    });
  } catch (e: any) {
    // Lost a race on idempotencyKey: the other request owns the send.
    if (e?.code === "P2002" && key) {
      const other = await db.messageDelivery.findUnique({ where: { idempotencyKey: key }, select: { id: true, status: true } });
      if (other) return { ok: other.status !== "FAILED", status: other.status as SendMessageResult["status"], deliveryId: other.id };
    }
    throw e;
  }

  return attemptAndRecord(row.id, 0, input.channel, { to, template: input.template, language: input.language, params: input.params }, now);
}

async function attemptAndRecord(
  deliveryId: string,
  prevAttempts: number,
  channel: MessageChannel,
  payload: { to: string; template: string; language?: string; params?: string[] },
  now: Date,
): Promise<SendMessageResult> {
  const r = await providerFor(channel).send(payload);
  const retryable = r.ok ? false : (r.retryable ?? isRetryableError(r.error));
  const outcome = nextAttempt(prevAttempts, r.ok, retryable, now);
  await db.messageDelivery.update({
    where: { id: deliveryId },
    data: {
      status: outcome.status,
      attempts: outcome.attempts,
      nextAttemptAt: outcome.nextAttemptAt,
      lastError: r.ok ? null : clip(r.error),
      ...(r.ok ? { sentAt: now, providerMessageId: r.providerMessageId ?? null } : {}),
    },
  });
  return r.ok ? { ok: true, status: outcome.status, deliveryId } : { ok: false, status: outcome.status, deliveryId, error: r.error };
}

// ─── Retries ────────────────────────────────────────────────────────────────
//
// The delivery row holds only a hash of the recipient and no template parameters, so a retry has to
// rebuild the message from its source record (relatedType + relatedId). Register one resolver per
// relatedType. Rows whose relatedType has no resolver are marked FAILED rather than retried blindly.

export interface RetryPayload {
  to: string;
  template?: string;
  language?: string;
  params?: string[];
  userId?: string | null;
  category?: SendMessageInput["category"];
}
export type RetryResolver = (relatedId: string) => Promise<RetryPayload | null>;

const RESOLVERS = new Map<string, RetryResolver>();

export function registerRetryResolver(relatedType: string, resolver: RetryResolver) {
  RESOLVERS.set(relatedType, resolver);
}

export async function retryDueDeliveries(now: Date = new Date(), limit = 100) {
  const summary = { picked: 0, sent: 0, rescheduled: 0, failed: 0 };
  if (!FEATURES.messageDelivery) return { ...summary, skipped: "messageDelivery flag is off" as const };

  const rows = await db.messageDelivery.findMany({
    where: { status: { in: ["RETRYING", "QUEUED"] }, attempts: { lt: MAX_ATTEMPTS }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
    select: { id: true, channel: true, toRef: true, template: true, status: true, attempts: true, nextAttemptAt: true, relatedType: true, relatedId: true },
  });

  for (const row of rows) {
    if (!isDue(row, now)) continue;
    summary.picked++;
    const fail = async (why: string) => {
      await db.messageDelivery.update({ where: { id: row.id }, data: { status: "FAILED", nextAttemptAt: null, lastError: why } });
      summary.failed++;
    };
    const resolver = row.relatedType ? RESOLVERS.get(row.relatedType) : undefined;
    if (!resolver || !row.relatedId) {
      await fail("No retry resolver for this message type");
      continue;
    }
    const channel = row.channel as MessageChannel;
    let payload: RetryPayload | null = null;
    try {
      payload = await resolver(row.relatedId);
    } catch (e) {
      payload = null;
    }
    const to = payload ? normaliseRecipient(channel, payload.to) : null;
    if (!payload || !to) {
      await fail("Source record or recipient no longer available");
      continue;
    }
    // Recipient changed since the first attempt (e.g. phone updated): do not send to someone else.
    if (toRef(channel, to) !== row.toRef) {
      await fail("Recipient changed since first attempt");
      continue;
    }
    if (payload.category && !(await shouldSend(payload.userId, channel, payload.category))) {
      await db.messageDelivery.update({ where: { id: row.id }, data: { status: "SKIPPED", nextAttemptAt: null } });
      continue;
    }
    const r = await attemptAndRecord(row.id, row.attempts, channel, { to, template: payload.template || row.template, language: payload.language, params: payload.params }, now);
    if (r.status === "SENT") summary.sent++;
    else if (r.status === "RETRYING") summary.rescheduled++;
    else summary.failed++;
  }
  return summary;
}
