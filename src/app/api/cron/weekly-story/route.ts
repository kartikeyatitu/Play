// Vercel Cron: Sunday 18:00 IST (12:30 UTC). Sends each family a WhatsApp link to their child's week.
// Auth: Bearer <CRON_SECRET>. Fails CLOSED if CRON_SECRET isn't configured.
import { NextRequest, NextResponse } from "next/server";
import { sendWeeklyStories } from "@/lib/story/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const summary = await sendWeeklyStories(new Date());
  return NextResponse.json({ ok: true, ...summary });
}
