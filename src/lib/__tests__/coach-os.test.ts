import { describe, expect, it } from "vitest";
import { batchWhereFor, canAssessStudent, canViewAllBatches, resolveScope } from "@/lib/coach/access";
import { compareWithPrevious, metricsOf, monthLabel, prefillScores, reportAverage, validateAssessment, NOTE_MAX } from "@/lib/coach/assessment";
import { assessmentDue, attendanceRates, buildRoster, sortRoster, type RosterRow } from "@/lib/coach/roster";
import { gridCounts, initialsOf, nextQuickStatus } from "@/lib/coach/day";
import {
  AVAILABILITY_SAVE_ENABLED,
  findOverlaps,
  formatTime12,
  isAvailable,
  normalizeSlots,
  parseAvailability,
  parseTime,
  serializeAvailability,
  slotError,
  validateWeek,
  weeklyMinutes,
} from "@/lib/coach/availability";
import { RUBRICS } from "@/lib/skill-rubrics";

const coach = { role: "COACH", status: "ACTIVE" };
const owner = { role: "OWNER", status: "ACTIVE" };
const manager = { role: "MANAGER", status: "ACTIVE" };
const receptionist = { role: "STAFF", staffRole: "RECEPTIONIST", status: "ACTIVE" };
const groundsman = { role: "STAFF", staffRole: "GROUNDSMAN", status: "ACTIVE" };

describe("access", () => {
  it("coaches assess only students in batches they coach", () => {
    expect(canAssessStudent(coach, true)).toBe(true);
    expect(canAssessStudent(coach, false)).toBe(false);
    // Even with an explicit students.manage grant, a coach stays limited to their own batches.
    expect(canAssessStudent({ ...coach, permissions: JSON.stringify({ "students.manage": true }) }, false)).toBe(false);
  });

  it("other team members need students.manage", () => {
    expect(canAssessStudent(owner, false)).toBe(true);
    expect(canAssessStudent(manager, false)).toBe(true);
    expect(canAssessStudent(receptionist, false)).toBe(true);
    expect(canAssessStudent(groundsman, false)).toBe(false);
    expect(canAssessStudent({ ...manager, permissions: JSON.stringify({ "students.manage": false }) }, false)).toBe(false);
  });

  it("inactive memberships hold nothing", () => {
    expect(canAssessStudent({ ...coach, status: "REMOVED" }, true)).toBe(false);
    expect(canAssessStudent({ ...owner, status: "INVITED" }, false)).toBe(false);
  });

  it("scope 'all' only for members allowed to see every batch", () => {
    expect(canViewAllBatches(coach)).toBe(false);
    expect(canViewAllBatches(manager)).toBe(true);
    expect(resolveScope("all", coach)).toBe("mine");
    expect(resolveScope("all", manager)).toBe("all");
    expect(resolveScope(undefined, manager)).toBe("mine");
    expect(batchWhereFor("mine", "u1", "o1")).toEqual({ orgId: "o1", coachId: "u1" });
    expect(batchWhereFor("all", "u1", "o1")).toEqual({ orgId: "o1" });
  });
});

describe("assessment validation", () => {
  const full = Object.fromEntries(RUBRICS.football.skills.map((k) => [k.key, 4]));

  it("accepts a complete rubric and fills legacy columns", () => {
    const v = validateAssessment({ studentId: " s1 ", sport: "football", scores: full, note: "  good week " });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.studentId).toBe("s1");
    expect(v.rubric.id).toBe("football");
    expect(v.note).toBe("good week");
    expect(v.legacy).toEqual({ technique: 4, fitness: 4, discipline: 4 });
  });

  it("resolves free-text sports to a rubric", () => {
    const v = validateAssessment({ studentId: "s1", sport: "Soccer", scores: full });
    expect(v.ok && v.rubric.id).toBe("football");
  });

  it("rejects missing, out-of-range and foreign scores, and long notes", () => {
    const { passing, ...partial } = full;
    void passing;
    expect(validateAssessment({ studentId: "s1", sport: "football", scores: partial })).toMatchObject({ ok: false });
    expect(validateAssessment({ studentId: "s1", sport: "football", scores: { ...full, passing: 6 } })).toMatchObject({ ok: false });
    expect(validateAssessment({ studentId: "s1", sport: "football", scores: { ...full, batting: 3 } })).toMatchObject({ ok: false });
    expect(validateAssessment({ studentId: "", sport: "football", scores: full })).toMatchObject({ ok: false });
    expect(validateAssessment({ studentId: "s1", sport: "football", scores: full, note: "x".repeat(NOTE_MAX + 1) })).toMatchObject({ ok: false });
  });
});

