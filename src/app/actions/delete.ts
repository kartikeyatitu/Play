
"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { isOrgOwner } from "@/lib/membership";
import { isMissingTableError } from "@/lib/schema-pending";

/** Tables added by flag-gated verticals may not exist yet in a database; treat that as nothing to delete. */
async function ifTableExists(run: () => Promise<{ count: number }>): Promise<{ count: number }> {
  try {
    return await run();
  } catch (e) {
    if (isMissingTableError(e)) return { count: 0 };
    throw e;
  }
}
import { FEATURES } from "@/lib/features";

/**
 * Nuclear "delete everything in my academy" — reserved for owners who want to
 * start over or test the full lifecycle. There's no undo.
 *
 * The 20+ deletes used to run as independent statements; a crash halfway through
 * left the academy half-deleted with no record of what happened. We now:
 *  - log the intent LOUDLY to the server log before any delete (Vercel captures it)
 *  - count rows removed per table so a partial run tells you where it stopped
 *  - delete the audit log LAST (previously first — so the "I just nuked everything"
 *    event itself was being erased before the deletion completed)
 */
export async function deleteAllData() {
  const session = await requireAuth(["ADMIN"]);
  if (!session.orgId) {
    return { success: false, message: "No organization found" };
  }
  if (!(await isOrgOwner(session.id, session.orgId))) {
    return { success: false, message: "Only the academy owner can delete academy data." };
  }
  const oId = session.orgId;

  // Loud, structured log so the Vercel log stream shows exactly what happened.
  const startedAt = new Date().toISOString();
  console.log(
    `[delete] 🚨 deleteAllData START orgId=${oId} actorUserId=${session.id} at=${startedAt}`,
  );

  // Order: everything whose FKs point at the academy before the academy row itself.
  // auditLog deliberately LAST so the record of the deletion survives through most of it.
  const steps: Array<[string, () => Promise<{ count: number }>]> = [
    // V5 Careers tables exist only once prisma/sql/2026-10-26_careers.sql is applied, which is
    // required before the flag is turned on — so only touch them when the flag is on.
    ...(FEATURES.careers
      ? ([
          ["jobApplicationEvent", () => db.jobApplicationEvent.deleteMany({ where: { orgId: oId } })],
          ["jobApplication",      () => db.jobApplication.deleteMany({ where: { orgId: oId } })],
          ["jobListing",          () => db.jobListing.deleteMany({ where: { orgId: oId } })],
        ] as Array<[string, () => Promise<{ count: number }>]>)
      : []),
    ["galleryPhoto",    () => db.galleryPhoto.deleteMany({ where: { orgId: oId } })],
    ["rSVP",            () => db.rSVP.deleteMany({ where: { orgId: oId } })],
    ["attendance",      () => db.attendance.deleteMany({ where: { session: { orgId: oId } } })],
    ["session",         () => db.session.deleteMany({ where: { orgId: oId } })],
    ["skillReport",     () => db.skillReport.deleteMany({ where: { orgId: oId } })],
    // V1 GST invoices (flag gstInvoices, 2026-10-26_gst_invoices.sql). Note: GST law requires keeping tax invoices
    // for years — owners deleting a GST-registered academy should export them first.
    ...(FEATURES.gstInvoices
      ? ([
          ["taxInvoice",         () => ifTableExists(() => db.taxInvoice.deleteMany({ where: { orgId: oId } }))],
          ["taxDocumentCounter", () => ifTableExists(() => db.taxDocumentCounter.deleteMany({ where: { orgId: oId } }))],
          ["orgTaxProfile",      () => ifTableExists(() => db.orgTaxProfile.deleteMany({ where: { orgId: oId } }))],
        ] as Array<[string, () => Promise<{ count: number }>]>)
      : []),
    ["feeRecord",       () => db.feeRecord.deleteMany({ where: { orgId: oId } })],
    // V8 Commerce tables exist only once 2026-10-26_store_orders.sql is applied (flag on).
    ...(FEATURES.marketplace
      ? ([
          ["storeOrderEvent",  () => db.storeOrderEvent.deleteMany({ where: { orgId: oId } })],
          ["storeOrderDetail", () => db.storeOrderDetail.deleteMany({ where: { orgId: oId } })],
        ] as Array<[string, () => Promise<{ count: number }>]>)
      : []),
    ["order",           () => db.order.deleteMany({ where: { orgId: oId } })],
    ["message",         () => db.message.deleteMany({ where: { orgId: oId } })],
    ["media",           () => db.media.deleteMany({ where: { orgId: oId } })],
    ["booking",         () => db.booking.deleteMany({ where: { batch: { orgId: oId } } })],
    ["incident",        () => db.incident.deleteMany({ where: { orgId: oId } })],
    ["feedback",        () => db.feedback.deleteMany({ where: { orgId: oId } })],
    ["referral",        () => db.referral.deleteMany({ where: { referrer: { orgId: oId } } })],
    ["batchEnrollment", () => db.batchEnrollment.deleteMany({ where: { batch: { orgId: oId } } })],
    ["event",           () => db.event.deleteMany({ where: { orgId: oId } })],
    // TRIQ Play tables exist only once prisma/sql/2026-10-26_competitions.sql is applied (flag `events`).
    ...(FEATURES.events
      ? ([
          ["fixture",          () => db.fixture.deleteMany({ where: { orgId: oId } })],
          ["competitionEntry", () => db.competitionEntry.deleteMany({ where: { orgId: oId } })],
          ["competition",      () => db.competition.deleteMany({ where: { orgId: oId } })],
        ] as Array<[string, () => Promise<{ count: number }>]>)
      : []),
    ["trialBooking",    () => db.trialBooking.deleteMany({ where: { batch: { orgId: oId } } })],
    ["waitlist",        () => db.waitlist.deleteMany({ where: { orgId: oId } })],
    // V2 Athlete (flag-gated tables; see prisma/sql/2026-10-26_athlete_vertical.sql)
    ["opportunityApplicationEvent", () => ifTableExists(() => db.opportunityApplicationEvent.deleteMany({ where: { orgId: oId } }))],
    ["opportunityApplication",      () => ifTableExists(() => db.opportunityApplication.deleteMany({ where: { orgId: oId } }))],
    ["opportunity",                 () => ifTableExists(() => db.opportunity.deleteMany({ where: { orgId: oId } }))],
    ["athleteAchievement",          () => ifTableExists(() => db.athleteAchievement.deleteMany({ where: { orgId: oId } }))],
    ["athleteGoal",                 () => ifTableExists(() => db.athleteGoal.deleteMany({ where: { orgId: oId } }))],
    // V10 Education (flag-gated tables; see prisma/sql/2026-10-26_education.sql)
    ["participationRecord",         () => ifTableExists(() => db.participationRecord.deleteMany({ where: { orgId: oId } }))],
    ["programTeam",                 () => ifTableExists(() => db.programTeam.deleteMany({ where: { orgId: oId } }))],
    ["sportsProgram",               () => ifTableExists(() => db.sportsProgram.deleteMany({ where: { orgId: oId } }))],
    ["institutionProfile",          () => ifTableExists(() => db.institutionProfile.deleteMany({ where: { orgId: oId } }))],
    ["student",         () => db.student.deleteMany({ where: { orgId: oId } })],
    // Flag-gated tables: only touched when their feature is on (the tables may not exist in production yet).
    ...(FEATURES.branches
      ? ([
          ["batchBranch", () => db.batchBranch.deleteMany({ where: { orgId: oId } })],
        ] as Array<[string, () => Promise<{ count: number }>]>)
      : []),
    ["batch",           () => db.batch.deleteMany({ where: { orgId: oId } })],
    ...(FEATURES.branches
      ? ([["branch", () => db.branch.deleteMany({ where: { orgId: oId } })]] as Array<[string, () => Promise<{ count: number }>]>)
      : []),
    ["product",         () => db.product.deleteMany({ where: { orgId: oId } })],
    ["announcement",    () => db.announcement.deleteMany({ where: { orgId: oId } })],
    // TRIQ Spaces history table exists only once prisma/sql/2026-10-26_turf_booking_events.sql is applied (flag `spacesOps`).
    ...(FEATURES.spacesOps
      ? ([["turfBookingEvent", () => db.turfBookingEvent.deleteMany({ where: { orgId: oId } })]] as Array<[string, () => Promise<{ count: number }>]>)
      : []),
    ["facility",        () => db.facility.deleteMany({ where: { orgId: oId } })],
    ["equipment",       () => db.equipment.deleteMany({ where: { orgId: oId } })],
    ["coupon",          () => db.coupon.deleteMany({ where: { orgId: oId } })],
    ["transportRoute",  () => db.transportRoute.deleteMany({ where: { orgId: oId } })],
    ["feePlan",         () => db.feePlan.deleteMany({ where: { orgId: oId } })],
    // Non-admin users: skip anyone still linked to ANOTHER academy, since Student.parent cascades.
    ["user", () =>
      db.user.deleteMany({
        where: {
          orgId: oId,
          role: { not: "ADMIN" },
          children: { none: { orgId: { not: oId } } },
          batches: { none: { orgId: { not: oId } } },
        },
      }),
    ],
    // Audit log LAST so most of the deletion stays attributable.
    ["auditLog", () => db.auditLog.deleteMany({ where: { orgId: oId } })],
  ];

  const results: Record<string, number> = {};
  for (const [table, run] of steps) {
    try {
      const { count } = await run();
      results[table] = count;
    } catch (e: any) {
      console.error(
        `[delete] ❌ step=${table} failed orgId=${oId} actorUserId=${session.id} err=${e?.message || e}`,
      );
      console.error(`[delete] partial results so far:`, results);
      return {
        success: false,
        message: `Delete failed at step "${table}": ${e?.message || "unknown error"}. See server logs for partial results.`,
      };
    }
  }

  console.log(
    `[delete] ✅ deleteAllData DONE orgId=${oId} actorUserId=${session.id} startedAt=${startedAt} results=${JSON.stringify(results)}`,
  );

  revalidatePath("/org");
  revalidatePath("/parent");
  revalidatePath("/coach");
  return { success: true, message: "All data deleted. You can re-seed now.", results };
}
