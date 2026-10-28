import { describe, expect, it } from "vitest";
import { answerBatches, answerSources } from "@/lib/ask-answers";
import type { BusinessReport } from "@/lib/business-report";

const row = (name: string, outstanding: number, attendanceRate: number | null, utilisation: number | null) => ({
  id: name, name, enrolled: 10, capacity: 12, utilisation, sessions: 8, cancelled: 0, present: 60, marked: 80, attendanceRate, billed: 20000, collected: 20000 - outstanding, outstanding,
});
const report = {
  month: "2026-10",
  money: { billed: 40000, collected: 33000, outstandingMonth: 7000, outstandingAll: 9000, outstandingAllCount: 4, collectionRate: 0.825, feeRecords: 20 },
  attendance: { present: 120, marked: 160, rate: 0.75, sessions: 16, cancelled: 0 },
  students: { active: 20, newInMonth: 2 },
  trials: { booked: 2, enrolled: 1, conversionRate: 0.5 },
  batches: { rows: [row("U-12 Morning", 2000, 0.9, 0.83), row("U-14 Evening", 5000, 0.6, 0.5)], enrolled: 20, capacity: 24, utilisation: 0.83 },
  facilities: { rows: [], openHours: 0, bookedHours: 0, utilisation: null, revenue: 0 },
} as BusinessReport;

describe("answerBatches", () => {
  it("sorts unpaid descending and names the worst batch", () => {
    const a = answerBatches("t", "unpaid", report, "INR");
    expect(a.rows[0][0]).toBe("U-14 Evening");
    expect(a.summary).toContain("U-14 Evening has the most unpaid");
  });
  it("puts the lowest attendance first", () => {
    const a = answerBatches("t", "attendance", report, "INR");
    expect(a.rows[0][0]).toBe("U-14 Evening");
    expect(a.summary).toContain("60%");
    expect(a.summary).toContain("75%");
  });
});

describe("answerSources", () => {
  it("names the best-converting source with at least 3 enquiries", () => {
    const mk = (source: string, label: string, enquiries: number, enrolled: number) => ({ source, label, enquiries, trials: 0, enrolled, trialRate: 0, enrolRate: enquiries ? enrolled / enquiries : null });
    const a = answerSources("t", {
      funnelDays: 180,
      cohorts: [],
      funnel: { rows: [mk("WEBSITE", "Website", 10, 3), mk("REFERRAL", "Referral", 4, 3), mk("WALK_IN", "Walk-in", 2, 2)], total: mk("ALL", "All", 16, 8) },
    });
    expect(a.summary).toContain("Referral converts best: 75%");
    expect(a.rows[a.rows.length - 1][0]).toBe("All sources");
  });
});
