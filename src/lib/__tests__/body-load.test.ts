import { describe, expect, it } from "vitest";
import { LOAD_EXPLAINER, describeWeek, sessionLoad, weekStart, weeklyLoad } from "@/lib/body/load";

describe("training load", () => {
  it("is RPE × minutes", () => {
    expect(sessionLoad(60, 5)).toBe(300);
    expect(sessionLoad(45, 7)).toBe(315);
    expect(sessionLoad(0, 0)).toBe(0);
  });

  it("rejects invalid input", () => {
    expect(sessionLoad(-1, 5)).toBeNull();
    expect(sessionLoad(60, 11)).toBeNull();
    expect(sessionLoad(301, 5)).toBeNull();
    expect(sessionLoad(NaN, 5)).toBeNull();
  });

  it("groups into Monday-start weeks", () => {
    expect(weekStart("2026-11-06")).toBe("2026-11-02"); // Friday → Monday
    expect(weekStart("2026-11-08")).toBe("2026-11-02"); // Sunday
    expect(weekStart("2026-11-09")).toBe("2026-11-09"); // Monday
    expect(weekStart("2026-13-01")).toBeNull();
  });

  it("totals per week with week-on-week change", () => {
    const weeks = weeklyLoad([
      { date: "2026-11-03", minutes: 60, rpe: 5 },
      { date: "2026-11-05", minutes: 60, rpe: 5 },
      { date: "2026-11-10", minutes: 90, rpe: 6 },
      { date: "2026-11-11", minutes: 60, rpe: 99 }, // skipped
    ]);
    expect(weeks).toEqual([
      { weekStart: "2026-11-02", sessions: 2, minutes: 120, load: 600, changePct: null },
      { weekStart: "2026-11-09", sessions: 1, minutes: 90, load: 540, changePct: -10 },
    ]);
    expect(describeWeek(weeks[1])).toMatch(/10% lower than the week before/);
  });

  it("is described as decision support with no predictions", () => {
    const text = LOAD_EXPLAINER.join(" ").toLowerCase();
    expect(text).toContain("decision support");
    expect(text).toContain("not a prediction");
    const weekText = describeWeek({ weekStart: "2026-11-02", sessions: 3, minutes: 200, load: 1500, changePct: 80 }).toLowerCase();
    for (const w of ["injur", "risk", "danger", "will "]) expect(weekText).not.toContain(w);
  });
});
