import { describe, expect, it } from "vitest";
import { costUsd, monthlyBudgetUsd, monthStartUtc, sumLoggedCost, withinBudget } from "@/lib/ai/usage";
import { redactContactDetails } from "@/lib/ai/redact";
import { buildReportPrompt, buildSkillNotePrompt, clampScore } from "@/lib/ai/prompts";
import type { BusinessReport } from "@/lib/business-report";

describe("costUsd", () => {
  it("prices Haiku 5.5 at $0.10 in / $0.50 out per million tokens", () => {
    expect(costUsd("claude-haiku-5-5", 100_000, 0)).toBeCloseTo(0.01);
    expect(costUsd("claude-haiku-5-5", 0, 1_000_000)).toBeCloseTo(0.5);
    expect(costUsd("claude-haiku-5-5", 2000, 500)).toBeCloseTo(0.00045);
  });
  it("uses the long-prompt rates above 100,000 input tokens", () => {
    expect(costUsd("claude-haiku-5-5", 200_000, 1_000_000)).toBeCloseTo(0.1 + 2.5);
  });
  it("prices unknown models at the expensive rate so the cap stays safe", () => {
    expect(costUsd("some-new-model", 1_000_000, 0)).toBeCloseTo(2);
  });
  it("treats negative or missing token counts as zero", () => {
    expect(costUsd("claude-haiku-5-5", -5, Number.NaN)).toBe(0);
  });
});

describe("budget", () => {
  it("converts the rupee cap with the configured rate, defaulting to ₹5,000 at 95", () => {
    expect(monthlyBudgetUsd({})).toBeCloseTo(5000 / 95);
    expect(monthlyBudgetUsd({ AI_MONTHLY_BUDGET_INR: "1000", AI_USD_INR_RATE: "100" })).toBe(10);
  });
  it("returns zero (blocks all calls) for a bad config", () => {
    expect(monthlyBudgetUsd({ AI_MONTHLY_BUDGET_INR: "abc" })).toBe(0);
    expect(monthlyBudgetUsd({ AI_USD_INR_RATE: "0" })).toBe(0);
  });
  it("allows a call only while spend plus estimate fits", () => {
    expect(withinBudget(9, 10, 0.5)).toBe(true);
    expect(withinBudget(9.8, 10, 0.5)).toBe(false);
    expect(withinBudget(0, 0, 0)).toBe(false);
  });
  it("sums logged costs and ignores malformed rows", () => {
    const rows = [{ details: '{"costUsd":0.25}' }, { details: "not json" }, { details: null }, { details: '{"costUsd":-1}' }, { details: '{"costUsd":0.5}' }];
    expect(sumLoggedCost(rows)).toBeCloseTo(0.75);
  });
  it("starts the month at UTC midnight on the 1st", () => {
    expect(monthStartUtc(new Date("2026-10-27T10:00:00Z")).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("redactContactDetails", () => {
  it("removes emails and phone numbers but keeps scores and short numbers", () => {
    const out = redactContactDetails("Call mum on +91 98765 43210 or mail priya.s@example.com. Scored 4/5 in 3 drills.");
    expect(out).not.toContain("98765");
    expect(out).not.toContain("example.com");
    expect(out).toContain("[number removed]");
    expect(out).toContain("[email removed]");
    expect(out).toContain("4/5 in 3 drills");
  });
});

describe("prompts", () => {
  it("skill note prompt carries scores and redacted points, no names", () => {
    const p = buildSkillNotePrompt({
      sport: "Badminton",
      month: "2026-10",
      dimensions: [{ label: "Footwork", score: 4 }, { label: "Smash", score: 9 }],
      coachPoints: "Good footwork. Dad's number 9876543210.",
    });
    expect(p).toContain("Footwork: 4/5");
    expect(p).toContain("Smash: 5/5");
    expect(p).not.toContain("9876543210");
  });
  it("clamps scores to 1–5", () => {
    expect(clampScore(0)).toBe(1);
    expect(clampScore(7)).toBe(5);
    expect(clampScore(Number.NaN)).toBe(3);
  });
  it("report prompt uses only report numbers and marks missing rates", () => {
    const report: BusinessReport = {
      month: "2026-10",
      money: { billed: 50000, collected: 42000, outstandingMonth: 8000, outstandingAll: 12000, outstandingAllCount: 6, collectionRate: 0.84, feeRecords: 25 },
      attendance: { present: 300, marked: 400, rate: 0.75, sessions: 40, cancelled: 2 },
      students: { active: 25, newInMonth: 3 },
      trials: { booked: 5, enrolled: 2, conversionRate: 0.4 },
      batches: { rows: [{ id: "b1", name: "U-12 Morning", enrolled: 12, capacity: 15, utilisation: 0.8, sessions: 20, cancelled: 1, present: 150, marked: 200, attendanceRate: 0.75, billed: 24000, collected: 20000, outstanding: 4000 }], enrolled: 12, capacity: 15, utilisation: 0.8 },
      facilities: { rows: [], openHours: 0, bookedHours: 0, utilisation: null, revenue: 0 },
    };
    const p = buildReportPrompt(report, "INR");
    expect(p).toContain("collected INR 42000 (collection rate 84%)");
    expect(p).toContain("U-12 Morning: 12/15 enrolled");
    expect(p).not.toContain("Courts:");
  });
});
