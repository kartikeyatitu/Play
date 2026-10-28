import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  buildTrends,
  feeAgeing,
  lastNMonths,
  monthLabel,
  monthsBehind,
  pctChange,
  pointChange,
  startOfDayInZone,
  tzOffsetMinutes,
} from "@/lib/insights";

describe("months", () => {
  it("steps across year boundaries", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-11", 3)).toBe("2027-02");
  });
  it("lists the last N months oldest first", () => {
    expect(lastNMonths("2026-02", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
    expect(lastNMonths("2026-10", 12)).toHaveLength(12);
    expect(lastNMonths("2026-10", 12)[0]).toBe("2025-11");
  });
  it("counts months behind", () => {
    expect(monthsBehind("2026-10", "2026-10")).toBe(0);
    expect(monthsBehind("2025-12", "2026-02")).toBe(2);
    expect(monthsBehind("2026-11", "2026-10")).toBe(-1);
  });
  it("labels months", () => {
    expect(monthLabel("2026-10")).toBe("Oct 26");
  });
});

describe("feeAgeing", () => {
  it("buckets unpaid fees by months late and ignores future or bad months", () => {
    const b = feeAgeing(
      [
        { month: "2026-10", amount: 2000 },
        { month: "2026-09", amount: 1500 },
        { month: "2026-08", amount: 1000 },
        { month: "2026-07", amount: 500 },
        { month: "2025-01", amount: 250 },
        { month: "2026-11", amount: 9999 },
        { month: "garbage", amount: 9999 },
      ],
      "2026-10",
    );
    expect(b.map((x) => [x.key, x.amount, x.count])).toEqual([
      ["current", 2000, 1],
      ["m1", 1500, 1],
      ["m2", 1000, 1],
      ["m3plus", 750, 2],
    ]);
  });
});

describe("buildTrends", () => {
  it("aggregates billed, collected, students and rates per month", () => {
    const t = buildTrends({
      months: ["2026-09", "2026-10"],
      fees: [
        { month: "2026-09", amount: 1000, status: "PAID" },
        { month: "2026-09", amount: 1000, status: "PENDING" },
        { month: "2026-10", amount: 1500, status: "PAID" },
        { month: "2026-08", amount: 999, status: "PAID" },
      ],
      receivedByMonth: new Map([["2026-10", 2500]]),
      newStudentsByMonth: new Map([["2026-09", 3]]),
      attendanceByMonth: new Map([["2026-09", { present: 30, marked: 40 }], ["2026-10", { present: 0, marked: 0 }]]),
    });
    expect(t[0]).toMatchObject({ billed: 2000, collected: 1000, studentsBilled: 2, newStudents: 3, attendanceRate: 0.75, collectionRate: 0.5, received: 0 });
    expect(t[1]).toMatchObject({ billed: 1500, collected: 1500, studentsBilled: 1, attendanceRate: null, received: 2500, label: "Oct 26" });
  });
});

describe("changes", () => {
  it("computes relative and point changes safely", () => {
    expect(pctChange(110, 100)).toBeCloseTo(0.1);
    expect(pctChange(5, 0)).toBeNull();
    expect(pctChange(null, 5)).toBeNull();
    expect(pointChange(0.8, 0.75)).toBeCloseTo(0.05);
    expect(pointChange(null, 0.5)).toBeNull();
  });
});

describe("time zones", () => {
  it("finds IST midnight as 18:30 UTC the previous day", () => {
    expect(tzOffsetMinutes(new Date("2026-10-28T00:00:00Z"), "Asia/Kolkata")).toBe(330);
    expect(startOfDayInZone("2026-10-28", "Asia/Kolkata").toISOString()).toBe("2026-10-27T18:30:00.000Z");
  });
  it("handles zones behind UTC and DST", () => {
    expect(startOfDayInZone("2026-07-01", "America/New_York").toISOString()).toBe("2026-07-01T04:00:00.000Z");
    expect(startOfDayInZone("2026-12-01", "America/New_York").toISOString()).toBe("2026-12-01T05:00:00.000Z");
  });
  it("adds days across month ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
