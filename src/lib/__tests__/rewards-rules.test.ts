import { describe, it, expect } from "vitest";
import {
  CAPS,
  capPoints,
  checkCoachBonus,
  DEFAULT_EARN_RULES,
  EARN_RULE_CEILINGS,
  EARN_TRIGGERS,
  monthWindow,
  resolveEarnRules,
} from "@/lib/rewards/rules";
import { DEFAULT_SETTINGS, parseSettings } from "@/lib/rewards/settings";

describe("earn rules", () => {
  it("defaults match spec §3", () => {
    expect(DEFAULT_EARN_RULES.SESSION_ATTENDED).toEqual({ xp: 10, points: 5 });
    expect(DEFAULT_EARN_RULES.DRILL_COMPLETED).toEqual({ xp: 5, points: 3 });
    expect(DEFAULT_EARN_RULES.MATCH_PLAYED).toEqual({ xp: 10, points: 5 });
    expect(DEFAULT_EARN_RULES.MATCH_WON).toEqual({ xp: 10, points: 5 });
    expect(DEFAULT_EARN_RULES.PERSONAL_BEST).toEqual({ xp: 20, points: 10 });
    expect(DEFAULT_EARN_RULES.SKILL_IMPROVED).toEqual({ xp: 15, points: 5 });
    expect(DEFAULT_EARN_RULES.COACH_BONUS).toEqual({ xp: 20, points: 10 });
  });

  it("has no trigger that could deduct for a missed session", () => {
    expect(EARN_TRIGGERS.some((t) => /MISS|ABSEN|INJUR|ILLNESS|PENALTY|DEDUCT/.test(t))).toBe(false);
    for (const t of EARN_TRIGGERS) {
      expect(DEFAULT_EARN_RULES[t].xp).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_EARN_RULES[t].points).toBeGreaterThanOrEqual(0);
    }
  });

  it("clamps academy overrides to 0..ceiling and ignores junk", () => {
    const r = resolveEarnRules({ SESSION_ATTENDED: { xp: 999, points: -5 }, MATCH_WON: { xp: "12", points: 2.7 }, NOPE: { xp: 1 } });
    expect(r.SESSION_ATTENDED).toEqual({ xp: EARN_RULE_CEILINGS.SESSION_ATTENDED.xp, points: 0 });
    expect(r.MATCH_WON).toEqual({ xp: 12, points: 2 });
    expect(r.DRILL_COMPLETED).toEqual(DEFAULT_EARN_RULES.DRILL_COMPLETED);
    expect(Object.keys(r)).not.toContain("NOPE");
    expect(resolveEarnRules(null)).toEqual(DEFAULT_EARN_RULES);
    expect(resolveEarnRules({ COACH_BONUS: { xp: 50, points: 50 } }).COACH_BONUS).toEqual({ xp: 20, points: 10 });
  });
});

describe("monthly caps", () => {
  it("caps attendance points at 100 a month", () => {
    expect(capPoints(5, "SESSION_ATTENDED", 98, 98)).toEqual({ granted: 2, capped: true });
    expect(capPoints(5, "SESSION_ATTENDED", 100, 100)).toEqual({ granted: 0, capped: true });
    // Attendance cap doesn't limit other sources.
    expect(capPoints(5, "MATCH_PLAYED", 100, 100)).toEqual({ granted: 5, capped: false });
  });

  it("caps all points at 300 a month", () => {
    expect(capPoints(10, "PERSONAL_BEST", 295, 0)).toEqual({ granted: 5, capped: true });
    expect(capPoints(10, "PERSONAL_BEST", 300, 0).granted).toBe(0);
    expect(capPoints(10, "PERSONAL_BEST", 400, 0).granted).toBe(0);
  });

  it("never grants a negative or fractional amount", () => {
    expect(capPoints(-10, "MATCH_PLAYED", 0, 0).granted).toBe(0);
    expect(capPoints(4.9, "MATCH_PLAYED", 0, 0).granted).toBe(4);
    expect(capPoints(NaN, "MATCH_PLAYED", 0, 0).granted).toBe(0);
  });
});

