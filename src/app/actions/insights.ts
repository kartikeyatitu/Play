"use server";

import { checkPermission } from "@/lib/membership";
import { FEATURES } from "@/lib/features";
import { loadOwnerInsights, type OwnerInsights } from "@/lib/insights-data";

/** Owner insights: today's snapshot, fee ageing and 12-month trends. Needs reports.view. */
export async function getOwnerInsights(): Promise<{ success: true; data: OwnerInsights } | { success: false; error: string }> {
  if (!FEATURES.ownerInsights) return { success: false, error: "Insights are not enabled." };
  const auth = await checkPermission("reports.view");
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    return { success: true, data: await loadOwnerInsights(auth.session.orgId) };
  } catch (e) {
    console.error("[insights] load failed", e instanceof Error ? e.message : e);
    return { success: false, error: "Couldn't load insights. Please try again." };
  }
}
