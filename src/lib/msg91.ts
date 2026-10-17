// MSG91 SendOTP v5 request builder + response check. Pure (no fetch, no env) so it can be unit-checked
// (scripts/check-phone.ts). The sender lives in src/app/actions/auth.ts.

export const MSG91_OTP_ENDPOINT = "https://control.msg91.com/api/v5/otp";

export interface Msg91OtpRequest {
  url: string;
  init: { method: "POST"; headers: Record<string, string>; body: string };
}

/**
 * POST https://control.msg91.com/api/v5/otp?template_id=…&mobile=91XXXXXXXXXX&otp=…&otp_expiry=5&realTimeResponse=1
 * with the authkey as an HTTP header. It must never go in the query string: URLs end up in proxy,
 * CDN and error logs.
 */
export function buildMsg91OtpRequest(a: {
  authKey: string;
  templateId: string;
  /** Country code + number, no "+" (see toMsg91Mobile). */
  mobile: string;
  otp: string;
  expiryMinutes?: number;
}): Msg91OtpRequest {
  const qs = new URLSearchParams({
    template_id: a.templateId,
    mobile: a.mobile,
    otp: a.otp,
    otp_expiry: String(a.expiryMinutes ?? 5),
    realTimeResponse: "1",
  });
  return {
    url: `${MSG91_OTP_ENDPOINT}?${qs.toString()}`,
    init: {
      method: "POST",
      headers: { authkey: a.authKey, accept: "application/json", "content-type": "application/json" },
      body: "{}",
    },
  };
}

/**
 * MSG91 can answer HTTP 200 with an error payload ({ type: "error", message, code }).
 * Success = 2xx, type isn't "error", and no error-looking `code` (numeric ≥ 400, or an "error"-ish string).
 */
export function isMsg91Success(status: number, body: unknown): boolean {
  if (status < 200 || status >= 300) return false;
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (String(b.type ?? "").toLowerCase() === "error") return false;
  const code = b.code;
  if (code !== undefined && code !== null && code !== "") {
    const s = String(code).trim();
    if (/^\d+$/.test(s) ? Number(s) >= 400 : /err|fail|invalid/i.test(s)) return false;
  }
  return true;
}

/** Short, secret-free description of a failed MSG91 response for logs. */
export function describeMsg91Failure(status: number, body: unknown, authKey: string): string {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const parts = [`HTTP ${status}`];
  if (b.code !== undefined) parts.push(`code ${String(b.code).slice(0, 20)}`);
  if (typeof b.message === "string") parts.push(b.message.slice(0, 160));
  const text = `MSG91 send failed (${parts.join(", ")})`;
  return authKey ? text.split(authKey).join("***") : text;
}
