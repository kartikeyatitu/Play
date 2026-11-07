// Cron: expires event waitlist offers older than 24 h and offers each place to the next family.
// Does nothing while FEATURES.eventWaitlist is off (the EventWaitlist table is never queried).
// Schedule (add to vercel.json when the flag goes on), e.g. hourly: { "path": "/api/cron/event-waitlist", "schedule": "0 * * * *" }
//
// Auth: Bearer <CRON_SECRET>. Fails CLOSED if CRON_SECRET isn't configured.

import { NextRequest, NextResponse } from "next/server";
import { processExpiredEventOffers } from "@/lib/events/waitlist-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("event-waitlist cron: CRON_SECRET is not set — refusing to run.");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processExpiredEventOffers(new Date());
  return NextResponse.json({ ok: true, ...result });
}
