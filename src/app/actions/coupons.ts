"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { checkPermission } from "@/lib/membership";
import { FEATURES } from "@/lib/features";
import { GROWTH_TOOLS_DISABLED_ERROR } from "@/lib/referral-rules";

// Coupons can be created and listed but are not yet redeemable anywhere (no checkout applies them), so the whole
// feature sits behind `growthTools`. Coupon.code is unique across ALL academies (schema), hence the generic message.
export async function createCoupon(code: string, discount: number, type: string) {
  if (!FEATURES.growthTools) return { success: false, error: GROWTH_TOOLS_DISABLED_ERROR };
  const auth = await checkPermission("fees.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  try {
    const cleanCode = String(code ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,32}$/.test(cleanCode)) return { success: false, error: "Code must be 3-32 letters, numbers, - or _" };
    if (type !== "FLAT" && type !== "PERCENT") return { success: false, error: "Invalid coupon type" };
    if (!Number.isFinite(discount) || discount <= 0 || (type === "PERCENT" && discount > 100)) {
      return { success: false, error: "Invalid discount value" };
    }
    const taken = await db.coupon.findUnique({ where: { code: cleanCode }, select: { id: true } });
    if (taken) return { success: false, error: "That code isn't available. Try a different one." };
    const coupon = await db.coupon.create({ data: { orgId: session.orgId, 
        code: cleanCode,
        discount,
        type,
      },
    });
    await db.auditLog
      .create({ data: { userId: session.id, orgId: session.orgId, action: "COUPON_CREATED", details: JSON.stringify({ couponId: coupon.id, code: cleanCode, type, discount }) } })
      .catch(() => {});
    revalidatePath("/org/coupons");
    return { success: true, data: coupon };
  } catch (error) {
    console.error("Error creating coupon:", error);
    return { success: false, error: "Failed to create coupon. Try a different code." };
  }
}

export async function getCoupons() {
  if (!FEATURES.growthTools) return { success: false, error: GROWTH_TOOLS_DISABLED_ERROR, data: [] };
  const auth = await checkPermission("fees.manage");
  if (!auth.ok) return { success: false, error: auth.error, data: [] };
  const { session } = auth;
  try {
    const coupons = await db.coupon.findMany({
      where: { orgId: session.orgId },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: coupons };
  } catch (error) {
    console.error("Error fetching coupons:", error);
    return { success: false, error: "Failed to fetch coupons", data: [] };
  }
}
