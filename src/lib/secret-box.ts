import crypto from "crypto";

/**
 * Small AES-256-GCM "secret box" for storing third-party credentials (e.g. an academy's Razorpay
 * key secret) in Postgres. Format: v1.<iv b64url>.<tag b64url>.<ciphertext b64url>
 *
 * Key: PAYMENTS_ENC_KEY (preferred, any long random string). Falls back to HMAC_SECRET / SESSION_SECRET
 * so it works without new config, but rotating that secret would make stored credentials unreadable
 * (academies would simply need to reconnect). Server-only: never import from client components.
 */
function key(): Buffer {
  const material = process.env.PAYMENTS_ENC_KEY || process.env.HMAC_SECRET || process.env.SESSION_SECRET;
  if (!material) throw new Error("No encryption key configured (PAYMENTS_ENC_KEY)");
  return crypto.createHash("sha256").update(`triq-secret-box:v1:${material}`).digest();
}

export function sealSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(".");
}

export function openSecret(sealed: string | null | undefined): string | null {
  if (!sealed) return null;
  try {
    const [v, iv, tag, enc] = sealed.split(".");
    if (v !== "v1" || !iv || !tag || !enc) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(enc, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
