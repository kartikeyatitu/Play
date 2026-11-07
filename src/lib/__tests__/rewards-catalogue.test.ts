import { describe, it, expect } from "vitest";
import {
  eligibilityProblems,
  nextStatus,
  parseEligibility,
  parseRewardItemInput,
  refundsOn,
  restocksOn,
  SUGGESTED_ITEMS,
  type EligibilityContext,
} from "@/lib/rewards/catalogue";

const ctx: EligibilityContext = { active: true, costPoints: 200, stock: 5, balance: 250, level: 3, attendanceRate: 0.9, feeCreditsEnabled: false };

describe("eligibility parsing", () => {
  it("sanitises owner input", () => {
    expect(parseEligibility(null)).toEqual({ kind: "OTHER" });
    expect(parseEligibility({ kind: "KIT", minLevel: 1 })).toEqual({ kind: "KIT" });
    expect(parseEligibility({ kind: "SHOWCASE", minLevel: 99, minAttendanceRate: 1.7, sport: "Table Tennis" })).toEqual({
      kind: "SHOWCASE",
      minLevel: 10,
      minAttendanceRate: 1,
      sport: "table_tennis",
    });
    // A fee-credit amount only sticks on a fee-credit item.
    expect(parseEligibility({ kind: "KIT", feeCreditMinor: 50000 })).toEqual({ kind: "KIT" });
    expect(parseEligibility({ kind: "FEE_CREDIT", feeCreditMinor: 50000 })).toEqual({ kind: "FEE_CREDIT", feeCreditMinor: 50000 });
  });
});

describe("eligibility check", () => {
  it("passes when everything is met", () => {
    expect(eligibilityProblems({ kind: "SHOWCASE", minLevel: 3, minAttendanceRate: 0.8 }, ctx)).toEqual([]);
  });

  it("explains every gap", () => {
    const p = eligibilityProblems({ kind: "SHOWCASE", minLevel: 4, minAttendanceRate: 0.95 }, { ...ctx, balance: 50, stock: 0 });
    expect(p).toEqual(["Out of stock", "Needs Level 4", "Needs 95%+ attendance", "Needs 150 more points"]);
  });

  it("treats no attendance history as not meeting an attendance rule", () => {
    expect(eligibilityProblems({ kind: "SHOWCASE", minAttendanceRate: 0.8 }, { ...ctx, attendanceRate: null })).toContain("Needs 80%+ attendance");
  });

  it("blocks fee credits unless the owner opted in", () => {
    expect(eligibilityProblems({ kind: "FEE_CREDIT" }, ctx)).toContain("Fee credits are off at this academy");
    expect(eligibilityProblems({ kind: "FEE_CREDIT" }, { ...ctx, feeCreditsEnabled: true })).toEqual([]);
  });

  it("unlimited stock is null", () => {
    expect(eligibilityProblems({ kind: "KIT" }, { ...ctx, stock: null })).toEqual([]);
    expect(eligibilityProblems({ kind: "KIT" }, { ...ctx, active: false })).toContain("Not available");
  });
});

describe("item input", () => {
  it("validates", () => {
    expect(parseRewardItemInput({ name: "Bag", costPoints: 300, stock: "" })).toMatchObject({ ok: true, value: { stock: null } });
    expect(parseRewardItemInput({ name: "Bag", costPoints: 0 }).ok).toBe(false);
    expect(parseRewardItemInput({ name: "B", costPoints: 10 }).ok).toBe(false);
    expect(parseRewardItemInput({ name: "Bag", costPoints: 10, stock: -1 }).ok).toBe(false);
    expect(parseRewardItemInput({ name: "Bag", costPoints: 10.5 }).ok).toBe(false);
  });

  it("suggested catalogue matches spec costs and has no fee credit", () => {
    expect(SUGGESTED_ITEMS.map((i) => i.costPoints)).toEqual([150, 300, 200, 250]);
    expect(SUGGESTED_ITEMS.some((i) => i.eligibility.kind === "FEE_CREDIT")).toBe(false);
  });
});

describe("redemption state machine", () => {
  it("follows requested → approved → fulfilled", () => {
    expect(nextStatus("REQUESTED", "approve")).toBe("APPROVED");
    expect(nextStatus("APPROVED", "fulfil")).toBe("FULFILLED");
    expect(nextStatus("REQUESTED", "fulfil")).toBeNull();
  });

  it("can cancel only before fulfilment", () => {
    expect(nextStatus("REQUESTED", "cancel")).toBe("CANCELLED");
    expect(nextStatus("APPROVED", "cancel")).toBe("CANCELLED");
    expect(nextStatus("FULFILLED", "cancel")).toBeNull();
    expect(nextStatus("CANCELLED", "cancel")).toBeNull();
    expect(nextStatus("APPROVED", "decline")).toBeNull();
    expect(nextStatus("APPROVED", "approve")).toBeNull();
  });

  it("refunds on decline/cancel; restocks only if approved", () => {
    expect(refundsOn("decline")).toBe(true);
    expect(refundsOn("cancel")).toBe(true);
    expect(refundsOn("fulfil")).toBe(false);
    expect(restocksOn("cancel", "APPROVED")).toBe(true);
    expect(restocksOn("cancel", "REQUESTED")).toBe(false);
    expect(restocksOn("decline", "REQUESTED")).toBe(false);
  });
});
