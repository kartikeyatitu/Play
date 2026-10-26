// Scheduled UPI AutoPay debits (flag upiAutopay). Creates this month's debit for every ACTIVE mandate whose fee
// record is PENDING, once per mandate per month (idempotency key). Razorpay sends the pre-debit notification and
// debits ~25h later; the fee turns PAID only via the verified payment.captured webhook.
//
// Not yet scheduled in vercel.json (Vercel config is owned by the integrator). Suggested: daily at 04:00 UTC,
// after the monthly-fees cron on the 1st. Auth: Bearer <CRON_SECRET>; fails CLOSED without it.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { createChargesForOrg } from "@/lib/autopay-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!FEATURES.upiAutopay) return NextResponse.json({ ok: true, skipped: "upiAutopay flag is off" });

  const orgs = await db.feeMandate.findMany({ where: { status: { in: ["ACTIVE", "AUTHENTICATED"] } }, distinct: ["orgId"], select: { orgId: true } });
  let submitted = 0;
  let failed = 0;
  for (const { orgId } of orgs) {
    try {
      const r = await createChargesForOrg(orgId, null);
      submitted += r.submitted;
      failed += r.failed;
    } catch (e) {
      console.error("autopay-charges cron: org failed", orgId, e instanceof Error ? e.message : e);
    }
  }
  return NextResponse.json({ ok: true, orgs: orgs.length, submitted, failed });
}