describe("assessment trend", () => {
  const rubric = RUBRICS.cricket;
  const base = { technique: 3, fitness: 3, discipline: 3 };

  it("compares per skill against the previous same-sport report", () => {
    const prev = { month: "2026-10", sport: "Cricket", ...base, metrics: { batting: 3, bowling: 4, fitness: 2 } };
    const t = compareWithPrevious(rubric, { batting: 4, bowling: 4, fitness: 1 }, prev);
    expect(t.sameSport).toBe(true);
    expect(t.previousMonth).toBe("2026-10");
    const by = Object.fromEntries(t.skills.map((s) => [s.key, s]));
    expect(by.batting).toMatchObject({ previous: 3, delta: 1, direction: "up" });
    expect(by.bowling).toMatchObject({ delta: 0, direction: "same" });
    expect(by.fitness).toMatchObject({ delta: -1, direction: "down" });
    expect(by.fielding.direction).toBe("new");
    expect(t.overall).toMatchObject({ current: 3, previous: 3, delta: 0, direction: "same" });
  });

  it("uses only the overall average when the previous report is another sport or legacy only", () => {
    const legacy = { month: "2026-09", sport: null, technique: 2, fitness: 2, discipline: 2, metrics: null };
    const t = compareWithPrevious(rubric, { batting: 4 }, legacy);
    expect(t.sameSport).toBe(false);
    expect(t.skills.every((s) => s.previous == null)).toBe(true);
    expect(t.overall).toMatchObject({ current: 4, previous: 2, delta: 2, direction: "up" });
  });

  it("with no previous report everything is new", () => {
    const t = compareWithPrevious(rubric, { batting: 4 }, null);
    expect(t.overall.direction).toBe("new");
    expect(t.previousMonth).toBeNull();
  });

  it("reads metrics defensively", () => {
    expect(metricsOf({ a: 3, b: "4", c: 9, d: 2 })).toEqual({ a: 3, d: 2 });
    expect(metricsOf([1, 2])).toEqual({});
    expect(reportAverage({ month: "x", sport: null, technique: 4, fitness: 2, discipline: 3, metrics: {} })).toBe(3);
  });

  it("prefills only for the same rubric", () => {
    const r = { month: "2026-11", sport: "Cricket", ...base, metrics: { batting: 5, junk: 2 } };
    expect(prefillScores("cricket", r)).toEqual({ batting: 5 });
    expect(prefillScores("football", r)).toEqual({});
    expect(prefillScores("cricket", null)).toEqual({});
  });

  it("formats months", () => {
    expect(monthLabel("2026-11")).toBe("Nov 2026");
    expect(monthLabel("bad")).toBe("");
  });
});

describe("roster", () => {
  const marks = [
    { studentId: "a", status: "PRESENT", isPresent: true },
    { studentId: "a", status: "LATE", isPresent: true },
    { studentId: "a", status: "ABSENT", isPresent: false },
    { studentId: "a", status: "EXCUSED", isPresent: false },
    { studentId: "b", status: null, isPresent: false },
    { studentId: "b", status: null, isPresent: true },
  ];

  it("attendance rate counts late as attended and leaves excused out", () => {
    const r = attendanceRates(marks);
    expect(r.get("a")).toEqual({ attended: 2, marked: 3, rate: 67 });
    expect(r.get("b")).toEqual({ attended: 1, marked: 2, rate: 50 });
    expect(r.get("c")).toBeUndefined();
  });

  it("merges athletes across batches", () => {
    const rows = buildRoster(
      [
        { id: "b1", name: "U-12", sport: "Cricket", students: [{ id: "a", name: "Zara" }, { id: "b", name: "Arjun" }] },
        { id: "b2", name: "U-14", sport: "Cricket", students: [{ id: "a", name: "Zara" }, { id: "c", name: "Meera" }] },
      ],
      marks,
      new Map([["a", "2026-10"]]),
    );
    expect(rows.map((r) => r.name)).toEqual(["Arjun", "Meera", "Zara"]);
    const zara = rows.find((r) => r.studentId === "a")!;
    expect(zara.batches.map((b) => b.id)).toEqual(["b1", "b2"]);
    expect(zara.lastAssessedMonth).toBe("2026-10");
    expect(rows.find((r) => r.studentId === "c")!.attendanceRate).toBeNull();
  });

  const row = (name: string, rate: number | null, month: string | null, batch = "B"): RosterRow => ({
    studentId: name,
    name,
    batches: [{ id: batch, name: batch, sport: "Cricket" }],
    attendanceRate: rate,
    attended: 0,
    marked: 0,
    lastAssessedMonth: month,
  });

  it("sorts with missing values last in both directions", () => {
    const rows = [row("Cara", 90, "2026-09"), row("Abe", null, null), row("Bea", 40, "2026-11")];
    expect(sortRoster(rows, "attendance", "asc").map((r) => r.name)).toEqual(["Bea", "Cara", "Abe"]);
    expect(sortRoster(rows, "attendance", "desc").map((r) => r.name)).toEqual(["Cara", "Bea", "Abe"]);
    expect(sortRoster(rows, "assessed", "asc").map((r) => r.name)).toEqual(["Cara", "Bea", "Abe"]);
    expect(sortRoster(rows, "name", "desc").map((r) => r.name)).toEqual(["Cara", "Bea", "Abe"]);
    expect(rows.map((r) => r.name)).toEqual(["Cara", "Abe", "Bea"]); // not mutated
  });

  it("ties fall back to name", () => {
    const rows = [row("Zed", 50, null, "A"), row("Amy", 50, null, "A")];
    expect(sortRoster(rows, "batch").map((r) => r.name)).toEqual(["Amy", "Zed"]);
    expect(sortRoster(rows, "attendance", "desc").map((r) => r.name)).toEqual(["Amy", "Zed"]);
  });

  it("assessment is due when older than last month", () => {
    expect(assessmentDue(null, "2026-11")).toBe(true);
    expect(assessmentDue("2026-11", "2026-11")).toBe(false);
    expect(assessmentDue("2026-10", "2026-11")).toBe(false);
    expect(assessmentDue("2026-09", "2026-11")).toBe(true);
    expect(assessmentDue("2025-12", "2026-01")).toBe(false);
    expect(assessmentDue("2025-11", "2026-01")).toBe(true);
  });
});

