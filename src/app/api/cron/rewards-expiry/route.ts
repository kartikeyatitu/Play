// Vercel Cron: writes negative EXPIRY rows for rewards points earned more than 12 months ago (spec §5, §8).
// Idempotent (one idempotency key per expired lot), so running it twice or late is safe.
// Does nothing while FEATURES.rewards is off (the tables don't exist yet).
//
// Schedule: not added to vercel.json yet (outside this feature's files). Suggested daily, e.g.
//   { "path": "/api/cron/rewards-expiry", "schedule": "30 21 * * *" }   (03:00 IST)
//
// Auth: Bearer <CRON_SECRET>. Fails CLOSED if CRON_SECRET isn't configured.

import { NextRequest, NextResponse } from "next/server";
import { FEATURES } from "@/lib/features";
import { runExpiryAll } from "@/lib/rewards/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("rewards-expiry cron: CRON_SECRET is not set — refusing to run.");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!FEATURES.rewards) return NextResponse.json({ ok: true, skipped: "rewards feature is off" });

  const result = await runExpiryAll(new Date());
  return NextResponse.json({ ok: true, ...result });
}
