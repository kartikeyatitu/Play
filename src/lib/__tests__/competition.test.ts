import { describe, it, expect } from "vitest";
import {
  ageOn,
  allFixturesDecided,
  bracketOrder,
  canCorrectKnockoutResult,
  canTransition,
  checkEligibility,
  computeStandings,
  generateFixtures,
  knockoutChampion,
  knockoutRounds,
  nextFixturePosition,
  roundRobin,
  seedOrder,
  singleElimination,
  validateCompetitionConfig,
  validateResult,
  type StandingsFixture,
} from "@/lib/competition";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `e${i + 1}`);
const pairKey = (a: string | null, b: string | null) => [a, b].sort().join("|");

describe("seedOrder", () => {
  it("puts seeded entries first, then by registration time, then id", () => {
    const order = seedOrder([
      { id: "c", createdAt: 3 },
      { id: "a", seed: 2, createdAt: 9 },
      { id: "b", seed: 1, createdAt: 8 },
      { id: "e", createdAt: 1 },
      { id: "d", createdAt: 1 },
    ]);
    expect(order).toEqual(["b", "a", "d", "e", "c"]);
  });

  it("is deterministic regardless of input order", () => {
    const entries = [
      { id: "x", createdAt: "2026-01-02T00:00:00Z" },
      { id: "y", createdAt: "2026-01-01T00:00:00Z" },
      { id: "z", seed: 1 },
    ];
    expect(seedOrder(entries)).toEqual(seedOrder([...entries].reverse()));
  });
});

describe("roundRobin", () => {
  for (const n of [2, 3, 4, 5, 6, 7, 8, 11]) {
    it(`${n} entries: n(n-1)/2 fixtures, each pair once, nobody twice in a round`, () => {
      const fx = roundRobin(ids(n));
      expect(fx).toHaveLength((n * (n - 1)) / 2);
      expect(new Set(fx.map((f) => pairKey(f.homeEntryId, f.awayEntryId))).size).toBe(fx.length);
      const rounds = new Map<number, string[]>();
      for (const f of fx) rounds.set(f.round, [...(rounds.get(f.round) ?? []), f.homeEntryId!, f.awayEntryId!]);
      for (const list of rounds.values()) expect(new Set(list).size).toBe(list.length);
      expect(Math.max(...fx.map((f) => f.round))).toBe(n % 2 === 0 ? n - 1 : n);
      expect(fx.every((f) => f.homeEntryId && f.awayEntryId && f.status === "SCHEDULED")).toBe(true);
    });
  }

  it("odd count: every entry sits out exactly one round", () => {
    const fx = roundRobin(ids(5));
    for (const id of ids(5)) {
      const playedRounds = new Set(fx.filter((f) => f.homeEntryId === id || f.awayEntryId === id).map((f) => f.round));
      expect(playedRounds.size).toBe(4);
    }
  });

  it("slots are unique and contiguous within a round", () => {
    const fx = roundRobin(ids(6));
    const keys = fx.map((f) => `${f.round}:${f.slot}`);
    expect(new Set(keys).size).toBe(fx.length);
    for (const f of fx) expect(f.slot).toBeLessThan(3);
  });

  it("two legs swap home and away", () => {
    const fx = roundRobin(ids(4), 2);
    expect(fx).toHaveLength(12);
    const leg1 = fx.filter((f) => f.round <= 3);
    const leg2 = fx.filter((f) => f.round > 3);
    for (const f of leg1) {
      expect(leg2.some((g) => g.homeEntryId === f.awayEntryId && g.awayEntryId === f.homeEntryId)).toBe(true);
    }
  });

  it("is deterministic and ignores duplicates / too few entries", () => {
    expect(roundRobin(ids(6))).toEqual(roundRobin(ids(6)));
    expect(roundRobin(["a"])).toEqual([]);
    expect(roundRobin(["a", "a", "b"])).toHaveLength(1);
  });
});

