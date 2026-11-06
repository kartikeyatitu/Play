import { describe, expect, it } from "vitest";
import { roundRobinDraw } from "@/lib/competition/round-robin";
import { knockoutDraw } from "@/lib/competition/knockout";
import { groupStageDraw } from "@/lib/competition/groups";
import { matchDates, scheduleFixtures, validateScheduleOptions, type ScheduleFixture, type ScheduleOptions } from "@/lib/competition/schedule";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `e${i + 1}`);
const withIds = <T extends { round: number; slot: number }>(fs: T[]) => fs.map((f) => ({ ...f, id: `f${f.round}-${f.slot}` })) as (T & { id: string })[];
const base: ScheduleOptions = { startDate: "2026-11-07", slotsPerDay: 4, firstSlotTime: "09:00", slotMinutes: 60, courts: 2 };

function slotKey(s: { date: string; time: string }) {
  return `${s.date}T${s.time}`;
}

function assertNoClash(fixtures: ScheduleFixture[], slots: { fixtureId: string; date: string; time: string; court: number }[], courts: number) {
  const byId = new Map(fixtures.map((f) => [f.id, f]));
  const perSlot = new Map<string, string[]>();
  const courtsPerSlot = new Map<string, number[]>();
  for (const s of slots) {
    const f = byId.get(s.fixtureId)!;
    const k = slotKey(s);
    perSlot.set(k, [...(perSlot.get(k) ?? []), ...[f.homeEntryId, f.awayEntryId].filter((x): x is string => !!x)]);
    courtsPerSlot.set(k, [...(courtsPerSlot.get(k) ?? []), s.court]);
  }
  for (const entries of perSlot.values()) expect(new Set(entries).size).toBe(entries.length);
  for (const cs of courtsPerSlot.values()) {
    expect(new Set(cs).size).toBe(cs.length);
    expect(Math.max(...cs)).toBeLessThanOrEqual(courts);
  }
}

describe("matchDates", () => {
  it("walks forward on allowed weekdays only", () => {
    // 2026-11-07 is a Saturday.
    expect(matchDates("2026-11-07", 4, [0, 6])).toEqual(["2026-11-07", "2026-11-08", "2026-11-14", "2026-11-15"]);
    expect(matchDates("2026-11-07", 3)).toEqual(["2026-11-07", "2026-11-08", "2026-11-09"]);
    expect(matchDates("2026-11-07", 2, [])).toEqual(["2026-11-07", "2026-11-08"]);
  });
});

describe("validateScheduleOptions", () => {
  it("rejects bad input", () => {
    expect(validateScheduleOptions({ ...base, startDate: "07/11/2026" })).toMatch(/start date/);
    expect(validateScheduleOptions({ ...base, courts: 0 })).toMatch(/Courts/);
    expect(validateScheduleOptions({ ...base, slotsPerDay: 0 })).toMatch(/Slots/);
    expect(validateScheduleOptions({ ...base, firstSlotTime: "9am" })).toMatch(/HH:mm/);
    expect(validateScheduleOptions({ ...base, firstSlotTime: "22:00", slotsPerDay: 4, slotMinutes: 60 })).toMatch(/midnight/);
    expect(validateScheduleOptions({ ...base, weekdays: [7] })).toMatch(/Weekdays/);
    expect(validateScheduleOptions({ ...base, days: 0 })).toMatch(/Match days/);
    expect(validateScheduleOptions(base)).toBeNull();
  });
});