describe("day view", () => {
  it("initials", () => {
    expect(initialsOf("Aarav Kumar Singh")).toBe("AS");
    expect(initialsOf("priya")).toBe("PR");
    expect(initialsOf("  ")).toBe("?");
  });

  it("quick tap cycles to present, then absent", () => {
    expect(nextQuickStatus(null)).toBe("PRESENT");
    expect(nextQuickStatus("ABSENT")).toBe("PRESENT");
    expect(nextQuickStatus("EXCUSED")).toBe("PRESENT");
    expect(nextQuickStatus("PRESENT")).toBe("ABSENT");
    expect(nextQuickStatus("LATE")).toBe("ABSENT");
  });

  it("counts the grid", () => {
    expect(gridCounts([{ status: "PRESENT" }, { status: "LATE" }, { status: "ABSENT" }, { status: null }])).toEqual({ total: 4, present: 2, absent: 1, unmarked: 1 });
  });
});

describe("availability", () => {
  it("stays disabled until a storage field exists", () => {
    expect(AVAILABILITY_SAVE_ENABLED).toBe(false);
  });

  it("parses and formats times", () => {
    expect(parseTime("06:30")).toBe(390);
    expect(parseTime("24:00")).toBe(1440);
    expect(parseTime("24:30")).toBeNull();
    expect(parseTime("7pm")).toBeNull();
    expect(formatTime12(390)).toBe("6:30 AM");
    expect(formatTime12(1080)).toBe("6 PM");
    expect(formatTime12(0)).toBe("12 AM");
    expect(formatTime12(720)).toBe("12 PM");
  });

  it("rejects bad slots", () => {
    expect(slotError({ day: "Mon", start: 600, end: 600 })).not.toBeNull();
    expect(slotError({ day: "Mon", start: 610, end: 700 })).not.toBeNull();
    expect(slotError({ day: "Xyz" as never, start: 600, end: 660 })).not.toBeNull();
    expect(slotError({ day: "Mon", start: 600, end: 660 })).toBeNull();
  });

  it("merges overlapping and touching slots, sorted by day", () => {
    const merged = normalizeSlots([
      { day: "Wed", start: 600, end: 660 },
      { day: "Mon", start: 960, end: 1080 },
      { day: "Mon", start: 1080, end: 1140 },
      { day: "Mon", start: 360, end: 420 },
      { day: "Mon", start: 390, end: 450 },
    ]);
    expect(merged).toEqual([
      { day: "Mon", start: 360, end: 450 },
      { day: "Mon", start: 960, end: 1140 },
      { day: "Wed", start: 600, end: 660 },
    ]);
    expect(weeklyMinutes(merged)).toBe(90 + 180 + 60);
    expect(findOverlaps([{ day: "Mon", start: 360, end: 420 }, { day: "Mon", start: 390, end: 450 }, { day: "Mon", start: 450, end: 480 }])).toHaveLength(1);
  });

  it("validates a week and answers availability", () => {
    const res = validateWeek([{ day: "Tue", start: 960, end: 1140 }]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(isAvailable(res.slots, "Tue", 1020, 1080)).toBe(true);
    expect(isAvailable(res.slots, "Tue", 900, 1000)).toBe(false);
    expect(isAvailable(res.slots, "Wed", 1020, 1080)).toBe(false);
    expect(validateWeek([{ day: "Tue", start: 1000, end: 900 }]).ok).toBe(false);
  });

  it("round-trips the stored JSON and drops junk", () => {
    const slots = [
      { day: "Sat" as const, start: 420, end: 600 },
      { day: "Mon" as const, start: 960, end: 1080 },
    ];
    const stored = serializeAvailability(slots);
    expect(stored).toEqual({ v: 1, slots: [{ day: "Mon", start: "16:00", end: "18:00" }, { day: "Sat", start: "07:00", end: "10:00" }] });
    expect(parseAvailability(JSON.stringify(stored))).toEqual(normalizeSlots(slots));
    expect(parseAvailability({ slots: [{ day: "Mon", start: "x", end: "18:00" }, { day: "Fun", start: "07:00", end: "08:00" }, null] })).toEqual([]);
    expect(parseAvailability("not json")).toEqual([]);
    expect(parseAvailability(null)).toEqual([]);
  });
});