describe("singleElimination", () => {
  it("standard bracket order keeps top seeds apart", () => {
    expect(bracketOrder(2)).toEqual([1, 2]);
    expect(bracketOrder(4)).toEqual([1, 4, 2, 3]);
    expect(bracketOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("8 entries: 7 fixtures over 3 rounds, no byes, seed 1 v 8", () => {
    const fx = singleElimination(ids(8));
    expect(fx).toHaveLength(7);
    expect(knockoutRounds(8)).toBe(3);
    expect(fx.filter((f) => f.status === "BYE")).toHaveLength(0);
    expect(fx[0]).toMatchObject({ round: 1, slot: 0, homeEntryId: "e1", awayEntryId: "e8" });
  });

  it("5 entries: 8-slot bracket, byes to seeds 1-3 who are pre-filled into round 2", () => {
    const fx = singleElimination(ids(5));
    expect(fx).toHaveLength(7);
    const byes = fx.filter((f) => f.status === "BYE");
    expect(byes.map((b) => b.winnerEntryId).sort()).toEqual(["e1", "e2", "e3"]);
    const r1Real = fx.filter((f) => f.round === 1 && f.status === "SCHEDULED");
    expect(r1Real).toHaveLength(1);
    expect(pairKey(r1Real[0].homeEntryId, r1Real[0].awayEntryId)).toBe(pairKey("e4", "e5"));
    const r2 = fx.filter((f) => f.round === 2);
    const r2Entries = r2.flatMap((f) => [f.homeEntryId, f.awayEntryId]).filter(Boolean).sort();
    expect(r2Entries).toEqual(["e1", "e2", "e3"]);
    // Seed 1 waits for the winner of 4 v 5.
    const seed1 = r2.find((f) => f.homeEntryId === "e1" || f.awayEntryId === "e1")!;
    expect([seed1.homeEntryId, seed1.awayEntryId].filter(Boolean)).toEqual(["e1"]);
  });

  it("every entry appears exactly once in round 1", () => {
    for (const n of [2, 3, 6, 7, 9, 16]) {
      const r1 = singleElimination(ids(n)).filter((f) => f.round === 1);
      const seen = r1.flatMap((f) => [f.homeEntryId, f.awayEntryId]).filter(Boolean);
      expect(seen.sort()).toEqual(ids(n).sort());
    }
  });

  it("winners feed the right next-round slot and side", () => {
    expect(nextFixturePosition(1, 0, 3)).toEqual({ round: 2, slot: 0, side: "home" });
    expect(nextFixturePosition(1, 3, 3)).toEqual({ round: 2, slot: 1, side: "away" });
    expect(nextFixturePosition(3, 0, 3)).toBeNull();
  });

  it("generateFixtures uses seed order", () => {
    const fx = generateFixtures("KNOCKOUT", [
      { id: "low", createdAt: 1 },
      { id: "top", seed: 1, createdAt: 2 },
    ]);
    expect(fx[0]).toMatchObject({ homeEntryId: "top", awayEntryId: "low" });
  });

  it("champion is the final's winner once decided", () => {
    expect(knockoutChampion([{ round: 1, status: "COMPLETED", winnerEntryId: "a" }, { round: 2, status: "SCHEDULED", winnerEntryId: null }])).toBeNull();
    expect(knockoutChampion([{ round: 2, status: "COMPLETED", winnerEntryId: "b" }])).toBe("b");
  });

  it("a result can be corrected only until the next round is played", () => {
    expect(canCorrectKnockoutResult(null)).toBe(true);
    expect(canCorrectKnockoutResult("SCHEDULED")).toBe(true);
    expect(canCorrectKnockoutResult("COMPLETED")).toBe(false);
  });
});

describe("validateResult", () => {
  const league = { format: "LEAGUE" as const, allowDraws: true, status: "SCHEDULED", homeEntryId: "h", awayEntryId: "a" };
  const cup = { ...league, format: "KNOCKOUT" as const, allowDraws: false };

  it("derives the winner from the score", () => {
    expect(validateResult({ homeScore: 2, awayScore: 1 }, league)).toEqual({ ok: true, homeScore: 2, awayScore: 1, winnerEntryId: "h" });
    expect(validateResult({ homeScore: "0", awayScore: "3" }, cup)).toMatchObject({ ok: true, winnerEntryId: "a" });
  });

  it("rejects bad scores", () => {
    for (const s of [-1, 1.5, 1000, "", "x", null]) expect(validateResult({ homeScore: s, awayScore: 1 }, league).ok).toBe(false);
  });

  it("league draws only when allowed", () => {
    expect(validateResult({ homeScore: 1, awayScore: 1 }, league)).toMatchObject({ ok: true, winnerEntryId: null });
    expect(validateResult({ homeScore: 1, awayScore: 1 }, { ...league, allowDraws: false }).ok).toBe(false);
  });

  it("knockout ties need a valid winner", () => {
    expect(validateResult({ homeScore: 1, awayScore: 1 }, cup).ok).toBe(false);
    expect(validateResult({ homeScore: 1, awayScore: 1, winnerEntryId: "zz" }, cup).ok).toBe(false);
    expect(validateResult({ homeScore: 1, awayScore: 1, winnerEntryId: "a" }, cup)).toMatchObject({ ok: true, winnerEntryId: "a" });
  });

  it("refuses fixtures without both sides, byes and cancelled fixtures", () => {
    expect(validateResult({ homeScore: 1, awayScore: 0 }, { ...cup, awayEntryId: null }).ok).toBe(false);
    expect(validateResult({ homeScore: 1, awayScore: 0 }, { ...cup, status: "BYE" }).ok).toBe(false);
    expect(validateResult({ homeScore: 1, awayScore: 0 }, { ...cup, status: "CANCELLED" }).ok).toBe(false);
  });
});

describe("computeStandings", () => {
  const done = (h: string, a: string, hs: number, as: number): StandingsFixture => ({ homeEntryId: h, awayEntryId: a, homeScore: hs, awayScore: as, status: "COMPLETED" });
  const entries = [
    { id: "a", name: "Alpha" },
    { id: "b", name: "Bravo" },
    { id: "c", name: "Charlie" },
    { id: "d", name: "Delta" },
  ];

  it("counts W/D/L, scores and points; ignores unplayed fixtures", () => {
    const t = computeStandings(entries, [
      done("a", "b", 2, 0),
      done("c", "d", 1, 1),
      { homeEntryId: "a", awayEntryId: "c", homeScore: null, awayScore: null, status: "SCHEDULED" },
    ]);
    const a = t.find((r) => r.entryId === "a")!;
    expect(a).toMatchObject({ position: 1, played: 1, won: 1, scoresFor: 2, scoresAgainst: 0, diff: 2, points: 3 });
    expect(t.find((r) => r.entryId === "c")).toMatchObject({ drawn: 1, points: 1 });
    expect(t.find((r) => r.entryId === "b")).toMatchObject({ lost: 1, points: 0, position: 4 });
  });

  it("head-to-head beats goal difference", () => {
    // a and b both 3 pts; b has better diff but a beat b.
    const t = computeStandings(entries, [done("a", "b", 1, 0), done("b", "c", 5, 0), done("c", "a", 3, 0)], { win: 3, draw: 1, loss: 0 });
    // points: a 3, b 3, c 3 → three-way tie; h2h among all three is 3 each → falls to diff.
    expect(t.slice(0, 3).map((r) => r.entryId)).toEqual(["b", "c", "a"]);
    const t2 = computeStandings(entries, [done("a", "b", 1, 0), done("b", "d", 6, 0)]);
    expect(t2.slice(0, 2).map((r) => r.entryId)).toEqual(["a", "b"]);
  });

  it("then diff, scores for, wins and name", () => {
    const t = computeStandings(entries, [done("a", "c", 1, 0), done("b", "d", 1, 0)]);
    // a and b identical, never met → name order.
    expect(t.slice(0, 2).map((r) => r.name)).toEqual(["Alpha", "Bravo"]);
    const t2 = computeStandings(entries, [done("a", "c", 1, 0), done("b", "d", 3, 2)]);
    expect(t2.slice(0, 2).map((r) => r.entryId)).toEqual(["b", "a"]); // same diff, more scored
  });

  it("uses the competition's points rule", () => {
    const t = computeStandings(entries, [done("a", "b", 0, 0)], { win: 2, draw: 1, loss: 0 });
    expect(t.find((r) => r.entryId === "a")!.points).toBe(1);
  });

  it("allFixturesDecided", () => {
    expect(allFixturesDecided([])).toBe(false);
    expect(allFixturesDecided([{ status: "COMPLETED" }, { status: "BYE" }, { status: "CANCELLED" }])).toBe(true);
    expect(allFixturesDecided([{ status: "COMPLETED" }, { status: "POSTPONED" }])).toBe(false);
  });
});

describe("lifecycle", () => {
  const ctx = { hasFixtures: false, allDecided: false };
  it("enforces the state machine", () => {
    expect(canTransition("DRAFT", "OPEN", ctx).ok).toBe(true);
    expect(canTransition("OPEN", "SCHEDULED", ctx).ok).toBe(false);
    expect(canTransition("OPEN", "SCHEDULED", { ...ctx, viaGeneration: true }).ok).toBe(true);
    expect(canTransition("OPEN", "DRAFT", { ...ctx, hasFixtures: true }).ok).toBe(false);
    expect(canTransition("SCHEDULED", "COMPLETED", ctx).ok).toBe(false);
    expect(canTransition("SCHEDULED", "COMPLETED", { ...ctx, allDecided: true }).ok).toBe(true);
    expect(canTransition("COMPLETED", "CANCELLED", ctx).ok).toBe(false);
    expect(canTransition("DRAFT", "BOGUS", ctx).ok).toBe(false);
  });
});

describe("eligibility", () => {
  it("computes completed years", () => {
    expect(ageOn(new Date("2012-06-15T00:00:00Z"), new Date("2026-06-14T00:00:00Z"))).toBe(13);
    expect(ageOn(new Date("2012-06-15T00:00:00Z"), new Date("2026-06-15T00:00:00Z"))).toBe(14);
  });

  const rule = { minAge: 10, maxAge: 14, ageCutoffDate: new Date("2026-12-01T00:00:00Z"), eligibleBatchId: null };
  it("checks age on the cut-off date", () => {
    expect(checkEligibility(rule, { dob: new Date("2014-01-01T00:00:00Z"), batchIds: [] }).ok).toBe(true);
    expect(checkEligibility(rule, { dob: new Date("2018-01-01T00:00:00Z"), batchIds: [] }).ok).toBe(false);
    expect(checkEligibility(rule, { dob: new Date("2010-01-01T00:00:00Z"), batchIds: [] }).ok).toBe(false);
  });
  it("requires a DOB when an age rule exists", () => {
    expect(checkEligibility(rule, { dob: null, batchIds: [] })).toMatchObject({ ok: false });
    expect(checkEligibility({ ...rule, minAge: null, maxAge: null }, { dob: null, batchIds: [] }).ok).toBe(true);
  });
  it("checks batch membership", () => {
    const r = { minAge: null, maxAge: null, ageCutoffDate: null, eligibleBatchId: "b1" };
    expect(checkEligibility(r, { dob: null, batchIds: ["b2"] }).ok).toBe(false);
    expect(checkEligibility(r, { dob: null, batchIds: ["b1"] }).ok).toBe(true);
  });
});

describe("validateCompetitionConfig", () => {
  const base = { name: "Summer Cup", format: "KNOCKOUT", entryType: "TEAM", maxEntries: 8 };
  it("accepts a valid config with defaults", () => {
    const r = validateCompetitionConfig(base);
    expect(r).toMatchObject({ ok: true, value: { pointsWin: 3, pointsDraw: 1, pointsLoss: 0, allowDraws: false, legs: 1 } });
  });
  it("rejects bad input", () => {
    expect(validateCompetitionConfig({ ...base, name: "x" }).ok).toBe(false);
    expect(validateCompetitionConfig({ ...base, format: "SWISS" }).ok).toBe(false);
    expect(validateCompetitionConfig({ ...base, maxEntries: 65 }).ok).toBe(false);
    expect(validateCompetitionConfig({ ...base, format: "LEAGUE", maxEntries: 100 }).ok).toBe(true);
    expect(validateCompetitionConfig({ ...base, startDate: "2026-12-10", endDate: "2026-12-01" }).ok).toBe(false);
    expect(validateCompetitionConfig({ ...base, pointsWin: 1, pointsDraw: 2 }).ok).toBe(false);
  });
  it("age rules need a cut-off and individual entries", () => {
    expect(validateCompetitionConfig({ ...base, entryType: "INDIVIDUAL", minAge: 10 }).ok).toBe(false);
    const r = validateCompetitionConfig({ ...base, entryType: "INDIVIDUAL", minAge: 10, startDate: "2026-12-01" });
    expect(r.ok && r.value.ageCutoffDate?.toISOString().slice(0, 10)).toBe("2026-12-01");
    expect(validateCompetitionConfig({ ...base, minAge: 10, startDate: "2026-12-01" }).ok).toBe(false);
  });
});

describe("parseFixtureTime", () => {
  it("reads IST wall time", async () => {
    const { parseFixtureTime } = await import("@/lib/competition");
    expect((parseFixtureTime("2026-11-01T17:30") as Date).toISOString()).toBe("2026-11-01T12:00:00.000Z");
    expect(parseFixtureTime("")).toBeNull();
    expect(parseFixtureTime("2026-11-01")).toBe("bad");
  });
});
