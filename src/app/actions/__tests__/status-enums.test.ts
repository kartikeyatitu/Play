import { describe, it, expect } from "vitest";
import { LEAD_STATUSES, TRIAL_STATUSES } from "@/lib/enums";

describe("LEAD_STATUSES", () => {
  it("matches the values actually used in production as of 2026-10-20", () => {
    // Verified against the DB this session; keeping this test prevents us from
    // breaking the enum if someone narrows it without migrating existing rows.
    const expected = ["NEW", "CONTACTED", "TRIAL_BOOKED", "TRIAL_ATTENDED", "ENROLLED", "LOST"];
    expect([...LEAD_STATUSES].sort()).toEqual(expected.sort());
  });

  it("has no duplicates", () => {
    expect(new Set(LEAD_STATUSES).size).toBe(LEAD_STATUSES.length);
  });
});

describe("TRIAL_STATUSES", () => {
  it("accepts every status the UI and schema write (regression: Confirm/Mark Done threw)", () => {
    // TrialManager sends CONFIRMED and COMPLETED; schema default is PENDING;
    // convertTrialToStudent writes ENROLLED.
    for (const s of ["PENDING", "CONFIRMED", "COMPLETED", "NO_SHOW", "ENROLLED"]) {
      expect(TRIAL_STATUSES).toContain(s);
    }
  });

  it("covers every lifecycle state a trial can be in", () => {
    expect(TRIAL_STATUSES).toContain("SCHEDULED");
    expect(TRIAL_STATUSES).toContain("ATTENDED");
    expect(TRIAL_STATUSES).toContain("NO_SHOW");
    expect(TRIAL_STATUSES).toContain("ENROLLED");
    expect(TRIAL_STATUSES).toContain("DECLINED");
    expect(TRIAL_STATUSES).toContain("CANCELLED");
  });

  it("has no duplicates", () => {
    expect(new Set(TRIAL_STATUSES).size).toBe(TRIAL_STATUSES.length);
  });
});
