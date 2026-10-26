import { describe, it, expect } from "vitest";
import {
  countViewsSince,
  detectPlatform,
  isProfileVisible,
  istDayStart,
  normalizeHandle,
  validateCreatorProfile,
  validatePortfolioItem,
  validateReport,
} from "@/lib/creators";
import { safeHttpUrl } from "@/lib/safe-url";

describe("handles", () => {
  it("normalises and validates", () => {
    expect(normalizeHandle("@Cricket_Coach")).toEqual({ ok: true, value: "cricket_coach" });
    expect(normalizeHandle("ab").ok).toBe(false);
    expect(normalizeHandle("bad handle").ok).toBe(false);
    expect(normalizeHandle("admin").ok).toBe(false);
  });
});

describe("profile validation", () => {
  it("keeps only known categories and caps them", () => {
    const r = validateCreatorProfile({ handle: "kabaddi_tv", displayName: "Kabaddi TV" }, ["HIGHLIGHTS", "FAKE", "HIGHLIGHTS"]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.categories).toEqual(["HIGHLIGHTS"]);
      expect(r.value.isPublic).toBe(false);
    }
    expect(
      validateCreatorProfile({ handle: "abc", displayName: "Abc" }, ["TRAINING_TIPS", "MATCH_ANALYSIS", "HIGHLIGHTS", "FITNESS", "NUTRITION", "NEWS"]).ok,
    ).toBe(false);
  });
});

describe("portfolio links", () => {
  it("accepts http(s) only, via safeHttpUrl", () => {
    expect(validatePortfolioItem({ title: "Batting drill", url: "https://youtu.be/abc" }, safeHttpUrl).ok).toBe(true);
    expect(validatePortfolioItem({ title: "XSS", url: "javascript:alert(1)" }, safeHttpUrl).ok).toBe(false);
    expect(validatePortfolioItem({ title: "Data", url: "data:text/html,hi" }, safeHttpUrl).ok).toBe(false);
    expect(validatePortfolioItem({ title: "Rel", url: "/relative" }, safeHttpUrl).ok).toBe(false);
  });

  it("labels platforms from the host only", () => {
    expect(detectPlatform("https://www.youtube.com/watch?v=1")).toBe("YouTube");
    expect(detectPlatform("https://instagram.com/p/1")).toBe("Instagram");
    expect(detectPlatform("https://x.com/a/status/1")).toBe("X");
    expect(detectPlatform("https://notyoutube.example.com")).toBe("Link");
  });
});

describe("reports", () => {
  it("validates target and reason", () => {
    expect(validateReport({ targetType: "PORTFOLIO_ITEM", targetId: "abc123", reason: "SPAM" }).ok).toBe(true);
    expect(validateReport({ targetType: "USER", targetId: "abc123", reason: "SPAM" }).ok).toBe(false);
    expect(validateReport({ targetType: "PORTFOLIO_ITEM", targetId: "abc123", reason: "BORING" }).ok).toBe(false);
  });
});

describe("visibility and analytics", () => {
  it("hides private or moderated profiles", () => {
    expect(isProfileVisible({ isPublic: true, hiddenAt: null })).toBe(true);
    expect(isProfileVisible({ isPublic: false, hiddenAt: null })).toBe(false);
    expect(isProfileVisible({ isPublic: true, hiddenAt: new Date() })).toBe(false);
  });

  it("counts only recorded events in the window", () => {
    const now = new Date("2026-10-26T12:00:00Z");
    const views = [new Date("2026-10-26T10:00:00Z"), new Date("2026-10-22T10:00:00Z"), new Date("2026-09-01T10:00:00Z")];
    expect(countViewsSince(views, 7, now)).toBe(2);
    expect(countViewsSince(views, 30, now)).toBe(2);
    expect(countViewsSince([], 30, now)).toBe(0);
  });

  it("computes the IST day start", () => {
    expect(istDayStart(new Date("2026-10-26T20:00:00Z")).toISOString()).toBe("2026-10-26T18:30:00.000Z");
    expect(istDayStart(new Date("2026-10-26T10:00:00Z")).toISOString()).toBe("2026-10-25T18:30:00.000Z");
  });
});
