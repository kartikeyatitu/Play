import { describe, it, expect } from "vitest";
import { buildOpsCalendar, calendarRange, filterCalendar, firstNameOnly, scheduleTimeMinutes, weekStart } from "@/lib/ops-calendar";
import { orgDateParts } from "@/lib/i18n";

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

describe("unified calendar: bookings, conflicts, filters", () => {
  const coachBatches = [
    { id: "a", name: "U-12 Cricket", sport: "Cricket", schedule: "Mon 4:00 PM", coachName: "Ravi", coachId: "c1", branchName: "North" },
    { id: "b", name: "U-16 Cricket", sport: "Cricket", schedule: "Mon 4:30 PM", coachName: "Ravi", coachId: "c1", branchName: "South" },
    { id: "s", name: "Swim", sport: "Swimming", schedule: "Mon 4:00 PM", coachName: "Meera", coachId: "c2", branchName: "North" },
  ];
  const build = (overrides: Partial<Parameters<typeof buildOpsCalendar>[0]> = {}) =>
    buildOpsCalendar({
      start: "2026-11-02",
      days: 1,
      batches: coachBatches,
      sessions: [],
      trials: [],
      holidays: [],
      allocations: [],
      bookings: [],
      ...overrides,
    });

  it("flags a coach running two overlapping batches (assumed 60 min)", () => {
    const r = build();
    const items = r.days[0].items;
    const a = items.find((i) => i.kind === "PLANNED" && i.batchId === "a")!;
    const b = items.find((i) => i.kind === "PLANNED" && i.batchId === "b")!;
    const s = items.find((i) => i.kind === "PLANNED" && i.batchId === "s")!;
    expect(a.conflicts[0]).toMatchObject({ type: "COACH", label: "Coach clash with U-16 Cricket" });
    expect(b.conflicts[0]).toMatchObject({ type: "COACH" });
    expect(s.conflicts).toEqual([]); // different coach, same time
    expect(r.conflictCount).toBe(2);
  });

  it("uses the court allocation interval instead of the assumed duration", () => {
    // Batch a allocated 14:00–16:00 → ends before b starts at 16:30: no clash.
    const r = build({ allocations: [{ batchId: "a", facilityName: "Turf 1", facilityId: "f1", date: "2026-11-02", startHour: 14, endHour: 16, status: "CONFIRMED" }] });
    expect(r.days[0].items.every((i) => i.conflicts.length === 0)).toBe(true);
  });

  it("does not count a cancelled session as a coach clash", () => {
    const r = build({ sessions: [{ batchId: "b", date: "2026-11-02", status: "CANCELLED", marked: 0, present: 0 }] });
    const a = r.days[0].items.find((i) => i.kind === "PLANNED" && i.batchId === "a")!;
    expect(a.conflicts).toEqual([]);
  });

  it("flags overlapping bookings on one court but not on different courts or cancelled", () => {
    const r = build({
      batches: [],
      bookings: [
        { id: "k1", facilityId: "f1", facilityName: "Turf 1", date: "2026-11-02", startMinutes: 1080, endMinutes: 1200, kind: "BOOKING", status: "CONFIRMED", customerFirstName: "Amit" },
        { id: "k2", facilityId: "f1", facilityName: "Turf 1", date: "2026-11-02", startMinutes: 1140, endMinutes: 1260, kind: "BLOCK", status: "CONFIRMED", customerFirstName: null },
        { id: "k3", facilityId: "f2", facilityName: "Turf 2", date: "2026-11-02", startMinutes: 1080, endMinutes: 1200, kind: "LEASE", status: "CONFIRMED", customerFirstName: "Club" },
        { id: "k4", facilityId: "f1", facilityName: "Turf 1", date: "2026-11-02", startMinutes: 1200, endMinutes: 1260, kind: "BOOKING", status: "PAID_CONFLICT", customerFirstName: "Raj" },
      ],
    });
    const byId = (id: string) => r.days[0].items.find((i) => i.kind === "BOOKING" && i.id === id)!;
    expect(byId("k1").conflicts.map((c) => c.label)).toEqual(["Court clash with a maintenance block"]);
    expect(byId("k2").conflicts.map((c) => c.label).sort()).toEqual(["Court clash with a booking"]);
    expect(byId("k3").conflicts).toEqual([]);
    expect(byId("k4").conflicts).toHaveLength(1); // touches k1 end-to-start (no clash), overlaps the block
    expect(r.filters.facilities.map((f) => f.name)).toEqual(["Turf 1", "Turf 2"]);
  });

  it("flags a batch allocation overlapping a customer booking", () => {
    const r = build({
      allocations: [{ batchId: "s", facilityName: "Pool", facilityId: "p1", date: "2026-11-02", startHour: 16, endHour: 17, status: "CONFIRMED" }],
      bookings: [{ id: "k1", facilityId: "p1", facilityName: "Pool", date: "2026-11-02", startMinutes: 990, endMinutes: 1050, kind: "BOOKING", status: "HOLD", customerFirstName: "Neha" }],
    });
    const alloc = r.days[0].items.find((i) => i.kind === "ALLOCATION")!;
    expect(alloc.conflicts[0].label).toBe("Court clash with a booking");
  });

  it("filters by coach, sport, branch and court while keeping conflict markers", () => {
    const r = build({
      allocations: [{ batchId: "s", facilityName: "Pool", facilityId: "p1", date: "2026-11-02", startHour: 16, endHour: 17, status: "CONFIRMED" }],
      bookings: [{ id: "k1", facilityId: "p1", facilityName: "Pool", date: "2026-11-02", startMinutes: 600, endMinutes: 660, kind: "BOOKING", status: "CONFIRMED", customerFirstName: "Neha" }],
    });
    const ids = (f: Parameters<typeof filterCalendar>[1]) =>
      filterCalendar(r.days, f)[0].items.map((i) => (i.kind === "BOOKING" ? i.id : `${i.kind}:${"batchId" in i ? i.batchId : ""}`)).sort();
    expect(ids({ coachId: "c1" })).toEqual(["PLANNED:a", "PLANNED:b"]);
    expect(ids({ branch: "North" })).toEqual(["PLANNED:a", "PLANNED:s"].concat(["ALLOCATION:s"]).sort());
    expect(ids({ sport: "Swimming" })).toEqual(["ALLOCATION:s", "PLANNED:s"]);
    expect(ids({ facilityId: "p1" })).toEqual(["ALLOCATION:s", "PLANNED:s", "k1"]);
    expect(filterCalendar(r.days, {})).toBe(r.days);
    const a = filterCalendar(r.days, { branch: "North" })[0].items.find((i) => i.kind === "PLANNED" && i.batchId === "a")!;
    expect(a.conflicts).toHaveLength(1); // its clash partner (branch South) is hidden, the marker stays
    expect(r.filters.coaches).toEqual([{ id: "c2", name: "Meera" }, { id: "c1", name: "Ravi" }].sort((x, y) => x.name.localeCompare(y.name)));
    expect(r.filters.branches).toEqual(["North", "South"]);
  });
});

describe("orgDateParts (timezone bucketing)", () => {
  it("places a UTC instant on the org's local day", () => {
    const instant = new Date("2026-11-02T20:00:00Z");
    expect(orgDateParts(instant, { timezone: "Asia/Kolkata" })).toEqual({ date: "2026-11-03", minutes: 90 });
    expect(orgDateParts(instant, { timezone: "America/New_York" })).toEqual({ date: "2026-11-02", minutes: 15 * 60 });
    expect(orgDateParts(instant, { timezone: "Not/AZone" })).toEqual({ date: "2026-11-02", minutes: 1200 });
    expect(orgDateParts(instant, null).date).toBe("2026-11-03"); // default Asia/Kolkata
  });
});
