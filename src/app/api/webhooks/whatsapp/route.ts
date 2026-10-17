import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * WhatsApp Cloud API webhook.
 * Meta App → WhatsApp → Configuration → Callback URL: https://<your-domain>/api/webhooks/whatsapp
 *   Verify token: WHATSAPP_WEBHOOK_VERIFY_TOKEN. Subscribe to the "messages" field.
 * POSTs are signed with the Meta App Secret (WHATSAPP_APP_SECRET) in X-Hub-Signature-256.
 *
 * For now this only records delivery status counts (no phone numbers, no message text) and
 * answers 200 quickly so Meta doesn't retry. There is no auth middleware in this app to exclude it from.
 */

/** Meta's subscription handshake. */
export async function GET(req: NextRequest) {
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  const p = req.nextUrl.searchParams;
  const mode = p.get("hub.mode");
  const token = p.get("hub.verify_token") || "";
  const challenge = p.get("hub.challenge") || "";

  if (!verifyToken) return new NextResponse("Webhook not configured", { status: 503 });
  if (mode === "subscribe" && safeEqual(token, verifyToken) && challenge) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const rawBody = await req.text();
  // Fail closed: without the secret we can't tell Meta from anyone else.
  if (!appSecret || !verifySignature(appSecret, rawBody, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const statusCounts: Record<string, number> = {};
    const errorCodes = new Set<string>();
    let inbound = 0;
    for (const entry of Array.isArray(body?.entry) ? body.entry : []) {
      for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
        const value = change?.value;
        for (const s of Array.isArray(value?.statuses) ? value.statuses : []) {
          const st = typeof s?.status === "string" ? s.status.slice(0, 20) : "unknown";
          statusCounts[st] = (statusCounts[st] || 0) + 1;
          for (const err of Array.isArray(s?.errors) ? s.errors : []) {
            if (err?.code !== undefined) errorCodes.add(String(err.code).slice(0, 10));
          }
        }
        if (Array.isArray(value?.messages)) inbound += value.messages.length;
      }
    }
    if (Object.keys(statusCounts).length || inbound) {
      console.log(
        "[whatsapp:webhook]",
        JSON.stringify({ statuses: statusCounts, errorCodes: [...errorCodes], inbound }),
      );
    }
  } catch {
    // Logging must never make Meta retry.
  }
  return NextResponse.json({ status: "ok" });
}

function verifySignature(secret: string, rawBody: string, header: string | null): boolean {
  if (!header || !header.startsWith("sha256=")) return false;
  const given = header.slice("sha256=".length).trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(given)) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(given, "hex"));
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}
