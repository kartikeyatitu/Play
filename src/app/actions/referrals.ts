"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

export async function getReferrals() {
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
    const session = await requireAuth(['ADMIN', 'PARENT']);
  try {
    // Never trust referrerId: parents refer as themselves; admins may record for a user in their academy
    let id: string | null = null;
    if (session.role === "PARENT") {
      id = session.id;
    } else if (referrerId) {
      const user = await db.user.findFirst({ where: { id: referrerId, orgId: session.orgId || "__no_org__" }, select: { id: true } });
      id = user?.id ?? null;
    }
    if (!id) return { success: false, error: "Referrer not found" };

    const referral = await db.referral.create({
      data: {
        referrerId: id,
        refereePhone,
        status: "PENDING",
        discount: 500,
      }
    });
    revalidatePath("/org");
    return { success: true, referral };
  } catch (error) {
    console.error("Failed to create referral:", error);
    return { success: false, error: "Failed to create referral" };
  }
}
