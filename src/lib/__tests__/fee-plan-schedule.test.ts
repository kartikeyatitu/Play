import { describe, it, expect } from "vitest";
import { addMonths, buildPlanSchedule, periodBounds, planKind, prorateAmount, validatePlanInput, localDate } from "@/lib/fee-plan-schedule";

describe("plan kinds and months", () => {
  it("derives kind from duration", () => {
    expect(planKind(1)).toBe("MONTHLY");
    expect(planKind(3)).toBe("QUARTERLY");
    expect(planKind(6)).toBe("TERM");
  });
  it("adds months across years", () => {
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });
  it("period bounds", () => {
    expect(periodBounds("2026-11", 3)).toEqual({ firstDay: "2026-11-01", lastDay: "2027-01-31", months: ["2026-11", "2026-12", "2027-01"], totalDays: 92 });
    expect(periodBounds("2028-02", 1).totalDays).toBe(29);
  });
});

describe("prorateAmount (documented rule)", () => {
  it("joined before or on the first day → full", () => {
    expect(prorateAmount(3000, "2026-11", 1, "2026-10-15")).toMatchObject({ amount: 3000, prorated: false });
    expect(prorateAmount(3000, "2026-11", 1, "2026-11-01")).toMatchObject({ amount: 3000, prorated: false });
    expect(prorateAmount(3000, "2026-11", 1, null)).toMatchObject({ amount: 3000, prorated: false });
  });
  it("monthly: joined 16 Nov → 15 of 30 days → half", () => {
    expect(prorateAmount(3000, "2026-11", 1, "2026-11-16")).toEqual({ amount: 1500, chargedDays: 15, totalDays: 30, prorated: true });
  });
  it("last day of the period is still billed one day", () => {
    expect(prorateAmount(3000, "2026-11", 1, "2026-11-30")).toMatchObject({ amount: 100, chargedDays: 1 });
  });
  it("quarterly: days across the whole quarter, rounded to the rupee", () => {
    // Nov–Jan = 92 days; join 1 Dec → 62 days → 9000 × 62 / 92 = 6065.2 → 6065
    expect(prorateAmount(9000, "2026-11", 3, "2026-12-01")).toMatchObject({ amount: 6065, chargedDays: 62, totalDays: 92 });
  });
  it("joined after the period → nothing", () => {
    expect(prorateAmount(3000, "2026-11", 1, "2026-12-01")).toMatchObject({ amount: 0, chargedDays: 0 });
  });
});

describe("buildPlanSchedule", () => {
  it("monthly plan → one due", () => {
    const s = buildPlanSchedule({ amount: 2500, duration: 1, startMonth: "2026-12" });
    expect(s.ok && s.lines).toEqual([{ month: "2026-12", amount: 2500, kind: "DUE", instalment: 1 }]);
  });

  it("quarterly pay in full → one due and two covered months", () => {
    const s = buildPlanSchedule({ amount: 7000, duration: 3, startMonth: "2026-12" });
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.lines.map((l) => [l.month, l.kind, l.amount])).toEqual([
      ["2026-12", "DUE", 7000],
      ["2027-01", "COVERED", 0],
      ["2027-02", "COVERED", 0],
    ]);
  });

  it("6-month term in 2 instalments → months 0 and 3", () => {
    const s = buildPlanSchedule({ amount: 12000, duration: 6, startMonth: "2026-07", instalments: 2 });
    if (!s.ok) throw new Error(s.error);
    expect(s.lines.filter((l) => l.kind === "DUE").map((l) => [l.month, l.amount])).toEqual([
      ["2026-07", 6000],
      ["2026-10", 6000],
    ]);
    expect(s.lines).toHaveLength(6);
  });

  it("uneven split puts the remainder on the first due, total preserved", () => {
    const s = buildPlanSchedule({ amount: 10000, duration: 3, startMonth: "2026-04", instalments: 3 });
    if (!s.ok) throw new Error(s.error);
    expect(s.lines.map((l) => l.amount)).toEqual([3334, 3333, 3333]);
    expect(s.total).toBe(10000);
  });

  it("mid-period join: earlier instalments move to the join month, prorated total split", () => {
    // Term Jul–Dec 2026 (184 days), 2 instalments (Jul, Oct). Join 15 Aug → 139 days.
    const s = buildPlanSchedule({ amount: 12000, duration: 6, startMonth: "2026-07", instalments: 2, joinDate: "2026-08-15" });
    if (!s.ok) throw new Error(s.error);
    expect(s.proration).toMatchObject({ prorated: true, chargedDays: 139, totalDays: 184 });
    expect(s.total).toBe(Math.round((12000 * 139) / 184)); // 9065
    const dues = s.lines.filter((l) => l.kind === "DUE");
    expect(dues.map((l) => l.month)).toEqual(["2026-08", "2026-10"]);
    expect(dues.reduce((t, l) => t + l.amount, 0)).toBe(s.total);
    // No line before the join month
    expect(s.lines[0].month).toBe("2026-08");
    expect(s.lines.map((l) => l.month)).toEqual(["2026-08", "2026-09", "2026-10", "2026-11", "2026-12"]);
  });

  it("join after both instalment months merges into one due", () => {
    const s = buildPlanSchedule({ amount: 9000, duration: 3, startMonth: "2026-11", instalments: 2, joinDate: "2027-01-10" });
    if (!s.ok) throw new Error(s.error);
    expect(s.lines).toEqual([{ month: "2027-01", amount: s.total, kind: "DUE", instalment: 1 }]);
  });

  it("joined after the period → no lines", () => {
    const s = buildPlanSchedule({ amount: 9000, duration: 3, startMonth: "2026-11", joinDate: "2027-02-01" });
    expect(s.ok && s.lines).toEqual([]);
  });

  it("validates input", () => {
    expect(validatePlanInput({ amount: 0, duration: 1, startMonth: "2026-11" })).toMatch(/Amount/);
    expect(validatePlanInput({ amount: 1, duration: 13, startMonth: "2026-11" })).toMatch(/Duration/);
    expect(validatePlanInput({ amount: 1, duration: 3, startMonth: "2026-13" })).toMatch(/Start month/);
    expect(validatePlanInput({ amount: 1, duration: 3, startMonth: "2026-11", instalments: 4 })).toMatch(/At most 3/);
    expect(buildPlanSchedule({ amount: 1, duration: 1, startMonth: "2026-11", instalments: 2 }).ok).toBe(false);
  });
});

describe("localDate", () => {
  it("enrolment instants are read in IST", () => {
    expect(localDate(new Date("2026-11-15T18:30:00Z"))).toBe("2026-11-16");
    expect(localDate(new Date("2026-11-15T18:29:59Z"))).toBe("2026-11-15");
  });
});
