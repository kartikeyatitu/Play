// Vercel Cron: media retention and clean-up (flag FEATURES.media). Schedules deleteAfter for photos
// whose tagged children have all left (placeholder: + 12 months, see src/lib/media/retention.ts),
// then removes files and rows past deleteAfter, deleted assets whose file removal failed, and
// abandoned uploads. Does nothing while the flag is off.
//
// Auth: Bearer <CRON_SECRET>. Fails CLOSED if CRON_SECRET isn't configured.
// Not yet scheduled: add { "path": "/api/cron/media-purge", "schedule": "30 21 * * *" } to vercel.json.

import { NextRequest, NextResponse } from "next/server";
import { purgeMedia } from "@/lib/media/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("media-purge cron: CRON_SECRET is not set — refusing to run.");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await purgeMedia(new Date());
  return NextResponse.json({ ok: true, ...summary });
}
