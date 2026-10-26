"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { GROWTH_TOOLS_DISABLED_ERROR } from "@/lib/referral-rules";
import { createReferralRecord } from "@/lib/referral-server";

export async function getReferrals() {
  if (!FEATURES.growthTools) return [];
    const session = await requireAuth(['ADMIN', 'PARENT']);
  try {
    // Referral has no orgId column — scope via the referrer (parents only see their own)
    const referrals = await db.referral.findMany({
      where: session.role === "PARENT"
        ? { referrerId: session.id }
        : { referrer: { orgId: session.orgId || "__no_org__" } },
      include: {
        referrer: {
          select: {
            name: true,
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });
    return referrals;
  } catch (error) {
    console.error("Failed to fetch referrals:", error);
    return [];
  }
}

export async function createReferral(referrerId: string, refereePhone: string) {
  if (!FEATURES.growthTools) return { success: false, error: GROWTH_TOOLS_DISABLED_ERROR };
  const session = await requireAuth(['ADMIN', 'PARENT']);
  try {
    const res = await createReferralRecord(session, referrerId, refereePhone);
    if (res.success) revalidatePath("/org");
    return res;
  } catch (error) {
    console.error("Failed to create referral:", error);
    return { success: false, error: "Failed to create referral" };
  }
}
