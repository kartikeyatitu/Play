"use server";

// Parent premium placeholder (ParentPlan, flag FEATURES.parentPremium). Records interest only:
// no price, no payment, no premium features are unlocked. Exports only async functions.
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { getSession } from "@/lib/auth";
import { rateLimitDb } from "@/lib/rate-limit";

const OFF_ERROR = "Parent premium is not available yet.";
/** Status written when a parent asks to be told when premium launches. */
const INTERESTED = "INTERESTED";

export interface ParentPlanView {
  id: string;
  status: string;
  startedAt: string;
  endsAt: string | null;
}

export async function getMyParentPlan(): Promise<{ ok: true; plan: ParentPlanView | null } | { ok: false; error: string }> {
  if (!FEATURES.parentPremium) return { ok: true, plan: null };
  const session = await getSession();
  if (!session?.id) return { ok: false, error: "Please sign in again." };
  const p = await db.parentPlan.findFirst({ where: { userId: session.id }, orderBy: { createdAt: "desc" } });
  return {
    ok: true,
    plan: p ? { id: p.id, status: p.status, startedAt: p.startedAt.toISOString(), endsAt: p.endsAt?.toISOString() ?? null } : null,
  };
}

/** "Notify me": one INTERESTED row per parent, price 0. Calling again is a no-op. */
export async function registerParentPremiumInterest(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!FEATURES.parentPremium) return { ok: false, error: OFF_ERROR };
  const session = await getSession();
  if (!session?.id) return { ok: false, error: "Please sign in again." };
  if (session.role !== "PARENT") return { ok: false, error: "Parent premium is for parent accounts." };
  const rl = await rateLimitDb(`parent-plan:${session.id}`, 10, 60 * 60_000);
  if (!rl.allowed) return { ok: false, error: "Please try again later." };
  const existing = await db.parentPlan.findFirst({ where: { userId: session.id, status: INTERESTED }, select: { id: true } });
  if (!existing) {
    await db.parentPlan.create({ data: { userId: session.id, orgId: session.orgId ?? null, status: INTERESTED, priceMinor: 0, currency: "INR" } });
  }
  revalidatePath("/parent");
  return { ok: true };
}

export async function withdrawParentPremiumInterest(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!FEATURES.parentPremium) return { ok: false, error: OFF_ERROR };
  const session = await getSession();
  if (!session?.id) return { ok: false, error: "Please sign in again." };
  await db.parentPlan.deleteMany({ where: { userId: session.id, status: INTERESTED } });
  revalidatePath("/parent");
  return { ok: true };
}
