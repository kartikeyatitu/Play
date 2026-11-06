import { describe, expect, it } from "vitest";
import {
  MAX_PLAN_ITEMS,
  addDays,
  buildPlanNotes,
  checkPlanTime,
  cleanPlanItems,
  moveItem,
  parseDay,
  parsePlanNotes,
  pickLastWeekPlan,
  totalMinutes,
} from "@/lib/body/plans";

describe("cleanPlanItems", () => {
  it("normalises items and numbers the order", () => {
    const { items, error } = cleanPlanItems(
      JSON.stringify([
        { title: "  Warm   up ", durationMin: 10.4 },
        { title: "", durationMin: 5 },
        { title: "Rondo", durationMin: 12, drillId: "clxyz1234567890abcdef", notes: "two touch" },
        { title: "Bad id", durationMin: 5, drillId: "'; drop table" },
      ]),
    );
    expect(error).toBeUndefined();
    expect(items).toEqual([
      { drillId: null, title: "Warm up", durationMin: 10, notes: null, order: 0 },
      { drillId: "clxyz1234567890abcdef", title: "Rondo", durationMin: 12, notes: "two touch", order: 1 },
      { drillId: null, title: "Bad id", durationMin: 5, notes: null, order: 2 },
    ]);
  });

  it("rejects bad JSON, bad durations and too many items", () => {
    expect(cleanPlanItems("{nope").error).toBeTruthy();
    expect(cleanPlanItems({}).error).toBeTruthy();
    expect(cleanPlanItems([{ title: "x", durationMin: 0 }]).error).toMatch(/duration/);
    expect(cleanPlanItems([{ title: "x", durationMin: 500 }]).error).toMatch(/duration/);
    const many = Array.from({ length: MAX_PLAN_ITEMS + 1 }, () => ({ title: "x", durationMin: 1 }));
    expect(cleanPlanItems(many).error).toMatch(/at most/);
  });
});

describe("time check", () => {
  const items = [{ durationMin: 15 }, { durationMin: 20 }, { durationMin: 20 }];
  it("totals minutes", () => {
    expect(totalMinutes(items)).toBe(55);
    expect(totalMinutes([{ durationMin: null }, { durationMin: 5 }])).toBe(5);
  });
  it("classifies under / fits / over", () => {
    expect(checkPlanTime(items, 60).status).toBe("fits");
    expect(checkPlanTime(items, 55).text).toMatch(/^Fits the 55-minute session\.$/);
    expect(checkPlanTime(items, 90).status).toBe("under");
    const over = checkPlanTime(items, 45);
    expect(over.status).toBe("over");
    expect(over.diff).toBe(10);
  });
});

describe("moveItem", () => {
  it("moves within bounds only", () => {
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    const same = ["a", "b"];
    expect(moveItem(same, 0, -1)).toBe(same);
    expect(moveItem(same, 1, 1)).toBe(same);
  });
});

describe("plan notes carry the session length", () => {
  it("round-trips", () => {
    const n = buildPlanNotes(90, "Bring bibs");
    expect(n).toBe("[length:90] Bring bibs");
    expect(parsePlanNotes(n)).toEqual({ sessionMinutes: 90, text: "Bring bibs" });
    expect(parsePlanNotes(buildPlanNotes(75, ""))).toEqual({ sessionMinutes: 75, text: "" });
  });
  it("defaults and clamps", () => {
    expect(parsePlanNotes(null)).toEqual({ sessionMinutes: 60, text: "" });
    expect(parsePlanNotes("old free text")).toEqual({ sessionMinutes: 60, text: "old free text" });
    expect(buildPlanNotes(5000, "")).toBe("[length:300]");
    expect(buildPlanNotes(NaN, "")).toBe("[length:60]");
  });
});

describe("copy last week's plan", () => {
  const target = parseDay("2026-11-10")!; // a Tuesday
  const p = (id: string, date: string | null, updated = "2026-11-01") => ({ id, date: date ? parseDay(date) : null, updatedAt: parseDay(updated)! });

  it("prefers the same weekday last week", () => {
    const plans = [p("thu", "2026-11-05"), p("tue", "2026-11-03"), p("sun", "2026-11-08")];
    expect(pickLastWeekPlan(plans, target)!.id).toBe("tue");
  });
  it("otherwise picks the most recent in the 7 days before", () => {
    expect(pickLastWeekPlan([p("thu", "2026-11-05"), p("sun", "2026-11-08")], target)!.id).toBe("sun");
  });
  it("ignores undated, same-day, future and older plans", () => {
    expect(pickLastWeekPlan([p("none", null), p("today", "2026-11-10"), p("old", "2026-11-02"), p("next", "2026-11-12")], target)).toBeNull();
  });
  it("parses only real calendar days", () => {
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("nope")).toBeNull();
    expect(addDays(target, -7).toISOString().slice(0, 10)).toBe("2026-11-03");
  });
});
