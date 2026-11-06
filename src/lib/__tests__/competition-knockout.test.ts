import { describe, expect, it } from "vitest";
import { firstRoundSeedPairs, knockoutDraw } from "@/lib/competition/knockout";
import { nextKnockoutPosition } from "@/lib/competition/phase";

const seeds = (n: number) => Array.from({ length: n }, (_, i) => `s${i + 1}`);

describe("knockoutDraw", () => {
  it("returns nothing for fewer than two entries", () => {
    expect(knockoutDraw([]).fixtures).toEqual([]);
    expect(knockoutDraw(["a"]).rounds).toBe(0);
  });

  it("8 entries: standard seeding, 7 fixtures, 3 rounds, no byes", () => {
    const d = knockoutDraw(seeds(8));
    expect(d.size).toBe(8);
    expect(d.rounds).toBe(3);
    expect(d.byes).toEqual([]);
    expect(d.fixtures).toHaveLength(7);
    const r1 = d.fixtures.filter((f) => f.round === 1).map((f) => [f.homeEntryId, f.awayEntryId]);
    expect(r1).toEqual([
      ["s1", "s8"],
      ["s4", "s5"],
      ["s2", "s7"],
      ["s3", "s6"],
    ]);
    expect(d.fixtures.filter((f) => f.round > 1).every((f) => !f.homeEntryId && !f.awayEntryId)).toBe(true);
  });

  for (const n of [2, 3, 5, 6, 7, 9, 12, 13, 16, 17, 31, 33, 64]) {
    it(`${n} entries: pads to a power of two, byes to the top seeds, bye winners already in round 2`, () => {
      const d = knockoutDraw(seeds(n));
      let size = 1;
      while (size < n) size *= 2;
      expect(d.size).toBe(size);
      expect(d.rounds).toBe(Math.log2(size));
      expect(d.fixtures).toHaveLength(size - 1);
      const byeCount = size - n;
      expect([...d.byes].sort()).toEqual(seeds(byeCount).sort());
      const r1 = d.fixtures.filter((f) => f.round === 1);
      expect(r1).toHaveLength(size / 2);
      // Every entry appears exactly once in round 1.
      const inR1 = r1.flatMap((f) => [f.homeEntryId, f.awayEntryId]).filter(Boolean);
      expect(new Set(inR1).size).toBe(n);
      for (const f of r1.filter((x) => x.status === "BYE")) {
        expect(f.winnerEntryId).toBe(f.homeEntryId ?? f.awayEntryId);
        if (d.rounds > 1) {
          const next = nextKnockoutPosition(1, f.slot, d.fixtures.map((x) => x.round))!;
          const target = d.fixtures.find((x) => x.round === next.round && x.slot === next.slot)!;
          expect(next.side === "home" ? target.homeEntryId : target.awayEntryId).toBe(f.winnerEntryId);
        }
      }
      // No round-1 fixture has two empty sides.
      expect(r1.every((f) => f.homeEntryId || f.awayEntryId)).toBe(true);
    });
  }

  it("seeds 1 and 2 can only meet in the final", () => {
    const d = knockoutDraw(seeds(16));
    const r1 = d.fixtures.filter((f) => f.round === 1);
    const slotOf = (id: string) => r1.find((f) => f.homeEntryId === id || f.awayEntryId === id)!.slot;
    expect(slotOf("s1") < 4).toBe(true);
    expect(slotOf("s2") >= 4).toBe(true);
    // 1–4 sit in different quarters.
    expect(new Set(["s1", "s2", "s3", "s4"].map((s) => Math.floor(slotOf(s) / 2))).size).toBe(4);
  });

  it("is deterministic", () => {
    expect(knockoutDraw(seeds(11))).toEqual(knockoutDraw(seeds(11)));
  });

  it("firstRoundSeedPairs gives the classic bracket", () => {
    expect(firstRoundSeedPairs(4)).toEqual([
      [1, 4],
      [2, 3],
    ]);
    expect(firstRoundSeedPairs(8)).toEqual([
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ]);
  });
});

describe("nextKnockoutPosition", () => {
  it("plain knockout: winner of slot s goes to slot s/2, even slots at home", () => {
    const rounds = [1, 2, 3];
    expect(nextKnockoutPosition(1, 0, rounds)).toEqual({ round: 2, slot: 0, side: "home" });
    expect(nextKnockoutPosition(1, 3, rounds)).toEqual({ round: 2, slot: 1, side: "away" });
    expect(nextKnockoutPosition(2, 1, rounds)).toEqual({ round: 3, slot: 0, side: "away" });
    expect(nextKnockoutPosition(3, 0, rounds)).toBeNull();
  });

  it("knockout phase of a group draw ignores group rounds", () => {
    const rounds = [1, 2, 3, 201, 202, 203];
    expect(nextKnockoutPosition(201, 2, rounds)).toEqual({ round: 202, slot: 1, side: "home" });
    expect(nextKnockoutPosition(202, 1, rounds)).toEqual({ round: 203, slot: 0, side: "away" });
    expect(nextKnockoutPosition(203, 0, rounds)).toBeNull();
  });
});
