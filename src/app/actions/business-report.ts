"use server";

import { db } from "@/lib/db";
import { checkPermission } from "@/lib/membership";
import { FEATURES } from "@/lib/features";
import { istMonthString } from "@/lib/fees";
import { loadBusinessReportInput } from "@/lib/business-report-data";
import { BUSINESS_REPORT_DISABLED_ERROR, computeBusinessReport, isReportMonth, type BusinessReport } from "@/lib/business-report";

/** V1 Business (flag `businessReport`): revenue, outstanding, attendance and utilisation for one month. */
export async function getBusinessReport(
  month: string,
): Promise<{ success: true; report: BusinessReport; currency: string } | { success: false; error: string }> {
  if (!FEATURES.businessReport) return { success: false, error: BUSINESS_REPORT_DISABLED_ERROR };
  const auth = await checkPermission("reports.view");
  if (!auth.ok) return { success: false, error: auth.error };
  const orgId = auth.session.orgId;

  const org = await db.organization.findUnique({ where: { id: orgId }, select: { currency: true, timezone: true } });
  const current = istMonthString(new Date(), org?.timezone || "Asia/Kolkata");
  if (!isReportMonth(month, current)) return { success: false, error: "Pick a month up to the current one." };

  const { input } = await loadBusinessReportInput(orgId, month);
  return { success: true, report: computeBusinessReport(input), currency: org?.currency || "INR" };
}
