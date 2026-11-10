// Signed, expiring "pay your fees" links for WhatsApp reminders. WhatsApp only makes https links
// tappable (not upi://), so the reminder points to /pay/<token>, which opens the UPI app.
// The token names one family in one academy and expires; it carries no names or amounts.
import crypto from "crypto";

const TTL_DAYS = 30;

function secret(): string {
  const s = process.env.SESSION_SECRET || process.env.HMAC_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET or HMAC_SECRET must be configured");
  return "dev-only-secret-do-not-use-in-prod";
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (payload: string) => crypto.createHmac("sha256", secret()).update(`pay:${payload}`).digest("base64url").slice(0, 32);

export function signPayToken(orgId: string, familyId: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + TTL_DAYS * 86_400;
  const payload = b64(JSON.stringify({ o: orgId, f: familyId, e: exp }));
  return `${payload}.${sign(payload)}`;
}

export function verifyPayToken(token: string, now = Date.now()): { orgId: string; familyId: string } | null {
  if (typeof token !== "string" || token.length > 400) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof d.o !== "string" || typeof d.f !== "string" || typeof d.e !== "number") return null;
    if (d.e * 1000 < now) return null;
    return { orgId: d.o, familyId: d.f };
  } catch {
    return null;
  }
}
