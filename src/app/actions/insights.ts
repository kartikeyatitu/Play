"use server";

import { checkPermission } from "@/lib/membership";
import { FEATURES } from "@/lib/features";
import { loadOwnerInsights, type OwnerInsights } from "@/lib/insights-data";
import { loadAtRiskStudents, type AtRiskSummary } from "@/lib/risk-data";
import { loadFunnelAndCohorts, type FunnelAndCohorts } from "@/lib/funnel-data";

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


/** Students who may drop out, with reasons and an editable WhatsApp draft. Needs reports.view; WhatsApp links need students.manage. */
export async function getAtRiskStudents(): Promise<{ success: true; data: AtRiskSummary } | { success: false; error: string }> {
  if (!FEATURES.atRiskStudents) return { success: false, error: "This view is not enabled." };
  const auth = await checkPermission("reports.view");
  if (!auth.ok) return { success: false, error: auth.error };
  const contact = await checkPermission("students.manage");
  try {
    return { success: true, data: await loadAtRiskStudents(auth.session.orgId, { canContact: contact.ok }) };
  } catch (e) {
    console.error("[insights] at-risk load failed", e instanceof Error ? e.message : e);
    return { success: false, error: "Couldn't load at-risk students. Please try again." };
  }
}

/** Enquiry funnel by source (last 6 months) and new-student retention cohorts. Needs reports.view. */
export async function getFunnelAndCohorts(): Promise<{ success: true; data: FunnelAndCohorts } | { success: false; error: string }> {
  if (!FEATURES.funnelCohorts) return { success: false, error: "This view is not enabled." };
  const auth = await checkPermission("reports.view");
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    return { success: true, data: await loadFunnelAndCohorts(auth.session.orgId) };
  } catch (e) {
    console.error("[insights] funnel load failed", e instanceof Error ? e.message : e);
    return { success: false, error: "Couldn't load the funnel. Please try again." };
  }
}
