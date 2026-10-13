import crypto from "crypto";

/** Stripe REST client (no SDK). Never logs or returns secrets. */

const API = "https://api.stripe.com/v1";

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

async function stripeFetch(path: string, init: RequestInit & { headers?: Record<string, string> }) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured");
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, ...(init.headers || {}) },
      cache: "no-store",
    });
  } catch {
    throw new Error("Could not reach Stripe");
  }
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const msg = data?.error?.message ? `: ${String(data.error.message).slice(0, 200)}` : "";
    throw new Error(`Stripe request failed (HTTP ${res.status})${msg}`);
  }
  return data;
}

export async function createStripeCheckoutSession(a: {
  amountMinor: number;
  currency: string;
  productName: string;
  paymentId: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}): Promise<{ id: string; url: string }> {
  if (!Number.isInteger(a.amountMinor) || a.amountMinor <= 0) {
    throw new Error("Invalid amount for Stripe session");
  }
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("line_items[0][price_data][currency]", a.currency.toLowerCase());
  form.set("line_items[0][price_data][unit_amount]", String(a.amountMinor));
  form.set("line_items[0][price_data][product_data][name]", a.productName.slice(0, 250));
  form.set("line_items[0][quantity]", "1");
  form.set("client_reference_id", a.paymentId);
  form.set("metadata[paymentId]", a.paymentId);
  form.set("success_url", a.successUrl);
  form.set("cancel_url", a.cancelUrl);
  form.set("payment_method_types[0]", "card");
  if (a.customerEmail) form.set("customer_email", a.customerEmail);

  const data = await stripeFetch("/checkout/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!data?.id || !data?.url) throw new Error("Stripe returned an incomplete checkout session");
  return { id: data.id, url: data.url };
}

export async function retrieveStripeCheckoutSession(id: string): Promise<{
  id: string;
  payment_status: string;
  amount_total: number | null;
  currency: string | null;
  payment_intent: string | null;
  client_reference_id: string | null;
}> {
  const d = await stripeFetch(`/checkout/sessions/${encodeURIComponent(id)}`, { method: "GET" });
  return {
    id: d.id,
    payment_status: d.payment_status,
    amount_total: typeof d.amount_total === "number" ? d.amount_total : null,
    currency: d.currency ?? null,
    payment_intent: typeof d.payment_intent === "string" ? d.payment_intent : (d.payment_intent?.id ?? null),
    client_reference_id: d.client_reference_id ?? null,
  };
}

const TOLERANCE_SECONDS = 300;

export function verifyStripeWebhook(rawBody: string, sigHeader: string | null): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !sigHeader) return false;

  let t = "";
  const v1: string[] = [];
  for (const part of sigHeader.split(",")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k === "t") t = v;
    else if (k === "v1") v1.push(v);
  }
  if (!/^\d+$/.test(t) || v1.length === 0) return false;
  const ts = Number(t);
  if (Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SECONDS) return false;

  const expected = Buffer.from(crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex"));
  let ok = false;
  for (const sig of v1) {
    const given = Buffer.from(sig);
    if (given.length === expected.length && crypto.timingSafeEqual(expected, given)) ok = true;
  }
  return ok;
}
