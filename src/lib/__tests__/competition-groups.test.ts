import { describe, expect, it } from "vitest";
import { groupStageDraw, knockoutQualifierOrder, seedKnockoutPhase, splitIntoGroups, validateGroupOptions } from "@/lib/competition/groups";
import { firstRoundSeedPairs } from "@/lib/competition/knockout";
import { advanceFromRound, groupDrawShape, groupOfSlot, isKnockoutPhaseRound, knockoutRoundIndex } from "@/lib/competition/phase";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `s${i + 1}`);

describe("splitIntoGroups", () => {
  it("snake-seeds so top seeds are spread", () => {
    expect(splitIntoGroups(ids(8), 2)).toEqual([
      ["s1", "s4", "s5", "s8"],
      ["s2", "s3", "s6", "s7"],
    ]);
    expect(splitIntoGroups(ids(12), 4).map((g) => g[0])).toEqual(["s1", "s2", "s3", "s4"]);
    expect(splitIntoGroups(ids(12), 4).map((g) => g[1])).toEqual(["s8", "s7", "s6", "s5"]);
  });

  it("group sizes differ by at most one and keep every entry once", () => {
    for (const [n, g] of [[10, 3], [13, 4], [7, 2], [33, 8]] as const) {
      const groups = splitIntoGroups(ids(n), g);
      const sizes = groups.map((x) => x.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
      expect(groups.flat().sort()).toEqual(ids(n).sort());
    }
  });
});

describe("validateGroupOptions", () => {
  it("rejects impossible shapes", () => {
    expect(validateGroupOptions(8, { groups: 1, advance: 1 }).ok).toBe(false);
    expect(validateGroupOptions(8, { groups: 17, advance: 1 }).ok).toBe(false);
    expect(validateGroupOptions(5, { groups: 3, advance: 1 }).ok).toBe(false); // a group of 1
    expect(validateGroupOptions(8, { groups: 4, advance: 2 }).ok).toBe(false); // top 2 of 2
    expect(validateGroupOptions(8, { groups: 2, advance: 0 }).ok).toBe(false);
    expect(validateGroupOptions(8, { groups: 2, advance: 1.5 }).ok).toBe(false);
  });
  it("accepts sensible shapes", () => {
    expect(validateGroupOptions(8, { groups: 2, advance: 2 }).ok).toBe(true);
    expect(validateGroupOptions(16, { groups: 4, advance: 2 }).ok).toBe(true);
    expect(validateGroupOptions(9, { groups: 3, advance: 1 }).ok).toBe(true);
  });
});

describe("groupStageDraw", () => {
  it("16 entries, 4 groups, top 2: group round robins plus an empty quarter-final bracket", () => {
    const r = groupStageDraw(ids(16), { groups: 4, advance: 2 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const { draw } = r;
    expect(draw.groups).toHaveLength(4);
    expect(draw.groupRounds).toBe(3);
    expect(draw.bracketSize).toBe(8);
    expect(draw.knockoutRounds).toBe(3);
    const group = draw.fixtures.filter((f) => !isKnockoutPhaseRound(f.round));
    const ko = draw.fixtures.filter((f) => isKnockoutPhaseRound(f.round));
    expect(group).toHaveLength(4 * 6);
    expect(ko).toHaveLength(7);
    expect(ko.every((f) => !f.homeEntryId && !f.awayEntryId && f.status === "SCHEDULED")).toBe(true);
    expect(ko.every((f) => advanceFromRound(f.round) === 2)).toBe(true);
    expect([...new Set(ko.map((f) => knockoutRoundIndex(f.round)))]).toEqual([1, 2, 3]);
    // Group fixtures only pair entries of the same group, and slots encode the group.
    for (const f of group) {
      const g = groupOfSlot(f.slot);
      expect(draw.groups[g]).toContain(f.homeEntryId);
      expect(draw.groups[g]).toContain(f.awayEntryId);
    }
    // Nobody plays twice in a matchday, and (round, slot) is unique.
    for (let round = 1; round <= draw.groupRounds; round++) {
      const playing = group.filter((f) => f.round === round).flatMap((f) => [f.homeEntryId, f.awayEntryId]);
      expect(new Set(playing).size).toBe(playing.length);
    }
    expect(new Set(draw.fixtures.map((f) => `${f.round}:${f.slot}`)).size).toBe(draw.fixtures.length);
    expect(groupDrawShape(draw.fixtures)).toEqual({ groups: 4, advance: 2 });
  });

  it("uneven groups (10 entries in 3) still play a full round robin each", () => {
    const r = groupStageDraw(ids(10), { groups: 3, advance: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const sizes = r.draw.groups.map((g) => g.length);
    const expected = sizes.reduce((n, s) => n + (s * (s - 1)) / 2, 0);
    expect(r.draw.fixtures.filter((f) => !isKnockoutPhaseRound(f.round))).toHaveLength(expected);
    expect(r.draw.bracketSize).toBe(4);
  });

  it("double round doubles the group fixtures", () => {
    const single = groupStageDraw(ids(8), { groups: 2, advance: 1 });
    const double = groupStageDraw(ids(8), { groups: 2, advance: 1, double: true });
    if (!single.ok || !double.ok) throw new Error("draw failed");
    const count = (fs: { round: number }[]) => fs.filter((f) => !isKnockoutPhaseRound(f.round)).length;
    expect(count(double.draw.fixtures)).toBe(count(single.draw.fixtures) * 2);
  });

  it("refuses bad options and is deterministic", () => {
    expect(groupStageDraw(ids(4), { groups: 4, advance: 1 }).ok).toBe(false);
    expect(groupStageDraw(ids(12), { groups: 3, advance: 2 })).toEqual(groupStageDraw(ids(12), { groups: 3, advance: 2 }));
  });
});

describe("knockout from group tables", () => {
  const tables = (groups: number, size: number) =>
    Array.from({ length: groups }, (_, g) => Array.from({ length: size }, (_, p) => `${String.fromCharCode(65 + g)}${p + 1}`));

  it("orders group winners first, then runners-up", () => {
    expect(knockoutQualifierOrder(tables(2, 4), 2)).toEqual(["A1", "B1", "A2", "B2"]);
    expect(knockoutQualifierOrder(tables(4, 4), 1)).toEqual(["A1", "B1", "C1", "D1"]);
  });

  it("2 groups top 2: winners meet the other group's runner-up", () => {
    const ko = seedKnockoutPhase(tables(2, 4), 2);
    const r1 = ko.filter((f) => knockoutRoundIndex(f.round) === 1).map((f) => [f.homeEntryId, f.awayEntryId]);
    expect(r1).toEqual([
      ["A1", "B2"],
      ["B1", "A2"],
    ]);
    expect(ko.every((f) => f.round >= 200)).toBe(true);
  });

  for (const [groups, advance] of [[2, 1], [2, 2], [2, 3], [3, 1], [3, 2], [4, 2], [4, 3], [5, 2], [6, 2], [8, 2], [8, 1], [3, 3]] as const) {
    it(`${groups} groups, top ${advance}: group-mates never meet in round one`, () => {
      const t = tables(groups, advance + 1);
      const order = knockoutQualifierOrder(t, advance);
      expect(order).toHaveLength(groups * advance);
      expect(new Set(order).size).toBe(order.length);
      const ko = seedKnockoutPhase(t, advance);
      for (const f of ko.filter((x) => knockoutRoundIndex(x.round) === 1 && x.homeEntryId && x.awayEntryId)) {
        expect(f.homeEntryId![0]).not.toBe(f.awayEntryId![0]);
      }
      // Byes go to the best-placed qualifiers (group winners first).
      const place = (id: string) => Number(id.slice(1));
      const byeHolders = ko.filter((x) => x.status === "BYE").map((x) => x.winnerEntryId!);
      let size = 1;
      while (size < groups * advance) size *= 2;
      expect(byeHolders).toHaveLength(size - groups * advance);
      const others = order.filter((id) => !byeHolders.includes(id));
      if (byeHolders.length && others.length) expect(Math.max(...byeHolders.map(place))).toBeLessThanOrEqual(Math.min(...others.map(place)));
    });
  }

  it("bracket size matches the empty bracket from the draw", () => {
    const draw = groupStageDraw(ids(12), { groups: 3, advance: 2 });
    if (!draw.ok) throw new Error("draw failed");
    const skeleton = draw.draw.fixtures.filter((f) => isKnockoutPhaseRound(f.round)).map((f) => `${f.round}:${f.slot}`);
    const seeded = seedKnockoutPhase(draw.draw.groups, 2).map((f) => `${f.round}:${f.slot}`);
    expect(seeded).toEqual(skeleton);
  });

  it("first-round seed pairs never put two byes together", () => {
    for (const size of [4, 8, 16, 32]) for (const [a, b] of firstRoundSeedPairs(size)) expect(Math.min(a, b)).toBeLessThanOrEqual(size / 2);
  });
});