describe("scheduleFixtures", () => {
  it("empty input schedules nothing", () => {
    expect(scheduleFixtures([], base)).toEqual({ ok: true, slots: [], matchDays: 0, lastDate: null });
  });

  it("round robin: every fixture placed once, nobody twice in a slot, courts within limit", () => {
    for (const [n, courts] of [[6, 2], [8, 3], [7, 1], [10, 4]] as const) {
      const fixtures = withIds(roundRobinDraw(ids(n)).fixtures);
      const r = scheduleFixtures(fixtures, { ...base, courts });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.slots.map((s) => s.fixtureId).sort()).toEqual(fixtures.map((f) => f.id).sort());
      assertNoClash(fixtures, r.slots, courts);
    }
  });

  it("each entry's fixtures stay in round order", () => {
    const fixtures = withIds(roundRobinDraw(ids(6)).fixtures);
    const r = scheduleFixtures(fixtures, { ...base, courts: 3 });
    if (!r.ok) throw new Error(r.error);
    const at = new Map(r.slots.map((s) => [s.fixtureId, slotKey(s)]));
    for (const e of ids(6)) {
      const mine = fixtures.filter((f) => f.homeEntryId === e || f.awayEntryId === e).sort((a, b) => a.round - b.round);
      const times = mine.map((f) => at.get(f.id)!);
      expect([...times].sort()).toEqual(times);
    }
  });

  it("packs a 4-team league with 2 courts into one slot per round", () => {
    const fixtures = withIds(roundRobinDraw(ids(4)).fixtures);
    const r = scheduleFixtures(fixtures, { ...base, courts: 2, slotsPerDay: 3 });
    if (!r.ok) throw new Error(r.error);
    expect(r.matchDays).toBe(1);
    expect(new Set(r.slots.map((s) => s.time))).toEqual(new Set(["09:00", "10:00", "11:00"]));
    expect(r.slots.filter((s) => s.time === "09:00").map((s) => s.court).sort()).toEqual([1, 2]);
  });

  it("knockout: a round starts only after the previous round is over", () => {
    const fixtures = withIds(knockoutDraw(ids(8)).fixtures);
    const r = scheduleFixtures(fixtures, { ...base, courts: 8, knockout: true });
    if (!r.ok) throw new Error(r.error);
    const timeOf = (round: number) => r.slots.filter((s) => s.fixtureId.startsWith(`f${round}-`)).map(slotKey);
    expect(new Set(timeOf(1)).size).toBe(1);
    expect(timeOf(2).every((t) => t > timeOf(1)[0])).toBe(true);
    expect(timeOf(3).every((t) => timeOf(2).every((u) => t > u))).toBe(true);
  });

  it("group draw: knockout waits for every group fixture", () => {
    const d = groupStageDraw(ids(8), { groups: 2, advance: 2 });
    if (!d.ok) throw new Error(d.error);
    const fixtures = withIds(d.draw.fixtures);
    const r = scheduleFixtures(fixtures, { ...base, courts: 4 });
    if (!r.ok) throw new Error(r.error);
    const isKo = (id: string) => /^f2\d\d-/.test(id);
    const group = r.slots.filter((s) => !isKo(s.fixtureId));
    const ko = r.slots.filter((s) => isKo(s.fixtureId));
    expect(ko).toHaveLength(3);
    const lastGroup = group.map(slotKey).sort().pop()!;
    expect(ko.every((s) => slotKey(s) > lastGroup)).toBe(true);
    assertNoClash(fixtures, r.slots, 4);
  });

  it("rolls onto the next allowed weekday and formats times", () => {
    const fixtures = withIds(roundRobinDraw(ids(4)).fixtures);
    const r = scheduleFixtures(fixtures, { ...base, courts: 1, slotsPerDay: 2, slotMinutes: 90, firstSlotTime: "16:30", weekdays: [6] });
    if (!r.ok) throw new Error(r.error);
    expect(r.matchDays).toBe(3);
    expect([...new Set(r.slots.map((s) => s.date))]).toEqual(["2026-11-07", "2026-11-14", "2026-11-21"]);
    expect([...new Set(r.slots.map((s) => s.time))].sort()).toEqual(["16:30", "18:00"]);
    expect(r.lastDate).toBe("2026-11-21");
  });

  it("refuses when the fixtures don't fit the available days", () => {
    const fixtures = withIds(roundRobinDraw(ids(8)).fixtures);
    const r = scheduleFixtures(fixtures, { ...base, courts: 1, slotsPerDay: 2, days: 3 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/need \d+ match days/);
  });

  it("uses court names when given", () => {
    const fixtures = withIds(roundRobinDraw(ids(4)).fixtures);
    const r = scheduleFixtures(fixtures, { ...base, courts: 2, courtNames: ["Main", ""] });
    if (!r.ok) throw new Error(r.error);
    expect(new Set(r.slots.map((s) => s.courtName))).toEqual(new Set(["Main", "Court 2"]));
  });

  it("is deterministic regardless of input order", () => {
    const fixtures = withIds(roundRobinDraw(ids(9)).fixtures);
    const a = scheduleFixtures(fixtures, base);
    const b = scheduleFixtures([...fixtures].reverse(), base);
    expect(a).toEqual(b);
  });
});
