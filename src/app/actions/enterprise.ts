"use server";

import { db } from "@/lib/db";
import { checkPermission } from "@/lib/membership";
import { FEATURES } from "@/lib/features";
import { istMonthString } from "@/lib/fees";
import { loadBusinessReportInput } from "@/lib/business-report-data";
import { computeBusinessReport, isReportMonth } from "@/lib/business-report";
import {
  ENTERPRISE_DISABLED_ERROR,
  branchRows,
  canConsolidate,
  consolidatableOrgIds,
  effectiveBranchScope,
  summariseReport,
  totalsByCurrency,
  visibleBranchRows,
} from "@/lib/org-hierarchy";

/** Orgs are loaded a few at a time so one consolidated view cannot exhaust the connection pool. */
const ORG_CONCURRENCY = 3;

/**
 * V11 Enterprise (flag `enterprise`): one month of business numbers for every academy the signed-in person may report
 * on (ACTIVE membership with reports.view in that academy — consolidation never widens access), totals per currency,
 * and per-branch rows for the active academy when branches are on. Each view is audited in every included academy.
 */
export async function getConsolidatedReport(month: string) {
  if (!FEATURES.enterprise) return { success: false as const, error: ENTERPRISE_DISABLED_ERROR };
  const auth = await checkPermission(null);
  if (!auth.ok) return { success: false as const, error: auth.error };
  const { session } = auth;

  const memberships = await db.orgMembership.findMany({
    where: { userId: session.id, status: "ACTIVE" },
    orderBy: { joinedAt: "asc" },
    select: {
      orgId: true,
      status: true,
      role: true,
      staffRole: true,
      permissions: true,
      org: { select: { name: true, city: true, currency: true, timezone: true } },
    },
  });
  const active = memberships.find((m) => m.orgId === session.orgId);
  if (!active || !canConsolidate(active)) {
    return { success: false as const, error: "You need permission to view reports in this academy." };
  }
  const current = istMonthString(new Date(), active.org.timezone || "Asia/Kolkata");
  if (!isReportMonth(month, current)) return { success: false as const, error: "Pick a month up to the current one." };

  // Active academy first, then the rest in join order.
  const ordered = [active, ...memberships.filter((m) => m.orgId !== session.orgId)];
  const { orgIds, skipped, truncated } = consolidatableOrgIds(ordered);
  const byOrg = new Map(ordered.map((m) => [m.orgId, m]));

  const rows: { orgId: string; name: string; city: string; currency: string; isActive: boolean; summary: ReturnType<typeof summariseReport> }[] = [];
  let branches = null as ReturnType<typeof branchRows> | null; // cast: assigned inside the async loop below

  for (let i = 0; i < orgIds.length; i += ORG_CONCURRENCY) {
    const chunk = orgIds.slice(i, i + ORG_CONCURRENCY);
    const loaded = await Promise.all(
      chunk.map(async (orgId) => {
        const isActive = orgId === session.orgId;
        const { input, branchByBatch } = await loadBusinessReportInput(orgId, month, { withBranches: isActive && FEATURES.branches });
        const report = computeBusinessReport(input);
        if (isActive && FEATURES.branches) {
          const list = await db.branch.findMany({ where: { orgId }, select: { id: true, name: true }, orderBy: { name: "asc" } });
          // Branch scopes are designed but not stored yet (MemberBranchScope): everyone with reports.view sees all branches.
          branches = visibleBranchRows(branchRows(report, branchByBatch, list), effectiveBranchScope(active.role, []));
        }
        const m = byOrg.get(orgId)!;
        return { orgId, name: m.org.name, city: m.org.city, currency: m.org.currency || "INR", isActive, summary: summariseReport(report) };
      }),
    );
    rows.push(...loaded);
  }

  await db.auditLog
    .createMany({
      data: rows.map((r) => ({
        userId: session.id,
        orgId: r.orgId,
        action: "ENTERPRISE_REPORT_VIEWED",
        details: JSON.stringify({ month, orgCount: rows.length, viewedFromOrgId: session.orgId }),
      })),
    })
    .catch(() => {});

  return {
    success: true as const,
    month,
    orgs: rows,
    totalsByCurrency: totalsByCurrency(rows.map((r) => ({ currency: r.currency, summary: r.summary }))),
    branches,
    skipped,
    truncated,
  };
}