describe("coach bonus", () => {
  const base = { rule: DEFAULT_EARN_RULES.COACH_BONUS, weekPointsByCoach: 0, awardsByCoachToday: 0, monthRoom: 300, reviewable: true };

  it("accepts a normal bonus and defaults XP to 2x points (max 20)", () => {
    expect(checkCoachBonus({ ...base, points: 5 })).toEqual({ ok: true, points: 5, xp: 10, needsReview: false });
    expect(checkCoachBonus({ ...base, points: 3, xp: 0 })).toMatchObject({ ok: true, xp: 0 });
  });

  it("refuses over the per-award caps", () => {
    expect(checkCoachBonus({ ...base, points: 11 }).ok).toBe(false);
    expect(checkCoachBonus({ ...base, points: 5, xp: 21 }).ok).toBe(false);
    expect(checkCoachBonus({ ...base, points: 0 }).ok).toBe(false);
    expect(checkCoachBonus({ ...base, points: 2.5 }).ok).toBe(false);
    expect(checkCoachBonus({ ...base, points: "5" }).ok).toBe(false);
  });

  it("honours a lower academy rule", () => {
    expect(checkCoachBonus({ ...base, rule: { xp: 10, points: 4 }, points: 5 }).ok).toBe(false);
  });

  it("refuses over the weekly per-coach per-child cap (never trims)", () => {
    const r = checkCoachBonus({ ...base, points: 6, weekPointsByCoach: CAPS.coachBonusPointsPerWeek - 5 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/5 more points/);
    expect(checkCoachBonus({ ...base, points: 5, weekPointsByCoach: 15 }).ok).toBe(true);
    expect(checkCoachBonus({ ...base, points: 1, weekPointsByCoach: 20 }).ok).toBe(false);
  });

  it("refuses when the child's monthly cap can't take it", () => {
    expect(checkCoachBonus({ ...base, points: 5, monthRoom: 4 }).ok).toBe(false);
  });

  it("flags big awards and the 3rd award in a day for owner review", () => {
    expect(checkCoachBonus({ ...base, points: 10 })).toMatchObject({ ok: true, needsReview: true });
    expect(checkCoachBonus({ ...base, points: 2, awardsByCoachToday: 2 })).toMatchObject({ ok: true, needsReview: true });
    expect(checkCoachBonus({ ...base, points: 2, awardsByCoachToday: 1 })).toMatchObject({ ok: true, needsReview: false });
    // Owner/manager awards are not sent to themselves for review.
    expect(checkCoachBonus({ ...base, points: 10, reviewable: false })).toMatchObject({ ok: true, needsReview: false });
  });
});

describe("month window", () => {
  it("uses the academy time zone (IST)", () => {
    // 31 Oct 2026 20:00 UTC = 1 Nov 01:30 IST → November.
    const w = monthWindow(new Date(Date.UTC(2026, 9, 31, 20, 0)), "Asia/Kolkata");
    expect(w.key).toBe("2026-11");
    expect(w.start.toISOString()).toBe("2026-10-31T18:30:00.000Z");
    expect(w.end.toISOString()).toBe("2026-11-30T18:30:00.000Z");
  });

  it("works in UTC and Dubai", () => {
    expect(monthWindow(new Date(Date.UTC(2026, 1, 15)), "UTC").start.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(monthWindow(new Date(Date.UTC(2026, 1, 15)), "Asia/Dubai").start.toISOString()).toBe("2026-01-31T20:00:00.000Z");
  });
});

describe("settings", () => {
  it("defaults to fee credits off", () => {
    expect(DEFAULT_SETTINGS.feeCreditsEnabled).toBe(false);
    expect(parseSettings("not json").feeCreditsEnabled).toBe(false);
    expect(parseSettings(JSON.stringify({ feeCreditsEnabled: "yes" })).feeCreditsEnabled).toBe(false);
    expect(parseSettings({ feeCreditsEnabled: true }).feeCreditsEnabled).toBe(true);
  });

  it("clamps rules and point value", () => {
    const s = parseSettings({ earnRules: { MATCH_PLAYED: { xp: 1000, points: 1000 } }, pointValueMinor: -3 });
    expect(s.earnRules.MATCH_PLAYED).toEqual(EARN_RULE_CEILINGS.MATCH_PLAYED);
    expect(s.pointValueMinor).toBe(0);
  });
});
