import { normalizePhone, toWaMeNumber } from "@/lib/phone";

// WhatsApp Business (Cloud) API configuration.
// Graph API v18.0 stopped serving requests in Jan 2026; keep the default on a supported version.
export const DEFAULT_WHATSAPP_API_URL = "https://graph.facebook.com/v25.0";

export const WHATSAPP_CONFIG = {
  apiUrl: process.env.WHATSAPP_API_URL || DEFAULT_WHATSAPP_API_URL,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
  isConfigured: !!process.env.WHATSAPP_ACCESS_TOKEN,
};

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: "fee_reminder" | "attendance_alert" | "birthday_wish" | "announcement" | "welcome" | "trial_followup";
  body: string;
  variables: string[]; // placeholders like {{student_name}}, {{amount}}
  isActive: boolean;
}

// Pre-built message templates (WhatsApp Business API format).
// Keep fee/attendance/welcome/report copy free of offers, discounts and coupon codes: Meta classifies
// any template with promotional content as MARKETING (several times the per-message price of UTILITY
// in India) and can re-categorise an approved template if offers creep in later.
export const MESSAGE_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: "fee_reminder",
    name: "Fee Reminder",
    category: "fee_reminder",
    body: "💰 Fee Reminder\n\nDear {{parent_name}},\n\nThis is a reminder that {{student_name}}'s fee of ₹{{amount}} for {{month}} is pending.\n\nPlease pay at your earliest convenience.\n\n— {{academy_name}}",
    variables: ["parent_name", "student_name", "amount", "month", "academy_name"],
    isActive: true,
  },
  {
    id: "attendance_alert",
    name: "Attendance Alert",
    category: "attendance_alert",
    body: "⚠️ Attendance Alert\n\nDear {{parent_name}},\n\n{{student_name}} was marked absent today ({{date}}) from {{batch_name}}.\n\nIf this is unexpected, please contact us.\n\n— {{academy_name}}",
    variables: ["parent_name", "student_name", "date", "batch_name", "academy_name"],
    isActive: true,
  },
  {
    id: "birthday_wish",
    name: "Birthday Wish",
    category: "birthday_wish",
    body: "🎂 Happy Birthday!\n\nDear {{parent_name}},\n\nWishing {{student_name}} a very Happy Birthday! 🎉\n\nHave a wonderful year ahead, on and off the field.\n\n— {{academy_name}}",
    variables: ["parent_name", "student_name", "academy_name"],
    isActive: true,
  },
  {
    id: "welcome",
    name: "Welcome Message",
    category: "welcome",
    body: "🏆 Welcome to {{academy_name}}!\n\nDear {{parent_name}},\n\n{{student_name}} has been enrolled in {{batch_name}}.\n\nSchedule: {{schedule}}\nCoach: {{coach_name}}\n\nWe're excited to have you! 🌟\n\n— {{academy_name}}",
    variables: ["parent_name", "student_name", "batch_name", "schedule", "coach_name", "academy_name"],
    isActive: true,
  },
  {
    id: "trial_followup",
    name: "Trial Follow-up",
    category: "trial_followup",
    body: "👋 Hi {{parent_name}},\n\nThank you for attending the trial session at {{academy_name}}!\n\nWe'd love to have {{student_name}} join us. Here's what you get:\n\n✅ Professional coaching\n✅ Age-appropriate training\n✅ Progress tracking\n\nReply to this message if you have any questions about joining.\n\n— {{academy_name}}",
    variables: ["parent_name", "student_name", "academy_name"],
    isActive: true,
  },
  {
    id: "progress_report",
    name: "Monthly Progress Report",
    category: "announcement",
    body: "📊 Monthly Report\n\nDear {{parent_name}},\n\n{{student_name}}'s report for {{month}}:\n\n🎯 Technique: {{technique}}/5\n💪 Fitness: {{fitness}}/5\n🏅 Discipline: {{discipline}}/5\n📈 Attendance: {{attendance}}%\n\nCoach Notes: {{notes}}\n\n— {{academy_name}}",
    variables: ["parent_name", "student_name", "month", "technique", "fitness", "discipline", "attendance", "notes", "academy_name"],
    isActive: true,
  },
];

