import { describe, it, expect } from "vitest";
import { buildOpsCalendar, calendarRange, firstNameOnly, scheduleTimeMinutes, weekStart } from "@/lib/ops-calendar";

const batches = [
  { id: "a", name: "U-12 Cricket", sport: "Cricket", schedule: "Mon/Wed/Fri 4:00 PM", coachName: "Ravi" },
  { id: "b", name: "Morning Swim", sport: "Swimming", schedule: "Daily 6am", coachName: null },
  { id: "c", name: "Odd batch", sport: "Tennis", schedule: "whenever the coach is free", coachName: null },
];

describe("scheduleTimeMinutes", () => {
  it("reads 12h and 24h times", () => {
    expect(scheduleTimeMinutes("Mon/Wed 4:00 PM")).toBe(960);
    expect(scheduleTimeMinutes("Daily 6am")).toBe(360);
    expect(scheduleTimeMinutes("Tue 12 am")).toBe(0);
    expect(scheduleTimeMinutes("Sat 17:30")).toBe(1050);
    expect(scheduleTimeMinutes("Weekends")).toBeNull();
  });
});

describe("calendarRange / weekStart", () => {
  it("clamps days and validates the start", () => {
    expect(calendarRange("2026-11-02", 100)).toEqual({ start: "2026-11-02", days: 31 });
    expect(calendarRange("2026-11-02", "x")).toEqual({ start: "2026-11-02", days: 7 });
    expect(calendarRange("02/11/2026", 7)).toBeNull();
  });
  it("finds the Monday of a week", () => {
    expect(weekStart("2026-11-05")).toBe("2026-11-02");
    expect(weekStart("2026-11-08")).toBe("2026-11-02");
    expect(weekStart("2026-11-02")).toBe("2026-11-02");
  });
});

describe("buildOpsCalendar", () => {
  const r = buildOpsCalendar({
    start: "2026-11-02", // Monday
    days: 3,
    batches,
    sessions: [{ batchId: "a", date: "2026-11-02", status: "COMPLETED", marked: 10, present: 8 }],
    trials: [{ id: "t1", batchId: "a", date: "2026-11-04", status: "SCHEDULED", childFirstName: "Aarav" }],
    holidays: [{ date: "2026-11-03", title: "Local holiday" }],
    allocations: [{ batchId: "a", facilityName: "Turf 1", date: "2026-11-04", startHour: 16, endHour: 18, status: "CONFIRMED" }],
  });

  it("replaces the plan with the recorded session and sorts by time", () => {
    const mon = r.days[0];
    expect(mon.weekday).toBe("Mon");
    expect(mon.items.map((i) => i.kind)).toEqual(["PLANNED", "SESSION"]); // swim 6am, cricket 4pm recorded
    const s = mon.items[1];
    expect(s.kind === "SESSION" && s.present).toBe(8);
  });

  it("marks planned occurrences on holidays", () => {
    const tue = r.days[1];
    expect(tue.holidays).toEqual(["Local holiday"]);
    expect(tue.items).toHaveLength(1);
    expect(tue.items[0].kind === "PLANNED" && tue.items[0].onHoliday).toBe(true);
  });

  it("includes trials and allocations on their day", () => {
    const wed = r.days[2];
    expect(wed.items.map((i) => i.kind).sort()).toEqual(["ALLOCATION", "PLANNED", "PLANNED", "TRIAL"]);
  });

  it("never places an unparseable schedule on a day", () => {
    expect(r.unscheduledBatches.map((b) => b.id)).toEqual(["c"]);
    for (const d of r.days) expect(d.items.some((i) => "batchId" in i && i.batchId === "c")).toBe(false);
  });
});

describe("firstNameOnly", () => {
  it("drops surnames", () => {
    expect(firstNameOnly("Aarav Sharma")).toBe("Aarav");
    expect(firstNameOnly("  ")).toBe("Child");
  });
});
