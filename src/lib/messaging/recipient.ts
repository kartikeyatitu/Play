// Recipient reference: a keyed hash of the normalised phone or email. MessageDelivery stores only this,
// never the raw address. Server-only (node:crypto).

import { createHash, createHmac } from "node:crypto";
import { normalizePhone } from "@/lib/phone";
import type { MessageChannel } from "./types";

/** Normalise the address so the same person always hashes the same way. */
export function normaliseRecipient(channel: MessageChannel, to: string): string | null {
  const raw = String(to ?? "").trim();
  if (!raw) return null;
  if (channel === "EMAIL") {
    const e = raw.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
  }
  if (channel === "PUSH") return raw;
  return normalizePhone(raw);
}

/**
 * "<channel>:<64 hex>". Keyed with the existing session secret when present (phone numbers are
 * guessable, so a plain hash could be reversed by brute force); falls back to a plain SHA-256.
 */
export function toRef(channel: MessageChannel, normalised: string): string {
  const key = process.env.SESSION_SECRET || process.env.HMAC_SECRET;
  const input = `triq-msg-v1:${channel}:${normalised}`;
  const hex = key ? createHmac("sha256", key).update(input).digest("hex") : createHash("sha256").update(input).digest("hex");
  return `${channel.toLowerCase()}:${hex}`;
}
