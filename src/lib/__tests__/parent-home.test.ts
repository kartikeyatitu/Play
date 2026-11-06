import { describe, it, expect } from "vitest";
import {
  homeFeeStatus,
  latestProgressNote,
  nextSession,
  privateLeaderboard,
  scheduleTime,
  weekAttendance,
  weekRange,
} from "@/components/parent/home-summary";

// Fri 6 Nov 2026, 10:00 IST
const NOW = new Date("2026-11-06T04:30:00Z");

describe("weekRange", () => {
  it("Monday to Sunday in IST", () => {
    expect(weekRange(NOW)).toEqual({ start: "2026-11-02", end: "2026-11-08", today: "2026-11-06" });
  });
  it("Sunday night IST still belongs to the week that started Monday", () => {
    expect(weekRange(new Date("2026-11-08T18:29:00Z")).start).toBe("2026-11-02"); // Sun 23:59 IST
    expect(weekRange(new Date("2026-11-08T18:30:00Z")).start).toBe("2026-11-09"); // Mon 00:00 IST
  });
});

describe("weekAttendance", () => {
  it("counts held sessions Monday→today, excluding cancelled and future", () => {
    const sessions = [
      { id: "lastweek", date: "2026-11-01T00:00:00.000Z", status: "COMPLETED" },
      { id: "mon", date: "2026-11-02T00:00:00.000Z", status: "COMPLETED" },
      { id: "wed", date: "2026-11-04T00:00:00.000Z", status: "COMPLETED" },
      { id: "thu", date: "2026-11-05T00:00:00.000Z", status: "CANCELLED" },
      { id: "fri", date: new Date("2026-11-06T00:00:00.000Z"), status: "COMPLETED" },
      { id: "sat", date: "2026-11-07T00:00:00.000Z", status: "SCHEDULED" },
    ];
    expect(weekAttendance(sessions, ["mon", "fri", "lastweek", "thu"], NOW)).toEqual({ present: 2, total: 3 });
  });
});

describe("scheduleTime", () => {
  it.each([
    ["Mon/Wed/Fri 4:00 PM", 16 * 60, "4:00 PM"],
    ["Daily 6am", 6 * 60, "6:00 AM"],
    ["Tue 17:30", 17 * 60 + 30, "5:30 PM"],
    ["Sat 12 pm", 12 * 60, "12:00 PM"],
    ["Sun 12:15 am", 15, "12:15 AM"],
  ])("%s", (s, minutes, label) => expect(scheduleTime(s)).toEqual({ minutes, label }));
  it("no time", () => expect(scheduleTime("Weekends")).toBeNull());
});

describe("nextSession", () => {
  const batches = [
    { id: "b1", name: "U12 Cricket", schedule: "Mon/Wed/Fri 4:00 PM" },
    { id: "b2", name: "Swim", schedule: "Sat 7am" },
  ];
  it("today if its start time has not passed (IST)", () => {
    expect(nextSession(batches, [], NOW)).toEqual({ date: "2026-11-06", batchName: "U12 Cricket", time: "4:00 PM" });
  });
  it("after today's start time, the next scheduled day", () => {
    const evening = new Date("2026-11-06T12:00:00Z"); // 17:30 IST
    expect(nextSession(batches, [], evening)).toEqual({ date: "2026-11-07", batchName: "Swim", time: "7:00 AM" });
  });
  it("skips a cancelled day", () => {
    const evening = new Date("2026-11-06T12:00:00Z");
    const s = nextSession(batches, [{ batchId: "b2", date: "2026-11-07T00:00:00.000Z", status: "CANCELLED" }], evening);
    expect(s).toEqual({ date: "2026-11-09", batchName: "U12 Cricket", time: "4:00 PM" });
  });
  it("uses explicit scheduled sessions for unparseable schedules", () => {
    const s = nextSession([{ id: "b3", name: "Camp", schedule: "By arrangement" }], [{ batchId: "b3", date: "2026-11-10T00:00:00.000Z", status: "SCHEDULED" }], NOW);
    expect(s).toEqual({ date: "2026-11-10", batchName: "Camp", time: null });
  });
  it("null when nothing is known", () => {
    expect(nextSession([], [], NOW)).toBeNull();
  });
});

describe("homeFeeStatus", () => {
  it("overdue: oldest pending first, sum of pending", () => {
    const s = homeFeeStatus(
      [
        { id: "n", month: "2026-11", amount: 2000, status: "PENDING" },
        { id: "o", month: "2026-10", amount: 1500, status: "PENDING" },
        { id: "v", month: "2026-09", amount: 900, status: "PENDING_VERIFICATION" },
      ],
      NOW,
    );
    expect(s).toMatchObject({ state: "OVERDUE", dueAmount: 3500, awaitingAmount: 900, nextDueDate: "2026-10-01" });
    expect(s.payRecord?.id).toBe("o");
  });
  it("due today on the 1st is DUE, not overdue", () => {
    const first = new Date("2026-10-31T18:30:00Z"); // 1 Nov 00:00 IST
    expect(homeFeeStatus([{ id: "n", month: "2026-11", amount: 2000, status: "PENDING" }], first).state).toBe("DUE");
  });
  it("awaiting confirmation only", () => {
    const s = homeFeeStatus([{ id: "v", month: "2026-11", amount: 900, status: "PENDING_VERIFICATION" }], NOW);
    expect(s).toMatchObject({ state: "AWAITING", dueAmount: 0, payRecord: { id: "v" } });
  });
  it("clear: next due is the 1st of next month; ₹0 plan-covered rows ignored", () => {
    const s = homeFeeStatus([{ id: "c", month: "2026-11", amount: 0, status: "PENDING" }], NOW);
    expect(s).toEqual({ state: "CLEAR", dueAmount: 0, awaitingAmount: 0, nextDueDate: "2026-12-01", payRecord: null });
  });
});

describe("latestProgressNote", () => {
  it("newest month wins, note trimmed, average to one decimal", () => {
    const n = latestProgressNote([
      { month: "2026-09", notes: "old", technique: 3, fitness: 3, discipline: 3, createdAt: "2026-09-30" },
      { month: "2026-10", notes: "  Great footwork  ", technique: 4, fitness: 3, discipline: 5, createdAt: "2026-10-30" },
    ]);
    expect(n).toEqual({ month: "2026-10", note: "Great footwork", average: 4 });
  });
  it("null without reports; null note when empty", () => {
    expect(latestProgressNote([])).toBeNull();
    expect(latestProgressNote([{ month: "2026-10", notes: " ", technique: 4, fitness: 4, discipline: 5, createdAt: "2026-10-01" }])?.note).toBeNull();
  });
});

describe("privateLeaderboard", () => {
  it("never names or links another family's child", () => {
    const out = privateLeaderboard(
      [
        { id: "other1", name: "Riya Kapoor", points: 900 },
        { id: "mine", name: "Aarav Mehta", points: 800 },
        { id: "other2", name: "Kabir Shah", points: 700 },
      ],
      ["mine"],
    );
    expect(out).toEqual([
      { id: "rank-1", name: "Athlete", points: 900 },
      { id: "mine", name: "Aarav Mehta", points: 800 },
      { id: "rank-3", name: "Athlete", points: 700 },
    ]);
    expect(JSON.stringify(out)).not.toMatch(/Riya|Kabir|other/);
  });
});
