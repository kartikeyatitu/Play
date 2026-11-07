// Cron: creates DRAFT SubscriptionInvoice rows (TRIQ's own plan) for the IST month that just ended.
// Never charges, issues or sends anything. No-op while FEATURES.triqBilling is off.
// Not scheduled in vercel.json yet (suggested: 1st of each month, after monthly-fees).
//
// Auth: Bearer <CRON_SECRET>. Fails CLOSED if CRON_SECRET isn't configured.

import { NextRequest, NextResponse } from "next/server";
import { previousIstMonth } from "@/lib/billing/periods";
import { createDraftInvoicesForMonth } from "@/lib/billing/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("triq-billing cron: CRON_SECRET is not set — refusing to run.");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const summary = await createDraftInvoicesForMonth(previousIstMonth(now), now);
  return NextResponse.json({ ok: true, ...summary });
}