// Helper to fill template variables
export function fillTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

// Generate wa.me link (fallback when API not configured).
// Bare 10-digit numbers are Indian; "+44…" stays "44…" (it used to become "9144…"), and a 10-digit
// Indian number that happens to start with 91 now gets its country code too.
export function generateWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const fullPhone = toWaMeNumber(phone) ?? (cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`);
  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
}

// ─── Server-side Cloud API sender ────────────────────────────────────────────
// Only call this from server code (actions / route handlers). It reads non-NEXT_PUBLIC env vars,
// which are never inlined into client bundles, so client components importing this module for
// MESSAGE_TEMPLATES etc. expose nothing (and tree-shaking drops the sender from their bundles).

export interface WhatsAppButtonParam {
  /** "url" for copy-code / one-tap authentication buttons and dynamic URL buttons; "quick_reply" for payload buttons. */
  subType: "url" | "quick_reply";
  index: number;
  params: string[];
}

export interface SendWhatsAppTemplateInput {
  /** Any phone format parsePhone understands; sent as E.164 digits. */
  to: string;
  /** Approved template name in WhatsApp Manager. */
  template: string;
  /** Template language code, e.g. "en", "en_US", "hi". */
  language: string;
  bodyParams?: string[];
  buttonParams?: WhatsAppButtonParam[];
}

export interface SendWhatsAppResult {
  ok: boolean;
  /** WhatsApp message id ("wamid.…") on success. */
  id?: string;
  error?: string;
}

const WHATSAPP_TIMEOUT_MS = 10_000;

/** Pure: the Cloud API request body for a template message (exported for the self-check script). */
export function buildWhatsAppTemplatePayload(toE164: string, a: Omit<SendWhatsAppTemplateInput, "to">) {
  const components: Record<string, unknown>[] = [];
  if (a.bodyParams?.length) {
    components.push({ type: "body", parameters: a.bodyParams.map((text) => ({ type: "text", text })) });
  }
  for (const b of a.buttonParams ?? []) {
    components.push({
      type: "button",
      sub_type: b.subType,
      index: String(b.index),
      parameters: b.params.map((p) => (b.subType === "quick_reply" ? { type: "payload", payload: p } : { type: "text", text: p })),
    });
  }
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toE164.replace(/^\+/, ""),
    type: "template",
    template: { name: a.template, language: { code: a.language }, ...(components.length ? { components } : {}) },
  };
}

/** Sends an approved template via the WhatsApp Cloud API. Never throws; never puts secrets in `error`. */
export async function sendWhatsAppTemplate(input: SendWhatsAppTemplateInput): Promise<SendWhatsAppResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return { ok: false, error: "WhatsApp is not configured" };
  if (!input?.template) return { ok: false, error: "Missing template name" };

  const e164 = normalizePhone(input.to);
  if (!e164) return { ok: false, error: "Invalid recipient phone number" };

  const base = (process.env.WHATSAPP_API_URL || DEFAULT_WHATSAPP_API_URL).replace(/\/+$/, "");
  const url = `${base}/${encodeURIComponent(phoneNumberId)}/messages`;
  const scrub = (s: string) => s.split(token).join("***");

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildWhatsAppTemplatePayload(e164, input)),
      cache: "no-store",
      signal: AbortSignal.timeout(WHATSAPP_TIMEOUT_MS),
    });
  } catch (e: any) {
    return { ok: false, error: e?.name === "TimeoutError" ? "WhatsApp API timed out" : "Could not reach WhatsApp API" };
  }

  let data: any = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const code = data?.error?.code ? `, code ${data.error.code}` : "";
    const msg = typeof data?.error?.message === "string" ? `: ${scrub(data.error.message).slice(0, 200)}` : "";
    return { ok: false, error: `WhatsApp API error (HTTP ${res.status}${code})${msg}` };
  }
  const id = data?.messages?.[0]?.id;
  return typeof id === "string" ? { ok: true, id } : { ok: true };
}
