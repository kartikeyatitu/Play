import { describe, it, expect } from "vitest";
import { attendedSession, calculatePoints, POINTS_RULES, skillReportBonus, validAward, type PointsAttendance } from "@/lib/athlete/points-rules";

const day = (n: number) => new Date(Date.UTC(2026, 9, 1 + n));
const P = (n: number): PointsAttendance => ({ isPresent: true, status: "PRESENT", date: day(n) });
const A = (n: number): PointsAttendance => ({ isPresent: false, status: "ABSENT", date: day(n) });

describe("points rules", () => {
  it("gives +10 per attended session and +5 from the 3rd in a row", () => {
    const b = calculatePoints([P(0), P(1), P(2), P(3)], []);
    expect(b.attendancePoints).toBe(40);
    expect(b.streakBonus).toBe(10);
    expect(b.total).toBe(50);
  });

  it("has no deduction for a missed session", () => {
    const b = calculatePoints([P(0), A(1)], []);
    expect(b.total).toBe(10);
    expect(b.sessionsMissed).toBe(1);
    expect(Object.keys(b)).not.toContain("missedPenalty");
    expect(calculatePoints([A(0), A(1), A(2)], []).total).toBe(0);
  });

  it("a missed session never lowers the total, wherever it is inserted", () => {
    const base = [P(0), P(2), P(4), P(6), A(8), P(10), P(12)];
    const reports = [{ technique: 4, fitness: 4, discipline: 5 }];
    const before = calculatePoints(base, reports).total;
    for (let at = -1; at <= 13; at++) {
      const withMiss = [...base, { isPresent: false, status: "ABSENT", date: day(at) }];
      expect(calculatePoints(withMiss, reports).total).toBeGreaterThanOrEqual(before);
    }
    // Many misses, any status, never lower than the attended-only history.
    const noisy = [...base, A(1), A(3), { isPresent: false, status: "EXCUSED", date: day(5) }, { isPresent: false, status: null, date: day(7) }];
    expect(calculatePoints(noisy, reports).total).toBe(before);
  });

  it("orders by session date (input order does not matter)", () => {
    const rows = [P(3), A(1), P(0), P(2)];
    expect(calculatePoints(rows, []).total).toBe(calculatePoints([P(0), A(1), P(2), P(3)], []).total);
  });

  it("LATE counts as attended; EXCUSED and legacy isPresent=false do not", () => {
    expect(attendedSession({ isPresent: false, status: "LATE" })).toBe(true);
    expect(attendedSession({ isPresent: true, status: "EXCUSED" })).toBe(false);
    expect(attendedSession({ isPresent: true, status: null })).toBe(true);
    expect(attendedSession({ isPresent: false })).toBe(false);
  });

  it("skill report bonus: +15 for avg >= 4, +5 for avg >= 3", () => {
    expect(skillReportBonus({ technique: 4, fitness: 4, discipline: 4 })).toBe(POINTS_RULES.skillGreat);
    expect(skillReportBonus({ technique: 3, fitness: 3, discipline: 4 })).toBe(POINTS_RULES.skillGood);
    expect(skillReportBonus({ technique: 1, fitness: 2, discipline: 3 })).toBe(0);
    expect(calculatePoints([], [{ technique: 5, fitness: 5, discipline: 5 }, { technique: 3, fitness: 3, discipline: 3 }]).total).toBe(20);
  });

  it("manual awards are positive whole numbers only", () => {
    expect(validAward(10)).toBe(10);
    expect(validAward(7.9)).toBe(7);
    expect(validAward(-5)).toBeNull();
    expect(validAward(0)).toBeNull();
    expect(validAward(Number.NaN)).toBeNull();
    expect(validAward("10")).toBeNull();
    expect(validAward(5000)).toBeNull();
  });
});
