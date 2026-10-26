import crypto from "crypto";

/**
 * Razorpay REST client (no SDK). Never logs or returns secrets.
 *
 * Every call takes explicit credentials: academy fees use the ACADEMY'S OWN Razorpay account
 * (see src/lib/razorpay-org.ts), so money settles to the academy and never passes through Triq.
 */
export type RazorpayCreds = { keyId: string; keySecret: string };

const API = "https://api.razorpay.com/v1";

async function rzp<T = any>(creds: RazorpayCreds, path: string, init: { method?: string; body?: unknown } = {}): Promise<{ status: number; data: T }> {
  const auth = Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64");
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: init.method || "GET",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new Error("Could not reach Razorpay");
  }
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, data };
}

function fail(what: string, r: { status: number; data: any }): never {
  const desc = r.data?.error?.description ? `: ${String(r.data.error.description).slice(0, 200)}` : "";
  throw new Error(`${what} failed (HTTP ${r.status})${desc}`);
}

/** Key ID shape check (rzp_test_… / rzp_live_…). */
export function razorpayKeyMode(keyId: string): "test" | "live" | null {
  if (/^rzp_test_[A-Za-z0-9]{6,}$/.test(keyId)) return "test";
  if (/^rzp_live_[A-Za-z0-9]{6,}$/.test(keyId)) return "live";
  return null;
}

/** Validates credentials with a harmless read call. */
export async function verifyRazorpayCreds(creds: RazorpayCreds): Promise<"ok" | "invalid" | "unreachable"> {
  try {
    const r = await rzp(creds, "/payments?count=1");
    if (r.status === 200) return "ok";
    if (r.status === 401) return "invalid";
    return "unreachable";
  } catch {
    return "unreachable";
  }
}

export async function createRazorpayOrder(
  creds: RazorpayCreds,
  a: { amountMinor: number; currency: string; receipt: string; notes?: Record<string, string> }
): Promise<{ id: string }> {
  if (!Number.isInteger(a.amountMinor) || a.amountMinor <= 0) throw new Error("Invalid amount for Razorpay order");
  const r = await rzp<{ id?: string }>(creds, "/orders", {
    method: "POST",
    body: { amount: a.amountMinor, currency: a.currency.toUpperCase(), receipt: a.receipt.slice(0, 40), notes: a.notes ?? {} },
  });
  if (r.status !== 200 || !r.data.id) fail("Razorpay order creation", r);
  return { id: r.data.id! };
}

/** Payment Link: a hosted page (UPI / cards / netbanking) the academy can share on WhatsApp. */
export async function createRazorpayPaymentLink(
  creds: RazorpayCreds,
  a: {
    amountMinor: number;
    description: string;
    referenceId: string;
    customer?: { name?: string; contact?: string; email?: string };
    notes?: Record<string, string>;
    expireBy?: number; // unix seconds
    callbackUrl?: string;
  }
): Promise<{ id: string; shortUrl: string }> {
  if (!Number.isInteger(a.amountMinor) || a.amountMinor <= 0) throw new Error("Invalid amount for payment link");
  const r = await rzp<{ id?: string; short_url?: string }>(creds, "/payment_links", {
    method: "POST",
    body: {
      amount: a.amountMinor,
      currency: "INR",
      accept_partial: false,
      description: a.description.slice(0, 2048),
      reference_id: a.referenceId.slice(0, 40),
      customer: a.customer,
      notify: { sms: false, email: false }, // the academy shares it on WhatsApp itself
      reminder_enable: false,
      notes: a.notes ?? {},
      ...(a.expireBy ? { expire_by: a.expireBy } : {}),
      ...(a.callbackUrl ? { callback_url: a.callbackUrl, callback_method: "get" } : {}),
    },
  });
  if (r.status !== 200 || !r.data.id || !r.data.short_url) fail("Razorpay payment link creation", r);
  return { id: r.data.id!, shortUrl: r.data.short_url! };
}

export async function fetchRazorpayPaymentLink(
  creds: RazorpayCreds,
  linkId: string
): Promise<{ status: string; amountPaid: number; paymentId: string | null }> {
  const r = await rzp<any>(creds, `/payment_links/${encodeURIComponent(linkId)}`);
  if (r.status !== 200) fail("Razorpay payment link fetch", r);
  const payments: any[] = Array.isArray(r.data.payments) ? r.data.payments : [];
  const captured = payments.find((p) => p.status === "captured") || payments[0];
  return { status: String(r.data.status || ""), amountPaid: Number(r.data.amount_paid || 0), paymentId: captured?.payment_id || null };
}

export async function cancelRazorpayPaymentLink(creds: RazorpayCreds, linkId: string): Promise<void> {
  await rzp(creds, `/payment_links/${encodeURIComponent(linkId)}/cancel`, { method: "POST" }).catch(() => {});
}

// ─── Recurring payments (UPI AutoPay mandates) — used only by src/lib/autopay-service.ts (flag upiAutopay) ───

/** Create (or, with fail_existing "0", return the existing) Razorpay customer for a parent. */
export async function createRazorpayCustomer(
  creds: RazorpayCreds,
  a: { name: string; contact?: string; email?: string; notes?: Record<string, string> }
): Promise<{ id: string }> {
  const r = await rzp<{ id?: string }>(creds, "/customers", {
    method: "POST",
    body: { name: a.name.slice(0, 50), contact: a.contact, email: a.email, fail_existing: "0", notes: a.notes ?? {} },
  });
  if (r.status !== 200 || !r.data.id) fail("Razorpay customer creation", r);
  return { id: r.data.id! };
}

