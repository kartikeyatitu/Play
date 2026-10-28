import { describe, expect, it } from "vitest";
import { parentMessage, scoreRisk, type AttendanceMark } from "@/lib/risk";

const days = (pattern: string, start = "2026-10-27"): AttendanceMark[] =>
  // pattern most-recent first: P = present, A = absent; one session per day going back
  [...pattern].map((c, i) => {
    const d = new Date(Date.parse(`${start}T00:00:00Z`) - i * 86_400_000).toISOString().slice(0, 10);
    return { date: d, present: c === "P" };
  });

const base = { unpaidMonths: [] as string[], joinedAt: new Date("2025-01-01T00:00:00Z"), today: "2026-10-28" };

describe("scoreRisk", () => {
  it("is none for a regular attender with fees paid", () => {
    const r = scoreRisk({ ...base, marks: days("PPPPPPPPPPPPPPPP") });
    expect(r.level).toBe("none");
    expect(r.reasons).toEqual([]);
  });
  it("flags a sharp drop and a streak as high", () => {
    // last 8: 2 present (25%), previous 8: all present
    const r = scoreRisk({ ...base, marks: days("AAAAAPAPPPPPPPPP") });
    expect(r.recentRate).toBeCloseTo(0.25);
    expect(r.previousRate).toBe(1);
    expect(r.absenceStreak).toBe(5);
    expect(r.signals).toEqual(["attendance", "drop", "streak"]);
    expect(r.level).toBe("high");
    expect(r.reasons[0]).toBe("Attended 2 of the last 8 sessions");
  });
  it("needs at least 4 marks before judging attendance", () => {
    const r = scoreRisk({ ...base, marks: days("AA") });
    expect(r.recentRate).toBeNull();
    expect(r.level).toBe("none");
  });
  it("counts only fees whose month has passed", () => {
    const r = scoreRisk({ ...base, marks: days("PPPPPPPP"), unpaidMonths: ["2026-10", "2026-09", "2026-08", "2026-08"] });
    expect(r.overdueMonths).toEqual(["2026-08", "2026-09"]);
    expect(r.signals).toEqual(["fees"]);
    expect(r.score).toBe(2);
    expect(r.level).toBe("low");
    expect(r.reasons[0]).toBe("Fees unpaid for Aug 26, Sep 26");
  });
  it("adds weight for new students only when another signal exists", () => {
    const joinedAt = new Date("2026-09-15T00:00:00Z");
    expect(scoreRisk({ ...base, joinedAt, marks: days("PPPPPPPP") }).level).toBe("none");
    const r = scoreRisk({ ...base, joinedAt, marks: days("PPPPAAAP") }); // most recent present; 5/8 = 62.5% → +2, new → +1
    expect(r.absenceStreak).toBe(0);
    expect(r.signals).toEqual(["attendance", "new"]);
    expect(r.score).toBe(3);
    expect(r.level).toBe("medium");
  });
});

describe("parentMessage", () => {
  const common = { parentName: "Rohit Sharma", childName: "Aarav Sharma", batchName: "U-12 Morning", academyName: "Ace Badminton" };
  it("leads with attendance and mentions fees gently", () => {
    const m = parentMessage({ ...common, signals: ["attendance", "fees"], overdueMonths: ["2026-09"] });
    expect(m).toContain("Hi Rohit, this is Ace Badminton.");
    expect(m).toContain("We've missed Aarav at U-12 Morning recently");
    expect(m).toContain("fees for Sep 26 are still pending");
    expect(m).not.toMatch(/risk|score|high/i);
  });
  it("sends a fee reminder when fees are the only issue", () => {
    const m = parentMessage({ ...common, signals: ["fees"], overdueMonths: ["2026-08", "2026-09"] });
    expect(m).toContain("fees for Aug 26, Sep 26 are still pending");
    expect(m).not.toContain("missed");
  });
});
