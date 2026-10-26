// Vercel Cron: creates each active academy's PENDING fee records for the current (IST) month.
// Runs at 02:00 UTC on the 1st (07:30 IST on the 1st), per the schedule in vercel.json.
//
// Auth: Bearer <CRON_SECRET>. Fails CLOSED if CRON_SECRET isn't configured.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateMonthlyFeesForOrg } from "@/lib/monthly-fees-server";
import { istMonthString } from "@/lib/fees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed: refuse to run without the secret so this cannot be invoked anonymously.
    console.error("monthly-fees cron: CRON_SECRET is not set — refusing to run.");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const month = istMonthString();
  const orgs = await db.organization.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  let feesCreated = 0;
  for (const org of orgs) {
    try {
      const r = await generateMonthlyFeesForOrg(org.id, month);
      feesCreated += r.feesCreated;
    } catch (e) {
      console.error("monthly-fees cron: org failed", org.id, e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ ok: true, month, orgs: orgs.length, feesCreated });
}
