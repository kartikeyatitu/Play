import { db } from "@/lib/db";

export interface QuotaStatus {
  allowed: boolean;
  plan: string;
  count: number;
  limit: number;
  isOverLimit: boolean;
  gracePeriodActive: boolean;
  gracePeriodDaysRemaining: number | null;
  error?: string;
  warning?: string;
}

/**
 * Checks the academy's current active student count against their Triq subscription plan.
 * Default Free Tier: 30 active students with a 14-day grace period.
 */
export async function checkStudentQuota(orgId: string): Promise<QuotaStatus> {
  const [sub, currentCount] = await Promise.all([
    db.subscription.findUnique({
      where: { orgId },
    }),
    db.student.count({
      where: { orgId },
    }),
  ]);

  const plan = sub?.plan || "FREE";
  const status = sub?.status || "ACTIVE";
  const limit = sub?.maxStudents || 30;

  // Active paid plans allow up to their provisioned ceiling
  if (status === "ACTIVE" && (plan === "STARTER" || plan === "PRO" || plan === "ENTERPRISE")) {
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

  // Free Tier enforcement (30 students + 14 day grace period)
  if (currentCount < limit) {
    return {
      allowed: true,
      plan: "FREE",
      count: currentCount,
      limit,
      isOverLimit: false,
      gracePeriodActive: false,
      gracePeriodDaysRemaining: null,
    };
  }

  // Academy has reached or exceeded 30 students on free tier
  const now = new Date();
  let graceEndsAt = sub?.gracePeriodEndsAt;

  if (!graceEndsAt) {
    // Start the 14-day grace period clock
    graceEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    await db.subscription.upsert({
      where: { orgId },
      create: {
        orgId,
        plan: "FREE",
        status: "ACTIVE",
        maxStudents: 30,
        gracePeriodEndsAt: graceEndsAt,
      },
      update: {
        gracePeriodEndsAt: graceEndsAt,
      },
    });
  }

  const msRemaining = graceEndsAt.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

  if (msRemaining > 0) {
    return {
      allowed: true,
      plan: "FREE",
      count: currentCount,
      limit,
      isOverLimit: true,
      gracePeriodActive: true,
      gracePeriodDaysRemaining: daysRemaining,
      warning: `You have reached the free limit of 30 students. 14-day grace period active (${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining) to upgrade to Triq Starter.`,
    };
  }

  return {
    allowed: false,
    plan: "FREE",
    count: currentCount,
    limit,
    isOverLimit: true,
    gracePeriodActive: false,
    gracePeriodDaysRemaining: 0,
    error: "Free limit of 30 students exceeded and 14-day grace period has expired. Upgrade to Triq Starter to add more students.",
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
