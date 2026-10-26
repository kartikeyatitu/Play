"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { GROWTH_TOOLS_DISABLED_ERROR } from "@/lib/referral-rules";
import { createReferralRecord, resolveReferrer } from "@/lib/referral-server";

// Called from the parent dashboard (ReferralWidget). Flag `growthTools`.
export async function createReferral(referrerId: string, refereePhone: string) {
  if (!FEATURES.growthTools) return { success: false as const, error: GROWTH_TOOLS_DISABLED_ERROR };
  const session = await requireAuth(['ADMIN', 'PARENT']);
  const res = await createReferralRecord(session, referrerId, refereePhone);
  if (res.success) revalidatePath("/parent");
  return res;
}

export async function getReferralsCount(referrerId: string) {
  if (!FEATURES.growthTools) return 0;
  const session = await requireAuth(['ADMIN', 'PARENT']);
  const referrer = await resolveReferrer(session, referrerId);
  if (!referrer) return 0;
  return db.referral.count({ where: { referrerId: referrer.id, status: "CONVERTED" } })
}
