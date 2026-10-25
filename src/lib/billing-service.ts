import { db } from "@/lib/db";
import { canonicalPlan, FREE_PLAN, PLAN_LIMITS, type PlanId } from "@/lib/pricing";

export interface QuotaStatus {
  allowed: boolean;
  plan: PlanId;
  count: number;
  limit: number;
  isOverLimit: boolean;
  gracePeriodActive: boolean;
  gracePeriodDaysRemaining: number | null;
  error?: string;
  warning?: string;
}

/**
 * Checks the academy's current active student count against their Triq plan.
 *
 * Plan resolution order (first non-null wins):
 *   1. Subscription.plan        (set by billing automation)
 *   2. Organization.plan        (set at signup; legacy "FREE_TRIAL" normalised to "free")
 *   3. Default                  → "free"
 *
 * Default Free tier: 30 active students with a 14-day grace period after they
 * hit the ceiling.
 */
export async function checkStudentQuota(orgId: string): Promise<QuotaStatus> {
  const [sub, org, currentCount] = await Promise.all([
    db.subscription.findUnique({ where: { orgId } }),
    db.organization.findUnique({ where: { id: orgId }, select: { plan: true } }),
    db.student.count({ where: { orgId } }),
  ]);

  const plan: PlanId = canonicalPlan(sub?.plan ?? org?.plan ?? "free");
  const status = sub?.status || "ACTIVE";
  const limit = sub?.maxStudents || PLAN_LIMITS[plan] || FREE_PLAN.maxStudents;

  // Paid tiers (anything above "free") get the configured ceiling with no grace period.
  if (status === "ACTIVE" && plan !== "free") {
    const isOver = currentCount >= limit;
    return {
      allowed: !isOver,
      plan,
      count: currentCount,
      limit,
      isOverLimit: isOver,
      gracePeriodActive: false,
      gracePeriodDaysRemaining: null,
      error: isOver ? `Plan limit of ${limit} students reached on ${plan} tier.` : undefined,
    };
  }

  // Free tier: 30 students, then 14-day grace period.
  if (currentCount < limit) {
    return {
      allowed: true,
      plan: "free",
      count: currentCount,
      limit,
      isOverLimit: false,
      gracePeriodActive: false,
      gracePeriodDaysRemaining: null,
    };
  }

  // At or over the free ceiling → trigger grace period if it hasn't started yet.
  const now = new Date();
  let graceEndsAt = sub?.gracePeriodEndsAt;

  if (!graceEndsAt) {
    graceEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    await db.subscription.upsert({
      where: { orgId },
      create: {
        orgId,
        plan: "free", // canonical, lower-case
        status: "ACTIVE",
        maxStudents: FREE_PLAN.maxStudents,
        gracePeriodEndsAt: graceEndsAt,
      },
      update: { gracePeriodEndsAt: graceEndsAt },
    });
  }

  const msRemaining = graceEndsAt.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

  if (msRemaining > 0) {
    return {
      allowed: true,
      plan: "free",
      count: currentCount,
      limit,
      isOverLimit: true,
      gracePeriodActive: true,
      gracePeriodDaysRemaining: daysRemaining,
      warning: `You have reached the free limit of ${limit} students. 14-day grace period active (${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining) to upgrade to Growth.`,
    };
  }

  return {
    allowed: false,
    plan: "free",
    count: currentCount,
    limit,
    isOverLimit: true,
    gracePeriodActive: false,
    gracePeriodDaysRemaining: 0,
    error: `Free limit of ${limit} students exceeded and 14-day grace period has expired. Upgrade to Growth to add more students.`,
  };
}

/**
 * Get full subscription summary for an academy
 */
export async function getSubscriptionDetails(orgId: string) {
  const [sub, quota] = await Promise.all([
    db.subscription.findUnique({
      where: { orgId },
      include: {
        invoices: {
          orderBy: { createdAt: "desc" },
          take: 12,
        },
      },
    }),
    checkStudentQuota(orgId),
  ]);

  return {
    subscription: sub,
    quota,
  };
}
