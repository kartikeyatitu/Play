import { describe, it, expect } from "vitest";
import {
  aggregateSeason,
  defaultSeasonRange,
  familyOf,
  formatMark,
  headlineStats,
  oversFromBalls,
  parseSeasonRange,
  resultOf,
  type StatRow,
} from "@/lib/season-stats";

const NOW = new Date("2026-11-06T12:00:00.000Z");
const RANGE = defaultSeasonRange(NOW);
const ago = (d: number) => new Date(NOW.getTime() - d * 86400000);
let id = 0;
const row = (sport: string, stats: unknown, daysAgo: number): StatRow => ({ matchId: `m${++id}`, studentId: "s1", sport, stats, playedAt: ago(daysAgo) });

describe("season ranges", () => {
  it("defaults to the last 12 months", () => {
    expect(RANGE.to).toEqual(NOW);
    expect(RANGE.from.toISOString()).toBe("2025-11-06T12:00:00.000Z");
  });
  it("falls back on bad input, swaps reversed ranges, and makes a bare 'to' date inclusive", () => {
    expect(parseSeasonRange("nope", null, NOW)).toEqual(RANGE);
    const r = parseSeasonRange("2026-04-01", "2026-04-30", NOW);
    expect(r.to.getTime() - new Date("2026-04-30").getTime()).toBe(86400000 - 1);
    const swapped = parseSeasonRange(new Date("2026-05-01"), new Date("2026-01-01"), NOW);
    expect(swapped.from < swapped.to).toBe(true);
  });
});

describe("reading stat lines", () => {
  it("is defensive about results and families", () => {
    expect(resultOf({ result: "W" })).toBe("W");
    expect(resultOf({ result: "X" })).toBe("-");
    expect(resultOf(null)).toBe("-");
    expect(familyOf("cricket")).toBe("cricket");
    expect(familyOf("unknown", { family: "goals" })).toBe("goals");
    expect(familyOf("unknown", { family: "bogus" })).toBeNull();
    expect(oversFromBalls(75)).toBe("12.3");
    expect(oversFromBalls(12)).toBe("2");
  });
});