/** Order that registers a UPI mandate (Recurring Payments: method upi + token block). */
export async function createRazorpayMandateOrder(
  creds: RazorpayCreds,
  a: { amountMinor: number; customerId: string; maxAmountMinor: number; expireAt: number; receipt: string; notes?: Record<string, string> }
): Promise<{ id: string }> {
  const r = await rzp<{ id?: string }>(creds, "/orders", {
    method: "POST",
    body: {
      amount: a.amountMinor,
      currency: "INR",
      customer_id: a.customerId,
      method: "upi",
      receipt: a.receipt.slice(0, 40),
      notes: a.notes ?? {},
      token: { max_amount: a.maxAmountMinor, expire_at: a.expireAt, frequency: "monthly" },
    },
  });
  if (r.status !== 200 || !r.data.id) fail("Razorpay mandate order creation", r);
  return { id: r.data.id! };
}

/** Order for one subsequent (monthly) debit. Auto-captured. */
export async function createRazorpayChargeOrder(
  creds: RazorpayCreds,
  a: { amountMinor: number; receipt: string; notes?: Record<string, string> }
): Promise<{ id: string }> {
  if (!Number.isInteger(a.amountMinor) || a.amountMinor <= 0) throw new Error("Invalid amount for Razorpay order");
  const r = await rzp<{ id?: string }>(creds, "/orders", {
    method: "POST",
    body: { amount: a.amountMinor, currency: "INR", payment_capture: true, receipt: a.receipt.slice(0, 40), notes: a.notes ?? {} },
  });
  if (r.status !== 200 || !r.data.id) fail("Razorpay charge order creation", r);
  return { id: r.data.id! };
}

/** Subsequent debit on a confirmed token. Razorpay sends the pre-debit notification and debits ~25h later. */
export async function createRazorpayRecurringPayment(
  creds: RazorpayCreds,
  a: { amountMinor: number; orderId: string; customerId: string; tokenId: string; email: string; contact: string; description: string; notes?: Record<string, string> }
): Promise<{ paymentId: string | null }> {
  const r = await rzp<{ razorpay_payment_id?: string }>(creds, "/payments/create/recurring", {
    method: "POST",
    body: {
      email: a.email,
      contact: a.contact,
      amount: a.amountMinor,
      currency: "INR",
      order_id: a.orderId,
      customer_id: a.customerId,
      token: a.tokenId,
      recurring: true,
      description: a.description.slice(0, 255),
      notes: a.notes ?? {},
    },
  });
  if (r.status !== 200) fail("Razorpay recurring payment", r);
  return { paymentId: r.data.razorpay_payment_id ?? null };
}

export async function fetchRazorpayPayment(creds: RazorpayCreds, paymentId: string): Promise<{ id: string; orderId: string | null; tokenId: string | null; status: string; customerId: string | null }> {
  const r = await rzp<any>(creds, `/payments/${encodeURIComponent(paymentId)}`);
  if (r.status !== 200) fail("Razorpay payment fetch", r);
  return {
    id: String(r.data.id || paymentId),
    orderId: r.data.order_id ? String(r.data.order_id) : null,
    tokenId: r.data.token_id ? String(r.data.token_id) : null,
    status: String(r.data.status || ""),
    customerId: r.data.customer_id ? String(r.data.customer_id) : null,
  };
}

export async function fetchRazorpayToken(creds: RazorpayCreds, customerId: string, tokenId: string): Promise<{ status: string | null; maxAmount: number | null; expiredAt: number | null }> {
  const r = await rzp<any>(creds, `/customers/${encodeURIComponent(customerId)}/tokens/${encodeURIComponent(tokenId)}`);
  if (r.status !== 200) fail("Razorpay token fetch", r);
  return {
    status: r.data?.recurring_details?.status ? String(r.data.recurring_details.status) : null,
    maxAmount: typeof r.data?.max_amount === "number" ? r.data.max_amount : null,
    expiredAt: typeof r.data?.expired_at === "number" ? r.data.expired_at : null,
  };
}

/** Cancel the UPI mandate at NPCI (status becomes cancellation_initiated → cancelled). */
export async function cancelRazorpayToken(creds: RazorpayCreds, customerId: string, tokenId: string): Promise<void> {
  const r = await rzp(creds, `/customers/${encodeURIComponent(customerId)}/tokens/${encodeURIComponent(tokenId)}/cancel`, { method: "PUT" });
  if (r.status !== 200) fail("Razorpay token cancel", r);
}

function safeEqualHex(expectedHex: string, given: string): boolean {
  if (typeof given !== "string") return false;
  const a = Buffer.from(expectedHex);
  const b = Buffer.from(given);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function verifyRazorpayCheckoutSignature(keySecret: string, orderId: string, paymentId: string, signature: string): boolean {
  if (!keySecret || !orderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

export function verifyRazorpayWebhookSignature(webhookSecret: string, rawBody: string, signature: string): boolean {
  if (!webhookSecret || !signature) return false;
  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
