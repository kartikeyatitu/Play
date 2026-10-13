"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

export async function createCoupon(code: string, discount: number, type: string) {
    const session = await requireAuth(['ADMIN']);
  try {
    if (!session.orgId) return { success: false, error: "No organization found" };
    const cleanCode = String(code ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,32}$/.test(cleanCode)) return { success: false, error: "Code must be 3-32 letters, numbers, - or _" };
    if (type !== "FLAT" && type !== "PERCENT") return { success: false, error: "Invalid coupon type" };
    if (!Number.isFinite(discount) || discount <= 0 || (type === "PERCENT" && discount > 100)) {
      return { success: false, error: "Invalid discount value" };
    }
    const coupon = await db.coupon.create({ data: { orgId: session.orgId, 
        code: cleanCode,
        discount,
        type,
      },
    });
    revalidatePath("/org/coupons");
    return { success: true, data: coupon };
  } catch (error) {
    console.error("Error creating coupon:", error);
    return { success: false, error: "Failed to create coupon or code already exists" };
  }
}

export async function getCoupons() {
    const session = await requireAuth(['ADMIN']);
  try {
    const coupons = await db.coupon.findMany({
      where: { orgId: session.orgId || "__no_org__" },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: coupons };
  } catch (error) {
    console.error("Error fetching coupons:", error);
    return { success: false, error: "Failed to fetch coupons", data: [] };
  }
}
