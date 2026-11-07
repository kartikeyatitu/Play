// Message providers. Server-only. One provider per channel; sendMessage picks by channel.
//
// WHATSAPP: the existing WhatsApp Cloud API sender (src/lib/whatsapp.ts). Without WHATSAPP_ACCESS_TOKEN
//           it returns "WhatsApp is not configured" (non-retryable), exactly as today; academies keep
//           using the wa.me links in reminders.ts.
// EMAIL:    interface only, DISABLED. No email vendor is wired: choosing one needs founder approval.
// SMS/PUSH: not wired.

import { sendWhatsAppTemplate } from "@/lib/whatsapp";
import { isRetryableError } from "./retry";
import type { MessageChannel, ProviderResult } from "./types";

export interface ProviderSendInput {
  /** Normalised address (E.164 phone or lower-case email). */
  to: string;
  template: string;
  language?: string;
  params?: string[];
}

export interface MessageProvider {
  channel: MessageChannel;
  enabled: boolean;
  send(input: ProviderSendInput): Promise<ProviderResult>;
}

export const whatsappProvider: MessageProvider = {
  channel: "WHATSAPP",
  get enabled() {
    return !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  },
  async send(input) {
    const r = await sendWhatsAppTemplate({ to: input.to, template: input.template, language: input.language || "en", bodyParams: input.params });
    if (r.ok) return { ok: true, providerMessageId: r.id };
    return { ok: false, error: r.error, retryable: isRetryableError(r.error) };
  },
};

export const EMAIL_DISABLED_ERROR = "Email sending is disabled (no email vendor approved yet).";

/**
 * Email provider placeholder. Implement send() with the approved vendor's API (founder approval
 * needed for the vendor, sender domain and DPA) and flip `enabled`.
 */
export const emailProvider: MessageProvider = {
  channel: "EMAIL",
  enabled: false,
  async send() {
    return { ok: false, error: EMAIL_DISABLED_ERROR, retryable: false };
  },
};

function unavailable(channel: MessageChannel): MessageProvider {
  return {
    channel,
    enabled: false,
    async send() {
      return { ok: false, error: `${channel} is not available`, retryable: false };
    },
  };
}

const PROVIDERS: Record<MessageChannel, MessageProvider> = {
  WHATSAPP: whatsappProvider,
  EMAIL: emailProvider,
  SMS: unavailable("SMS"),
  PUSH: unavailable("PUSH"),
};

export function providerFor(channel: MessageChannel): MessageProvider {
  return PROVIDERS[channel];
}
