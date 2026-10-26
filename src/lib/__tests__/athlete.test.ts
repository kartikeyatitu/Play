import { describe, it, expect } from "vitest";
import { canEditAchievement, nextAchievementStatus, parseAchievementInput, parseDay, parseGoalInput } from "@/lib/athlete";

const today = new Date("2026-10-26T00:00:00.000Z");
const valid = { kind: "COMPETITION", title: "U-14 District Championship", level: "DISTRICT", result: "Runner-up", eventDate: "2026-09-14" };

describe("parseAchievementInput", () => {
  it("accepts a valid competition result", () => {
    const r = parseAchievementInput(valid, today);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.eventDate.toISOString()).toBe("2026-09-14T00:00:00.000Z");
      expect(r.value.competition).toBeNull();
    }
  });

  it("rejects future dates, bad levels, short titles and non-http evidence", () => {
    expect(parseAchievementInput({ ...valid, eventDate: "2026-10-27" }, today).ok).toBe(false);
    expect(parseAchievementInput({ ...valid, level: "GALACTIC" }, today).ok).toBe(false);
    expect(parseAchievementInput({ ...valid, title: "ab" }, today).ok).toBe(false);
    expect(parseAchievementInput({ ...valid, evidenceUrl: "javascript:alert(1)" }, today).ok).toBe(false);
    expect(parseAchievementInput({ ...valid, eventDate: "2026-02-30" }, today).ok).toBe(false);
  });
});

describe("nextAchievementStatus", () => {
  it("lets coaches review but never verify", () => {
    expect(nextAchievementStatus("SUBMITTED", "review", "COACH")).toEqual({ ok: true, value: "REVIEWED" });
    expect(nextAchievementStatus("REVIEWED", "verify", "COACH").ok).toBe(false);
    expect(nextAchievementStatus("SUBMITTED", "reject", "COACH", "not real").ok).toBe(false);
  });

  it("never lets parents change status", () => {
    expect(nextAchievementStatus("SUBMITTED", "review", "PARENT").ok).toBe(false);
    expect(nextAchievementStatus("SUBMITTED", "verify", "PARENT").ok).toBe(false);
  });

  it("lets staff verify, reject with a reason, and unverify", () => {
    expect(nextAchievementStatus("SUBMITTED", "verify", "ADMIN")).toEqual({ ok: true, value: "VERIFIED" });
    expect(nextAchievementStatus("REVIEWED", "verify", "ADMIN")).toEqual({ ok: true, value: "VERIFIED" });
    expect(nextAchievementStatus("REVIEWED", "reject", "ADMIN").ok).toBe(false); // reason required
    expect(nextAchievementStatus("REVIEWED", "reject", "ADMIN", "No record of this event")).toEqual({ ok: true, value: "REJECTED" });
    expect(nextAchievementStatus("VERIFIED", "unverify", "ADMIN", "Entered wrong year")).toEqual({ ok: true, value: "REVIEWED" });
    expect(nextAchievementStatus("REJECTED", "verify", "ADMIN").ok).toBe(false);
    expect(nextAchievementStatus("VERIFIED", "review", "ADMIN").ok).toBe(false);
  });
});

describe("canEditAchievement", () => {
  it("limits parents to their own unreviewed or rejected entries", () => {
    expect(canEditAchievement({ status: "SUBMITTED", submittedById: "p1" }, "PARENT", "p1")).toBe(true);
    expect(canEditAchievement({ status: "REJECTED", submittedById: "p1" }, "PARENT", "p1")).toBe(true);
    expect(canEditAchievement({ status: "REVIEWED", submittedById: "p1" }, "PARENT", "p1")).toBe(false);
    expect(canEditAchievement({ status: "SUBMITTED", submittedById: "c1" }, "PARENT", "p1")).toBe(false);
  });
  it("keeps verified entries out of coach hands", () => {
    expect(canEditAchievement({ status: "VERIFIED", submittedById: "c1" }, "COACH", "c1")).toBe(false);
    expect(canEditAchievement({ status: "VERIFIED", submittedById: "c1" }, "ADMIN", "a1")).toBe(true);
  });
});

describe("parseGoalInput", () => {
  it("accepts optional numbers and rejects past due dates for new goals", () => {
    const r = parseGoalInput({ title: "Sprint 20m faster", metric: "20m sprint (s)", baseline: "3.9", target: "3.6", dueDate: "2026-12-31" }, today, true);
    expect(r.ok && r.value.target).toBe(3.6);
    expect(parseGoalInput({ title: "Sprint", dueDate: "2026-10-01" }, today, true).ok).toBe(false);
    expect(parseGoalInput({ title: "Sprint", dueDate: "2026-10-01" }, today, false).ok).toBe(true);
    expect(parseGoalInput({ title: "Sprint", target: "fast" }, today, true).ok).toBe(false);
  });
});

describe("parseDay", () => {
  it("normalises to midnight UTC and rejects junk", () => {
    expect(parseDay("2026-01-05")?.toISOString()).toBe("2026-01-05T00:00:00.000Z");
    expect(parseDay("05/01/2026")).toBeNull();
  });
});
