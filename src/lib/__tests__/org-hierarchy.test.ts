import { describe, it, expect } from "vitest";
import { computeBusinessReport, type ReportInput } from "@/lib/business-report";
import {
  UNASSIGNED_BRANCH,
  branchRows,
  canConsolidate,
  consolidatableOrgIds,
  effectiveBranchScope,
  summariseReport,
  totalsByCurrency,
  visibleBranchRows,
} from "@/lib/org-hierarchy";

describe("consolidated access", () => {
  const ms = [
    { orgId: "a", status: "ACTIVE", role: "OWNER" },
    { orgId: "b", status: "ACTIVE", role: "COACH" },
    { orgId: "c", status: "ACTIVE", role: "MANAGER" },
    { orgId: "d", status: "REMOVED", role: "OWNER" },
    { orgId: "e", status: "ACTIVE", role: "STAFF", staffRole: "ACCOUNTANT" },
    { orgId: "f", status: "ACTIVE", role: "MANAGER", permissions: JSON.stringify({ "reports.view": false }) },
  ];
  it("includes only active memberships holding reports.view", () => {
    expect(canConsolidate(ms[0])).toBe(true);
    expect(canConsolidate(ms[1])).toBe(false);
    expect(canConsolidate(ms[3])).toBe(false);
    const r = consolidatableOrgIds(ms);
    expect(r.orgIds).toEqual(["a", "c", "e"]);
    expect(r.skipped).toBe(2); // coach in b, manager without reports in f (removed d is not counted)
    expect(r.truncated).toBe(false);
  });
  it("caps the number of orgs", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ orgId: `o${i}`, status: "ACTIVE", role: "OWNER" }));
    const r = consolidatableOrgIds(many);
    expect(r.orgIds).toHaveLength(25);
    expect(r.truncated).toBe(true);
  });
});

const base: ReportInput = {
  month: "2026-10",
  daysInMonth: 31,
  fees: [
    { amount: 1000, status: "PAID", batchId: "x" },
    { amount: 500, status: "PENDING", batchId: "y" },
    { amount: 300, status: "PAID", batchId: null },
  ],
  outstandingAll: { amount: 500, count: 1 },
  batches: [
    { id: "x", name: "X", capacity: 10, enrolled: 5 },
    { id: "y", name: "Y", capacity: null, enrolled: 4 },
    { id: "z", name: "Z", capacity: null, enrolled: 2 },
  ],
  sessions: [
    { batchId: "x", status: "COMPLETED", marked: 5, present: 4 },
    { batchId: "z", status: "COMPLETED", marked: 2, present: 1 },
  ],
  students: { active: 11, newInMonth: 1 },
  trials: [],
  facilities: [],
  bookings: [],
};

describe("totalsByCurrency", () => {
  it("never mixes currencies and recomputes rates from sums", () => {
    const r1 = summariseReport(computeBusinessReport(base));
    const r2 = { ...r1, billed: 100, collected: 100, present: 0, marked: 10 };
    const t = totalsByCurrency([
      { currency: "INR", summary: r1 },
      { currency: "INR", summary: r2 },
      { currency: "AED", summary: r1 },
    ]);
    expect(Object.keys(t).sort()).toEqual(["AED", "INR"]);
    expect(t.INR.orgs).toBe(2);
    expect(t.INR.billed).toBe(1900);
    expect(t.INR.collected).toBe(1400);
    expect(t.INR.collectionRate).toBeCloseTo(1400 / 1900);
    expect(t.INR.attendanceRate).toBeCloseTo(5 / 17);
    expect(t.AED.billed).toBe(1800);
  });
});

describe("branchRows", () => {
  const report = computeBusinessReport(base);
  const rows = branchRows(report, new Map([["x", "b1"], ["y", "b2"]]), [
    { id: "b1", name: "Noida" },
    { id: "b2", name: "Gurgaon" },
  ]);

  it("adds up to the org totals, with unattributed money and unbranched batches in Unassigned", () => {
    const sum = (k: "billed" | "collected") => rows.reduce((n, r) => n + r[k], 0);
    expect(sum("billed")).toBe(report.money.billed);
    expect(sum("collected")).toBe(report.money.collected);
    const un = rows.find((r) => r.branchId === UNASSIGNED_BRANCH)!;
    expect(un).toMatchObject({ batches: 1, enrolled: 2, billed: 300, collected: 300, attendanceRate: 0.5 });
    expect(rows.find((r) => r.branchId === "b1")).toMatchObject({ billed: 1000, collected: 1000, attendanceRate: 0.8 });
    expect(rows.find((r) => r.branchId === "b2")).toMatchObject({ billed: 500, outstanding: 500, attendanceRate: null });
  });

  it("applies branch scope", () => {
    expect(effectiveBranchScope("OWNER", ["b1"])).toBe("ALL");
    expect(effectiveBranchScope("MANAGER", [])).toBe("ALL");
    const scope = effectiveBranchScope("MANAGER", ["b1"]);
    expect(visibleBranchRows(rows, scope).map((r) => r.branchId)).toEqual(["b1"]);
    expect(visibleBranchRows(rows, "ALL")).toHaveLength(rows.length);
  });
});
