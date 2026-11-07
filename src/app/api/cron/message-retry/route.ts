// Cron: retries MessageDelivery rows whose nextAttemptAt has passed (exponential backoff, max 5 attempts).
// No-op while FEATURES.messageDelivery is off. Not scheduled in vercel.json yet (add it when the flag goes on).
//
// Auth: Bearer <CRON_SECRET>. Fails CLOSED if CRON_SECRET isn't configured.

import { NextRequest, NextResponse } from "next/server";
import { retryDueDeliveries } from "@/lib/messaging/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("message-retry cron: CRON_SECRET is not set — refusing to run.");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await retryDueDeliveries(new Date());
  return NextResponse.json({ ok: true, ...summary });
}
