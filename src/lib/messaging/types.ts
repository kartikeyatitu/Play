// Channel-agnostic messaging vocabulary. Pure and client-safe.

export const MESSAGE_CHANNELS = ["WHATSAPP", "EMAIL", "SMS", "PUSH"] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

/** QUEUED -> SENT -> DELIVERED -> READ, or FAILED. RETRYING = waiting for nextAttemptAt. */
export const DELIVERY_STATUSES = ["QUEUED", "RETRYING", "SENT", "DELIVERED", "READ", "FAILED", "SKIPPED"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** Categories a user can switch on/off per channel, plus SAFETY (never shown, always on). */
export const NOTIFICATION_CATEGORIES = ["FEES", "ATTENDANCE", "MATCHES", "PROGRESS", "REWARDS", "ACADEMY_NEWS", "SAFETY"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export function isChannel(v: unknown): v is MessageChannel {
  return typeof v === "string" && (MESSAGE_CHANNELS as readonly string[]).includes(v);
}

export function isCategory(v: unknown): v is NotificationCategory {
  return typeof v === "string" && (NOTIFICATION_CATEGORIES as readonly string[]).includes(v);
}

export interface SendMessageInput {
  channel: MessageChannel;
  category: NotificationCategory;
  /** Raw phone (WHATSAPP/SMS) or email (EMAIL). Never stored; only its hash (toRef) is. */
  to: string;
  /** Provider template name (WhatsApp approved template, email template id). */
  template: string;
  language?: string;
  params?: string[];
  orgId?: string | null;
  /** Recipient's user id, when known: used for the notification-preference check. */
  userId?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  /** Same key twice = one send. */
  idempotencyKey?: string | null;
}

export interface ProviderResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
  /** False when trying again cannot help (bad number, provider switched off). */
  retryable?: boolean;
}

export interface SendMessageResult {
  ok: boolean;
  status: DeliveryStatus;
  deliveryId?: string;
  error?: string;
}
