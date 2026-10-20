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