describe("aggregateSeason", () => {
  it("cricket batting, bowling and fielding", () => {
    const rows = [
      row("cricket", { family: "cricket", result: "W", batting: { runs: 50, balls: 40, fours: 6, sixes: 1, out: true }, bowling: { balls: 24, runs: 20, wickets: 2, maidens: 1 }, catches: 1 }, 10),
      row("cricket", { family: "cricket", result: "L", batting: { runs: 12, balls: 10, out: false }, bowling: { balls: 12, runs: 8, wickets: 2, maidens: 0 }, runOuts: 1 }, 20),
      row("cricket", { family: "cricket", result: "D", batting: null, bowling: null }, 30),
    ];
    const [c] = aggregateSeason(rows, RANGE);
    if (c.family !== "cricket") throw new Error("expected cricket");
    expect(c).toMatchObject({ matches: 3, won: 1, lost: 1, drawn: 1, winRate: 0.5 });
    expect(c.batting).toMatchObject({ innings: 2, runs: 62, balls: 50, notOuts: 1, highScore: 50, fifties: 1, strikeRate: 124, average: 62 });
    expect(c.bowling).toMatchObject({ balls: 36, overs: "6", wickets: 4, economy: 4.67, best: { wickets: 2, runs: 8 } });
    expect(c.fielding).toEqual({ catches: 1, runOuts: 1, stumpings: 0 });
  });

  it("goals, rally, bout and chess families", () => {
    const rows = [
      row("football", { family: "goals", result: "W", points: 2, assists: 1, yellow: 1, scores: { goal: 2 }, teamFor: 3, teamAgainst: 1 }, 5),
      row("football", { family: "goals", result: "L", points: 0, red: 1, teamFor: 0, teamAgainst: 2 }, 6),
      row("badminton", { family: "rally", result: "W", periodsWon: 2, periodsLost: 1, pointsWon: 60, pointsLost: 50, longestRun: 7 }, 7),
      row("boxing", { family: "bout", result: "W", pointsFor: 30, pointsAgainst: 27, method: "KO" }, 8),
      row("boxing", { family: "bout", result: "W", pointsFor: 29, pointsAgainst: 28 }, 9),
      row("chess", { family: "chess", result: "D", colour: "white" }, 10),
    ];
    const out = Object.fromEntries(aggregateSeason(rows, RANGE).map((s) => [s.sport, s]));
    expect(out.football).toMatchObject({ points: 2, assists: 1, yellow: 1, red: 1, teamFor: 3, teamAgainst: 3, pointsPerMatch: 1, scores: { goal: 2 } });
    expect(out.badminton).toMatchObject({ periodsWon: 2, periodsLost: 1, periodUnit: "game", longestRun: 7 });
    expect(out.boxing).toMatchObject({ won: 2, winMethods: { KO: 1, Points: 1 }, pointsFor: 59 });
    expect(out.chess).toMatchObject({ score: 0.5, asWhite: 1, asBlack: 0, winRate: 0.5 });
  });

  it("only counts rows inside the season, ordered by matches played", () => {
    const rows = [
      row("football", { family: "goals", result: "W", points: 1 }, 400),
      row("football", { family: "goals", result: "W", points: 1 }, 10),
      row("chess", { family: "chess", result: "W" }, 3),
      row("chess", { family: "chess", result: "W" }, 4),
    ];
    const out = aggregateSeason(rows, RANGE);
    expect(out.map((s) => [s.sport, s.matches])).toEqual([["chess", 2], ["football", 1]]);
    expect(aggregateSeason(rows, RANGE, "football")).toHaveLength(1);
    expect(aggregateSeason([row("football", { result: "W" }, 500)], RANGE)).toEqual([]);
  });

  it("performance: season best vs earlier history decides personal bests", () => {
    const perf = (best: number | null, daysAgo: number, status = "OK", rank: number | null = null) =>
      row("swimming", { family: "performance", result: "-", eventName: "100m free", measure: "time", best, status, rank }, daysAgo);
    const rows = [perf(70000, 500), perf(71000, 100, "OK", 4), perf(69000, 50, "OK", 2), perf(null, 20, "DNF"), perf(69500, 10, "OK", 1)];
    const [s] = aggregateSeason(rows, RANGE);
    if (s.family !== "performance") throw new Error("expected performance");
    const e = s.events[0];
    expect(e).toMatchObject({ entries: 4, seasonBest: 69000, allTimeBest: 69000, seasonBestIsPB: true, pbCount: 1, bestRank: 1, lastMark: 69500 });
    expect(s.podiums).toBe(2);
    expect(formatMark(e.seasonBest, e.measure)).toBe("1:09.00");
  });

  it("performance: a season that doesn't beat the old best is not a PB", () => {
    const rows = [
      row("athletics", { family: "performance", eventName: "Long jump", measure: "distance", best: 500, status: "OK" }, 400),
      row("athletics", { family: "performance", eventName: "Long jump", measure: "distance", best: 480, status: "OK" }, 30),
    ];
    const [s] = aggregateSeason(rows, RANGE);
    if (s.family !== "performance") throw new Error("expected performance");
    expect(s.events[0]).toMatchObject({ seasonBest: 480, allTimeBest: 500, seasonBestIsPB: false, pbCount: 0 });
  });

  it("old or partial rows never throw", () => {
    const rows = [row("cricket", null, 1), row("football", "garbage", 2), row("tennis", { family: "tennis" }, 3)];
    expect(() => aggregateSeason(rows, RANGE)).not.toThrow();
    for (const s of aggregateSeason(rows, RANGE)) expect(() => headlineStats(s)).not.toThrow();
  });
});

describe("headline stats", () => {
  it("labels points for basketball and goals for football", () => {
    const [bb] = aggregateSeason([row("basketball", { family: "goals", result: "W", points: 12 }, 1)], RANGE);
    expect(headlineStats(bb).find((t) => t.key === "points")?.label).toBe("Points");
    const [fb] = aggregateSeason([row("football", { family: "goals", result: "W", points: 1 }, 1)], RANGE);
    expect(headlineStats(fb).find((t) => t.key === "points")?.label).toBe("Goals");
  });
});
