"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth";

// Resolve the referrer: parents can only act as themselves; admins may act for a parent in their academy.
async function resolveReferrerId(session: { id: string; role: string; orgId: string | null }, referrerId: string): Promise<string | null> {
  if (session.role === "PARENT") return session.id;
  if (!referrerId) return null;
  const user = await db.user.findFirst({ where: { id: referrerId, orgId: session.orgId || "__no_org__" }, select: { id: true } });
  return user?.id ?? null;
}

// PARENT added: called from the parent dashboard (ReferralWidget).
export async function createReferral(referrerId: string, refereePhone: string) {
    const session = await requireAuth(['ADMIN', 'PARENT']);
  const id = await resolveReferrerId(session, referrerId);
  if (!id) throw new Error("Referrer not found");
  await db.referral.create({
    data: {
      referrerId: id,
      refereePhone,
    }
  })
  revalidatePath("/") // revalidate wherever it's used
}

export async function getReferralsCount(referrerId: string) {
    const session = await requireAuth(['ADMIN', 'PARENT']);
  const id = await resolveReferrerId(session, referrerId);
  if (!id) return 0;
  return db.referral.count({
    where: {
      referrerId: id,
      status: "CONVERTED"
    }
  })
}
