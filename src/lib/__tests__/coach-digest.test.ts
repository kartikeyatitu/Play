import { describe, expect, it } from "vitest";
import { buildCoachInsights } from "@/lib/coach-insights";
import { buildDigest } from "@/lib/digest";

describe("buildCoachInsights", () => {
  it("aggregates per coach and ignores future sessions", () => {
    const rows = buildCoachInsights({
      batches: [
        { id: "b1", coachId: "c1", coachName: "Ravi", studentIds: ["s1", "s2"] },
        { id: "b2", coachId: "c1", coachName: "Ravi", studentIds: ["s2", "s3"] },
        { id: "b3", coachId: "c2", coachName: "Anita", studentIds: ["s4"] },
      ],
      sessions: [
        { batchId: "b1", date: "2026-10-05", marked: 2, present: 2 },
        { batchId: "b2", date: "2026-10-06", marked: 2, present: 1 },
        { batchId: "b2", date: "2026-10-07", marked: 0, present: 0 },
        { batchId: "b2", date: "2026-10-30", marked: 0, present: 0 },
      ],
      evaluatedStudentIds: new Set(["s1", "s4"]),
      today: "2026-10-28",
    });
    const ravi = rows.find((r) => r.name === "Ravi")!;
    expect(ravi).toMatchObject({ batches: 2, students: 3, sessionsHeld: 3, sessionsMarked: 2, evaluated: 1 });
    expect(ravi.markedRate).toBeCloseTo(2 / 3);
    expect(ravi.attendanceRate).toBeCloseTo(0.75);
    const anita = rows.find((r) => r.name === "Anita")!;
    expect(anita).toMatchObject({ sessionsHeld: 0, markedRate: null, attendanceRate: null, evaluatedRate: 1 });
    expect(rows[0].name).toBe("Ravi");
  });
});

describe("buildDigest", () => {
  const base = {
    academyName: "Ace Badminton",
    currency: "INR",
    weekLabel: "21–27 Oct",
    thisWeek: { received: 22000, present: 300, marked: 400, enquiries: 5, newStudents: 2 },
    lastWeek: { received: 20000, present: 280, marked: 400, enquiries: 3, newStudents: 2 },
    outstanding: { amount: 48000, count: 21 },
    overdue3Plus: 4,
    risk: { high: 2, medium: 5 },
  };
  it("compares with last week and lists actions", () => {
    const d = buildDigest(base);
    expect(d.lines[0].change).toBe("▲ 10% vs last week");
    expect(d.lines[1]).toMatchObject({ value: "75%", change: "▲ 5 pts vs last week" });
    expect(d.lines[2].change).toBe("▲ 2 vs last week");
    expect(d.lines[3].change).toBe("same as last week");
    expect(d.actions[0]).toContain("2 students at high risk");
    expect(d.actions[1]).toContain("4 fees that are 3+ months late");
    expect(d.text).toContain("*Ace Badminton — week of 21–27 Oct*");
  });
  it("flags unmarked attendance and never includes names", () => {
    const d = buildDigest({ ...base, thisWeek: { ...base.thisWeek, present: 0, marked: 0 }, risk: { high: 0, medium: 0 }, overdue3Plus: 0 });
    expect(d.lines[1].value).toBe("not marked");
    expect(d.actions).toEqual(["No attendance was marked this week. Ask coaches to mark sessions in the app."]);
  });
  it("suggests referrals when nothing is urgent", () => {
    const d = buildDigest({ ...base, risk: { high: 0, medium: 0 }, overdue3Plus: 0 });
    expect(d.actions[0]).toContain("referrals");
  });
});
