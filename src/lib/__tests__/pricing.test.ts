import { describe, it, expect } from "vitest";
import { canonicalPlan, isInTrial, PLAN_IDS, PLAN_LIMITS } from "@/lib/pricing";

describe("canonicalPlan", () => {
  it("passes canonical values through unchanged", () => {
    expect(canonicalPlan("free")).toBe("free");
    expect(canonicalPlan("growth")).toBe("growth");
    expect(canonicalPlan("academy")).toBe("academy");
  });

  it("normalises legacy Organization.plan values", () => {
    expect(canonicalPlan("FREE_TRIAL")).toBe("free");
    expect(canonicalPlan("Free_Trial")).toBe("free");
    expect(canonicalPlan("free_trial")).toBe("free");
  });

  it("normalises legacy Subscription.plan values", () => {
    expect(canonicalPlan("FREE")).toBe("free");
    expect(canonicalPlan("STARTER")).toBe("growth");
    expect(canonicalPlan("PRO")).toBe("growth");
    expect(canonicalPlan("ENTERPRISE")).toBe("academy");
  });

  it("is case-insensitive and whitespace-tolerant", () => {
    expect(canonicalPlan("  Growth  ")).toBe("growth");
    expect(canonicalPlan("ACADEMY")).toBe("academy");
  });

  it("defaults unknown or missing values to the safest option (free)", () => {
    expect(canonicalPlan(null)).toBe("free");
    expect(canonicalPlan(undefined)).toBe("free");
    expect(canonicalPlan("")).toBe("free");
    expect(canonicalPlan("rubbish-plan")).toBe("free");
  });
});

describe("isInTrial", () => {
  it("returns false when planExpiry is missing", () => {
    expect(isInTrial(null)).toBe(false);
    expect(isInTrial(undefined)).toBe(false);
  });

  it("returns true for a date in the future", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(isInTrial(future)).toBe(true);
  });

  it("returns false for a date in the past", () => {
    const past = new Date(Date.now() - 1000);
    expect(isInTrial(past)).toBe(false);
  });
});

describe("PLAN_IDS / PLAN_LIMITS", () => {
  it("PLAN_IDS covers exactly the three canonical plans", () => {
    expect([...PLAN_IDS].sort()).toEqual(["academy", "free", "growth"]);
  });

  it("PLAN_LIMITS has an entry for every PlanId with Free being the smallest", () => {
    expect(PLAN_LIMITS.free).toBeLessThan(PLAN_LIMITS.growth);
    expect(PLAN_LIMITS.growth).toBeLessThan(PLAN_LIMITS.academy);
    for (const id of PLAN_IDS) {
      expect(PLAN_LIMITS[id]).toBeGreaterThan(0);
    }
  });
});

import {
  AI_MONTHLY_ACTIONS,
  foundingMonthlyPrice,
  graduatedStudentCharge,
  growthAnnualPrice,
  growthMonthlyPrice,
  internationalMonthlyPrice,
  withGst,
} from "@/lib/pricing";
import { aiActionsRemaining } from "@/lib/ai/usage";

describe("Growth pricing (graduated)", () => {
  it("is free up to 30 students", () => {
    expect(growthMonthlyPrice(0)).toBe(0);
    expect(growthMonthlyPrice(30)).toBe(0);
  });
  it("applies the ₹699 minimum just above the free tier", () => {
    expect(growthMonthlyPrice(31)).toBe(699); // 31 × 20 = 620 < 699
    expect(growthMonthlyPrice(35)).toBe(700);
  });
  it("charges each band at its own rate", () => {
    expect(growthMonthlyPrice(100)).toBe(2000);
    expect(growthMonthlyPrice(150)).toBe(2000 + 50 * 12);
    expect(growthMonthlyPrice(500)).toBe(2000 + 400 * 12);
    expect(growthMonthlyPrice(1000)).toBe(6800 + 500 * 8);
  });
  it("never goes down when a student is added", () => {
    let prev = 0;
    for (let n = 0; n <= 1200; n++) {
      const p = growthMonthlyPrice(n);
      if (n > 30) expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });
  it("ignores bad input", () => {
    expect(graduatedStudentCharge(-5)).toBe(0);
    expect(growthMonthlyPrice(Number.NaN)).toBe(0);
  });
  it("founding offer halves the bill", () => {
    expect(foundingMonthlyPrice(100)).toBe(1000);
  });
  it("adds 18% GST and gives 2 months free on annual", () => {
    expect(withGst(2000)).toBe(2360);
    expect(growthAnnualPrice(100)).toBe(20000);
  });
  it("prices outside India at US$1 per student, minimum US$49", () => {
    expect(internationalMonthlyPrice(30)).toBe(0);
    expect(internationalMonthlyPrice(31)).toBe(49);
    expect(internationalMonthlyPrice(49)).toBe(49);
    expect(internationalMonthlyPrice(100)).toBe(100);
  });
});

describe("AI allowance", () => {
  it("gives Free 50 and paid plans 1,000 actions a month", () => {
    expect(AI_MONTHLY_ACTIONS.free).toBe(50);
    expect(AI_MONTHLY_ACTIONS.growth).toBe(1000);
  });
  it("counts down and stops at zero", () => {
    expect(aiActionsRemaining(50, 0)).toBe(50);
    expect(aiActionsRemaining(50, 49)).toBe(1);
    expect(aiActionsRemaining(50, 60)).toBe(0);
  });
});
