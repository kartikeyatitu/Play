import { describe, expect, it } from "vitest";
import { needsYou, planToday, scheduleRange, sessionPhase, type PhasedSession } from "@/lib/coach-today";

describe("scheduleRange", () => {
  it("parses shared and separate AM/PM", () => {
    expect(scheduleRange("Mon, Wed 06:30 - 08:00 AM")).toEqual({ start: 390, end: 480 });
    expect(scheduleRange("5 - 6:30 PM")).toEqual({ start: 1020, end: 1110 });
    expect(scheduleRange("11:00 AM - 1:00 PM")).toEqual({ start: 660, end: 780 });
    expect(scheduleRange("11 - 1 PM")).toEqual({ start: 660, end: 780 });
    expect(scheduleRange("12 - 1 PM")).toEqual({ start: 720, end: 780 });
  });
  it("treats a single time as one hour and rejects junk", () => {
    expect(scheduleRange("Daily 6 PM")).toEqual({ start: 1080, end: 1140 });
    expect(scheduleRange("TBD")).toBeNull();
    expect(scheduleRange(null)).toBeNull();
  });
});

describe("sessionPhase", () => {
  const r = { start: 360, end: 420 }; // 6–7 AM
  it("uses the clock only when nothing is marked", () => {
    expect(sessionPhase({ cancelled: false, marked: 0, total: 10, range: r, nowMinutes: 300 })).toBe("upcoming");
    expect(sessionPhase({ cancelled: false, marked: 0, total: 10, range: r, nowMinutes: 380 })).toBe("now");
    expect(sessionPhase({ cancelled: false, marked: 0, total: 10, range: r, nowMinutes: 900 })).toBe("unmarked");
  });
  it("respects marks and cancellation", () => {
    expect(sessionPhase({ cancelled: false, marked: 4, total: 10, range: r, nowMinutes: 900 })).toBe("in_progress");
    expect(sessionPhase({ cancelled: false, marked: 10, total: 10, range: r, nowMinutes: 380 })).toBe("done");
    expect(sessionPhase({ cancelled: true, marked: 0, total: 10, range: r, nowMinutes: 380 })).toBe("cancelled");
  });
});

describe("planToday", () => {
  const s = (id: string, phase: PhasedSession<string>["phase"], start: number): PhasedSession<string> => ({ item: id, phase, range: { start, end: start + 60 } });
  it("puts the next upcoming session first in the afternoon, not the missed morning one", () => {
    // The screenshot case: 6 AM swim unmarked, 6:30 AM cricket unmarked, 5 PM football upcoming, at 2:30 PM.
    const p = planToday([s("swim", "unmarked", 360), s("cricket", "unmarked", 390), s("football", "upcoming", 1020)]);
    expect(p.hero?.item).toBe("football");
    expect(p.unmarked.map((x) => x.item)).toEqual(["swim", "cricket"]);
    expect(p.upcoming).toEqual([]);
  });
  it("prefers a live session, then falls back to the latest unmarked", () => {
    expect(planToday([s("a", "upcoming", 1000), s("b", "now", 900)]).hero?.item).toBe("b");
    const late = planToday([s("a", "unmarked", 360), s("b", "unmarked", 600), s("c", "done", 700)]);
    expect(late.hero?.item).toBe("b");
    expect(late.unmarked.map((x) => x.item)).toEqual(["a"]);
    expect(late.done.map((x) => x.item)).toEqual(["c"]);
  });
  it("handles an empty day", () => {
    expect(planToday([]).hero).toBeNull();
  });
});

describe("needsYou", () => {
  it("lists only what needs action, with links", () => {
    const items = needsYou({ unmarkedToday: 2, evaluationsDue: 5, evaluationsTotal: 20, dayOfMonth: 26, atRiskHigh: 1, atRiskMedium: 2, parentsNotOnApp: 0, scopeQuery: "" });
    expect(items.map((i) => i.key)).toEqual(["unmarked", "risk", "evals"]);
    expect(items[0]).toMatchObject({ label: "2 sessions not marked", tone: "warn", href: "/coach?tab=today#not-marked" });
    expect(items[2].tone).toBe("warn");
  });
  it("holds evaluations until mid-month and keeps the scope in links", () => {
    const items = needsYou({ unmarkedToday: 0, evaluationsDue: 5, evaluationsTotal: 20, dayOfMonth: 5, atRiskHigh: 0, atRiskMedium: 0, parentsNotOnApp: 3, scopeQuery: "&scope=all" });
    expect(items.map((i) => i.key)).toEqual(["parents"]);
    expect(items[0].href).toBe("/coach?tab=today&scope=all#invite-parents");
  });
});

import { absentMessage } from "@/lib/coach-today";
describe("absentMessage", () => {
  it("uses first names and the batch", () => {
    expect(absentMessage({ parentName: "Rohit Sharma", childName: "Aarav Sharma", batchName: "U-12 Morning", coachName: "Coach Ravi Kumar" }))
      .toBe("Hi Rohit, this is Coach Ravi. We missed Aarav at U-12 Morning today. Hope all is well. See you at the next session!");
  });
});
