import { describe, it, expect } from "vitest";
import {
  buildMonthlyProgressReport,
  monthWindow,
  previousMonth,
  progressReportShareText,
  resolveReportMonth,
  ratedSkills,
} from "@/lib/progress-report";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("month helpers", () => {
  it("computes UTC month windows and previous month across a year boundary", () => {
    const w = monthWindow("2026-01");
    expect(w.start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(previousMonth("2026-01")).toBe("2025-12");
  });

  it("falls back to the current month for invalid or future input", () => {
    expect(resolveReportMonth("2026-09", "2026-10")).toBe("2026-09");
    expect(resolveReportMonth("2026-11", "2026-10")).toBe("2026-10");
    expect(resolveReportMonth("2026-13", "2026-10")).toBe("2026-10");
    expect(resolveReportMonth(undefined, "2026-10")).toBe("2026-10");
  });
});

describe("buildMonthlyProgressReport", () => {
  const enrollments = [{ batchId: "b1", joinedAt: d("2026-09-03") }];
  const sessions = [
    { id: "s0", date: d("2026-09-01"), status: "COMPLETED", batchId: "b1" }, // before joining
    { id: "s1", date: d("2026-09-05"), status: "COMPLETED", batchId: "b1" },
    { id: "s2", date: d("2026-09-07"), status: "COMPLETED", batchId: "b1" },
    { id: "s3", date: d("2026-09-09"), status: "CANCELLED", batchId: "b1" },
    { id: "s4", date: d("2026-09-11"), status: "COMPLETED", batchId: "b1" },
    { id: "s5", date: d("2026-09-13"), status: "SCHEDULED", batchId: "b1" }, // held, not marked
    { id: "s6", date: d("2026-09-15"), status: "COMPLETED", batchId: "b1" },
    { id: "s7", date: d("2026-10-01"), status: "COMPLETED", batchId: "b1" }, // other month
    { id: "s8", date: d("2026-09-20"), status: "COMPLETED", batchId: "other" }, // not enrolled
  ];
  const attendances = [
    { sessionId: "s1", isPresent: true, status: "PRESENT" },
    { sessionId: "s2", isPresent: true, status: "LATE" },
    { sessionId: "s4", isPresent: false, status: null }, // legacy absent
    { sessionId: "s6", isPresent: false, status: "EXCUSED" },
  ];

  it("buckets attendance and never counts unmarked sessions as absent", () => {
    const r = buildMonthlyProgressReport({
      month: "2026-09", now: d("2026-10-26"), sessions, attendances, enrollments, skillReports: [],
    });
    expect(r.attendance).toEqual({ held: 5, present: 1, late: 1, absent: 1, excused: 1, unmarked: 1, pct: 40 });
    expect(r.skills).toBeNull();
    expect(r.average).toBeNull();
  });

  it("does not count future sessions in the current month", () => {
    const r = buildMonthlyProgressReport({
      month: "2026-09", now: d("2026-09-08"), sessions, attendances, enrollments, skillReports: [],
    });
    expect(r.attendance.held).toBe(2);
  });

  it("reports no percentage when nothing was held", () => {
    const r = buildMonthlyProgressReport({
      month: "2026-08", now: d("2026-10-26"), sessions, attendances, enrollments, skillReports: [],
    });
    expect(r.attendance.held).toBe(0);
    expect(r.attendance.pct).toBeNull();
  });

  it("shows coach ratings with deltas against the latest earlier report", () => {
    const r = buildMonthlyProgressReport({
      month: "2026-09",
      now: d("2026-10-26"),
      sessions: [],
      attendances: [],
      enrollments,
      sport: "Cricket",
      skillReports: [
        { month: "2026-06", technique: 1, fitness: 1, discipline: 1 },
        { month: "2026-08", technique: 3, fitness: 3, discipline: 4, metrics: { batting: 3, bowling: 3, fielding: 4 } },
        { month: "2026-09", technique: 4, fitness: 3, discipline: 4, notes: " Great footwork ", metrics: { batting: 4, bowling: 3, fielding: 4, game_awareness: 5 } },
      ],
    });
    expect(r.skills?.map((s) => [s.key, s.value, s.delta])).toEqual([
      ["batting", 4, 1],
      ["bowling", 3, 0],
      ["fielding", 4, 0],
      ["game_awareness", 5, null],
    ]);
    expect(r.average).toBe(4);
    expect(r.previousAverage).toBe(3.3);
    expect(r.coachNotes).toBe("Great footwork");
  });
});

describe("ratedSkills", () => {
  it("does not invent ratings for dimensions the coach did not rate", () => {
    const lines = ratedSkills("cricket", { month: "2026-09", technique: 4, fitness: 2, discipline: 5, metrics: null });
    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.value)).toEqual([4, 2, 5]);
  });
});

describe("progressReportShareText", () => {
  it("contains figures and first name only", () => {
    const report = buildMonthlyProgressReport({
      month: "2026-09",
      now: d("2026-10-26"),
      sessions: [{ id: "s1", date: d("2026-09-05"), status: "COMPLETED", batchId: "b1" }],
      attendances: [{ sessionId: "s1", isPresent: true, status: "PRESENT" }],
      enrollments: [{ batchId: "b1", joinedAt: d("2026-01-01") }],
      skillReports: [],
    });
    const text = progressReportShareText(report, { studentName: "Aarav Mehta", academyName: "Ace Academy", monthLabel: "September 2026" });
    expect(text).toContain("Aarav — progress report, September 2026");
    expect(text).toContain("1/1 sessions (100%)");
    expect(text).toContain("Coach evaluation not submitted");
    expect(text).not.toContain("Mehta");
    expect(text).toContain("— Ace Academy");
  });
});
