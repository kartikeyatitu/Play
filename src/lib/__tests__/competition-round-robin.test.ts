import { describe, expect, it } from "vitest";
import { roundRobinDraw } from "@/lib/competition/round-robin";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `e${String(i + 1).padStart(2, "0")}`);
const pairKey = (a: string, b: string) => [a, b].sort().join("|");

function homeAway(fixtures: { homeEntryId: string | null; awayEntryId: string | null }[]) {
  const m = new Map<string, { home: number; away: number }>();
  for (const f of fixtures) {
    const h = m.get(f.homeEntryId!) ?? { home: 0, away: 0 };
    const a = m.get(f.awayEntryId!) ?? { home: 0, away: 0 };
    h.home++;
    a.away++;
    m.set(f.homeEntryId!, h);
    m.set(f.awayEntryId!, a);
  }
  return m;
}

describe("roundRobinDraw", () => {
  it("returns nothing for fewer than two entries", () => {
    expect(roundRobinDraw([]).fixtures).toEqual([]);
    expect(roundRobinDraw(["a"]).fixtures).toEqual([]);
    expect(roundRobinDraw(["a", "a"]).fixtures).toEqual([]);
  });

  it("two entries play once", () => {
    const d = roundRobinDraw(["a", "b"]);
    expect(d.rounds).toBe(1);
    expect(d.fixtures).toHaveLength(1);
    expect(d.byes).toEqual([]);
  });

  for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 17, 20, 21, 32]) {
    it(`${n} entries: every pair exactly once, nobody twice in a round, right round count`, () => {
      const d = roundRobinDraw(ids(n));
      expect(d.fixtures).toHaveLength((n * (n - 1)) / 2);
      expect(d.rounds).toBe(n % 2 === 0 ? n - 1 : n);
      const pairs = new Set(d.fixtures.map((f) => pairKey(f.homeEntryId!, f.awayEntryId!)));
      expect(pairs.size).toBe(d.fixtures.length);
      for (let r = 1; r <= d.rounds; r++) {
        const inRound = d.fixtures.filter((f) => f.round === r);
        const playing = inRound.flatMap((f) => [f.homeEntryId, f.awayEntryId]);
        expect(new Set(playing).size).toBe(playing.length);
        expect(inRound.map((f) => f.slot)).toEqual(inRound.map((_, i) => i));
      }
      for (const f of d.fixtures) {
        expect(f.status).toBe("SCHEDULED");
        expect(f.winnerEntryId).toBeNull();
        expect(f.homeEntryId).not.toBe(f.awayEntryId);
      }
    });

    it(`${n} entries: home and away balanced within one game`, () => {
      const m = homeAway(roundRobinDraw(ids(n)).fixtures);
      expect(m.size).toBe(n);
      for (const { home, away } of m.values()) expect(Math.abs(home - away)).toBeLessThanOrEqual(1);
      if (n % 2 === 1) for (const { home, away } of m.values()) expect(home).toBe(away);
    });
  }

  it("odd counts: each entry rests exactly once, in a round where it doesn't play", () => {
    for (const n of [3, 5, 7, 9, 15]) {
      const d = roundRobinDraw(ids(n));
      expect(d.byes).toHaveLength(n);
      expect(new Set(d.byes.map((b) => b.entryId)).size).toBe(n);
      for (const b of d.byes) {
        const playing = d.fixtures.filter((f) => f.round === b.round).flatMap((f) => [f.homeEntryId, f.awayEntryId]);
        expect(playing).not.toContain(b.entryId);
        expect(playing).toHaveLength(n - 1);
      }
    }
  });

  it("even counts have no byes", () => {
    expect(roundRobinDraw(ids(8)).byes).toEqual([]);
  });

  it("double round mirrors the first half with venues swapped and levels home/away exactly", () => {
    for (const n of [4, 5, 6, 9]) {
      const single = roundRobinDraw(ids(n));
      const d = roundRobinDraw(ids(n), { double: true });
      expect(d.rounds).toBe(single.rounds * 2);
      expect(d.fixtures).toHaveLength(n * (n - 1));
      const first = d.fixtures.slice(0, single.fixtures.length);
      const second = d.fixtures.slice(single.fixtures.length);
      expect(first).toEqual(single.fixtures);
      second.forEach((f, i) => {
        expect(f.round).toBe(first[i].round + single.rounds);
        expect(f.homeEntryId).toBe(first[i].awayEntryId);
        expect(f.awayEntryId).toBe(first[i].homeEntryId);
      });
      for (const { home, away } of homeAway(d.fixtures).values()) expect(home).toBe(away);
      expect(d.byes).toHaveLength(n % 2 ? n * 2 : 0);
    }
  });

  it("is deterministic and ignores duplicate ids", () => {
    expect(roundRobinDraw(ids(9))).toEqual(roundRobinDraw(ids(9)));
    expect(roundRobinDraw(["a", "b", "a", "c"])).toEqual(roundRobinDraw(["a", "b", "c"]));
  });

  it("avoids long runs: nobody has more than three home or away games in a row (8 and 10 entries)", () => {
    for (const n of [8, 10]) {
      const d = roundRobinDraw(ids(n));
      for (const e of ids(n)) {
        const seq = d.fixtures.filter((f) => f.homeEntryId === e || f.awayEntryId === e).sort((a, b) => a.round - b.round).map((f) => (f.homeEntryId === e ? "H" : "A"));
        expect(seq.join("")).not.toMatch(/HHHH|AAAA/);
      }
    }
  });
});
