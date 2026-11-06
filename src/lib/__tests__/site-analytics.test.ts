import { describe, it, expect } from "vitest";
import { isPrivateAnalyticsPath } from "@/lib/analytics-privacy";

describe("analytics never records private pages", () => {
  it.each(["/parent", "/parent/x", "/student/abc", "/athlete/s1", "/live/m1", "/r/tok123", "/org", "/org/live", "/coach", "/join", "/delete-account"])("%s is private", (p) => {
    expect(isPrivateAnalyticsPath(p)).toBe(true);
  });
  it.each(["/", "/pricing", "/academies", "/noida", "/contact", "/register", "/refund-policy", "/privacy"])("%s is public", (p) => {
    expect(isPrivateAnalyticsPath(p)).toBe(false);
  });
});
