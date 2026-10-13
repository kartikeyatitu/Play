
"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { isOrgOwner } from "@/lib/membership";

export async function deleteAllData() {
  try {
    const session = await requireAuth(["ADMIN"]);
    if (!session.orgId) {
      return { success: false, message: "No organization found" };
    }
    if (!(await isOrgOwner(session.id, session.orgId))) {
      return { success: false, message: "Only the academy owner can delete academy data." };
    }
    const oId = session.orgId;

    // Delete in order to respect foreign key constraints
    await db.auditLog.deleteMany({ where: { orgId: oId } });
    await db.galleryPhoto.deleteMany({ where: { orgId: oId } });
    await db.rSVP.deleteMany({ where: { orgId: oId } });
    await db.attendance.deleteMany({ where: { session: { orgId: oId } } });
    await db.session.deleteMany({ where: { orgId: oId } });
    await db.skillReport.deleteMany({ where: { orgId: oId } });
    await db.feeRecord.deleteMany({ where: { orgId: oId } });
    await db.order.deleteMany({ where: { orgId: oId } });
    await db.message.deleteMany({ where: { orgId: oId } });
    await db.media.deleteMany({ where: { orgId: oId } });
    await db.booking.deleteMany({ where: { batch: { orgId: oId } } });
    await db.incident.deleteMany({ where: { orgId: oId } });
    await db.feedback.deleteMany({ where: { orgId: oId } });
    await db.referral.deleteMany({ where: { referrer: { orgId: oId } } });
    await db.batchEnrollment.deleteMany({ where: { batch: { orgId: oId } } });
    await db.event.deleteMany({ where: { orgId: oId } });
    await db.trialBooking.deleteMany({ where: { batch: { orgId: oId } } });
    await db.waitlist.deleteMany({ where: { orgId: oId } });
    await db.student.deleteMany({ where: { orgId: oId } });
    await db.batch.deleteMany({ where: { orgId: oId } });
    await db.product.deleteMany({ where: { orgId: oId } });
    await db.announcement.deleteMany({ where: { orgId: oId } });
    await db.facility.deleteMany({ where: { orgId: oId } });
    await db.equipment.deleteMany({ where: { orgId: oId } });
    // holiday doesn't belong to an org typically, or maybe it doesn't matter
    // await db.holiday.deleteMany();
    await db.coupon.deleteMany({ where: { orgId: oId } });
    await db.transportRoute.deleteMany({ where: { orgId: oId } });
    await db.feePlan.deleteMany({ where: { orgId: oId } });
    // await db.verificationToken.deleteMany();
    // Delete non-admin users
    // Tenant guard: skip anyone who still has children or coached batches in ANOTHER academy —
    // deleting them would cascade-delete that academy's students (Student.parent onDelete: Cascade).
    await db.user.deleteMany({
      where: {
        orgId: oId,
        role: { not: "ADMIN" },
        children: { none: { orgId: { not: oId } } },
        batches: { none: { orgId: { not: oId } } },
      },
    });

    revalidatePath("/org");
    revalidatePath("/parent");
    revalidatePath("/coach");
    return { success: true, message: "All data deleted. You can re-seed now." };
  } catch (e: any) {
    console.error("Delete error:", e);
    return { success: false, message: e?.message || "Delete failed" };
  }
}
