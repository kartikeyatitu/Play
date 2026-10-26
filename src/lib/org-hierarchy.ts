/**
 * V11 Enterprise — organisation hierarchy and consolidated-access rules (pure, client-safe, no DB).
 *
 * Rules (docs/specs/11-triq-enterprise.md §2, §7):
 *  1. Consolidation never grants new access: an org is included only when the viewer has an ACTIVE membership there
 *     whose effective permissions include `reports.view`.
 *  2. Money in different currencies is never summed; totals are grouped by currency and rates are recomputed from
 *     summed numerators/denominators (never averaged percentages).
 *  3. Branch scope: owners always see every branch; a member scoped to branches sees only those branches and never
 *     the "unassigned" bucket or org totals. An empty scope means the whole org.
 */
import { effectivePermissions } from "@/lib/team";
import { money, ratio, type BusinessReport } from "@/lib/business-report";

export const ENTERPRISE_DISABLED_ERROR = "Enterprise reporting is not enabled for this account yet.";
export const MAX_CONSOLIDATED_ORGS = 25;
export const UNASSIGNED_BRANCH = "__unassigned__";

export type MembershipLike = { orgId: string; status: string; role: string; staffRole?: string | null; permissions?: string | null };

export function canConsolidate(m: MembershipLike): boolean {
  return m.status === "ACTIVE" && effectivePermissions(m.role, m.staffRole ?? null, m.permissions ?? null).has("reports.view");
}

/** Which of the viewer's memberships may be consolidated (in the given order, capped). */
export function consolidatableOrgIds(memberships: readonly MembershipLike[], max = MAX_CONSOLIDATED_ORGS) {
  const allowed = memberships.filter(canConsolidate).map((m) => m.orgId);
  const unique = [...new Set(allowed)];
  return {
    orgIds: unique.slice(0, max),
    skipped: memberships.filter((m) => m.status === "ACTIVE").length - allowed.length,
    truncated: unique.length > max,
  };
}

export type OrgSummary = {
  billed: number;
  collected: number;
  outstandingMonth: number;
  outstandingAll: number;
  collectionRate: number | null;
  present: number;
  marked: number;
  attendanceRate: number | null;
  sessions: number;
  students: number;
  newStudents: number;
  trialsBooked: number;
  trialsEnrolled: number;
  courtRevenue: number;
};

export function summariseReport(r: BusinessReport): OrgSummary {
  return {
    billed: r.money.billed,
    collected: r.money.collected,
    outstandingMonth: r.money.outstandingMonth,
    outstandingAll: r.money.outstandingAll,
    collectionRate: r.money.collectionRate,
    present: r.attendance.present,
    marked: r.attendance.marked,
    attendanceRate: r.attendance.rate,
    sessions: r.attendance.sessions,
    students: r.students.active,
    newStudents: r.students.newInMonth,
    trialsBooked: r.trials.booked,
    trialsEnrolled: r.trials.enrolled,
    courtRevenue: r.facilities.revenue,
  };
}

/** Sum org summaries per currency; rates recomputed from the sums. */
export function totalsByCurrency(rows: ReadonlyArray<{ currency: string; summary: OrgSummary }>): Record<string, OrgSummary & { orgs: number }> {
  const out: Record<string, OrgSummary & { orgs: number }> = {};
  for (const { currency, summary: s } of rows) {
    const t = (out[currency] ??= {
      orgs: 0, billed: 0, collected: 0, outstandingMonth: 0, outstandingAll: 0, collectionRate: null,
      present: 0, marked: 0, attendanceRate: null, sessions: 0, students: 0, newStudents: 0,
      trialsBooked: 0, trialsEnrolled: 0, courtRevenue: 0,
    });
    t.orgs++;
    t.billed = money(t.billed + s.billed);
    t.collected = money(t.collected + s.collected);
    t.outstandingMonth = money(t.outstandingMonth + s.outstandingMonth);
    t.outstandingAll = money(t.outstandingAll + s.outstandingAll);
    t.present += s.present;
    t.marked += s.marked;
    t.sessions += s.sessions;
    t.students += s.students;
    t.newStudents += s.newStudents;
    t.trialsBooked += s.trialsBooked;
    t.trialsEnrolled += s.trialsEnrolled;
    t.courtRevenue += s.courtRevenue;
  }
  for (const t of Object.values(out)) {
    t.collectionRate = ratio(t.collected, t.billed);
    t.attendanceRate = ratio(t.present, t.marked);
  }
  return out;
}

export type BranchRow = {
  branchId: string; // UNASSIGNED_BRANCH for batches/fees without a branch
  name: string;
  batches: number;
  enrolled: number;
  sessions: number;
  present: number;
  marked: number;
  attendanceRate: number | null;
  billed: number;
  collected: number;
  outstanding: number;
};

/**
 * Per-branch rows for one org's report. Fee money that is not attributed to any batch goes to the unassigned row, so
 * the rows always add up to the org's billed/collected totals.
 */
export function branchRows(
  report: BusinessReport,
  branchByBatch: ReadonlyMap<string, string>,
  branches: ReadonlyArray<{ id: string; name: string }>,
): BranchRow[] {
  const rows = new Map<string, BranchRow>();
  const blank = (branchId: string, name: string): BranchRow => ({
    branchId, name, batches: 0, enrolled: 0, sessions: 0, present: 0, marked: 0, attendanceRate: null, billed: 0, collected: 0, outstanding: 0,
  });
  for (const b of branches) rows.set(b.id, blank(b.id, b.name));
  rows.set(UNASSIGNED_BRANCH, blank(UNASSIGNED_BRANCH, "Unassigned"));

  let batchBilled = 0;
  let batchCollected = 0;
  for (const b of report.batches.rows) {
    const key = branchByBatch.get(b.id);
    const row = (key && rows.get(key)) || (rows.get(UNASSIGNED_BRANCH) as BranchRow);
    row.batches++;
    row.enrolled += b.enrolled;
    row.sessions += b.sessions;
    row.present += b.present;
    row.marked += b.marked;
    row.billed += b.billed;
    row.collected += b.collected;
    batchBilled += b.billed;
    batchCollected += b.collected;
  }
  const un = rows.get(UNASSIGNED_BRANCH) as BranchRow;
  un.billed += report.money.billed - batchBilled;
  un.collected += report.money.collected - batchCollected;

  return [...rows.values()]
    .map((r) => ({
      ...r,
      billed: money(r.billed),
      collected: money(r.collected),
      outstanding: money(r.billed - r.collected),
      attendanceRate: ratio(r.present, r.marked),
    }))
    .filter((r) => r.branchId !== UNASSIGNED_BRANCH || r.batches > 0 || r.billed !== 0);
}

/** Branch ids a member may see: "ALL" for owners or an empty scope, else exactly the scoped branches. */
export function effectiveBranchScope(role: string, scopedBranchIds: readonly string[]): "ALL" | Set<string> {
  if (role === "OWNER" || scopedBranchIds.length === 0) return "ALL";
  return new Set(scopedBranchIds);
}

/** Apply a branch scope to branch rows (scoped members never see the unassigned bucket). */
export function visibleBranchRows<T extends { branchId: string }>(rows: readonly T[], scope: "ALL" | Set<string>): T[] {
  if (scope === "ALL") return [...rows];
  return rows.filter((r) => r.branchId !== UNASSIGNED_BRANCH && scope.has(r.branchId));
}
