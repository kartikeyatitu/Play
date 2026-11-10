import { describe, it, expect } from "vitest";
import { fixtureScoreFromLive } from "@/lib/competition/live-result";
import type { LiveConfig, LiveState } from "@/lib/live-match";

const cfg = {} as LiveConfig;
const goals = (home: number, away: number, winner: "home" | "away" | "draw" | null) =>
  ({ family: "goals", goals: { score: { home, away }, winner } }) as unknown as LiveState;

describe("fixtureScoreFromLive", () => {
  it("uses goals for goal sports", () => {
    expect(fixtureScoreFromLive(goals(2, 1, "home"), cfg)).toEqual({ homeScore: 2, awayScore: 1, outcome: "home" });
    expect(fixtureScoreFromLive(goals(1, 1, "draw"), cfg)).toEqual({ homeScore: 1, awayScore: 1, outcome: "draw" });
  });

  it("returns nothing for an undecided match", () => {
    expect(fixtureScoreFromLive(goals(0, 0, null), cfg)).toBeNull();
  });

  it("uses sets won for rally sports and tennis", () => {
    const s = { family: "rally", rally: { setsWon: { home: 1, away: 2 }, winner: "away" } } as unknown as LiveState;
    expect(fixtureScoreFromLive(s, cfg)).toEqual({ homeScore: 1, awayScore: 2, outcome: "away" });
  });

  it("maps cricket innings to the right side", () => {
    const st = { family: "cricket", cricket: { result: "Team batting second won", innings: [{ runs: 120 }, { runs: 124 }] } } as unknown as LiveState;
    expect(fixtureScoreFromLive(st, { battingFirst: "away" } as LiveConfig)).toEqual({ homeScore: 124, awayScore: 120, outcome: "home" });
    expect(fixtureScoreFromLive(st, { battingFirst: "home" } as LiveConfig)).toEqual({ homeScore: 120, awayScore: 124, outcome: "away" });
  });

  it("records a stoppage win 1–0 when the winner was behind on points", () => {
    const st = { family: "bout", bout: { points: { home: 2, away: 6 }, deductions: { home: 0, away: 0 }, judges: {}, winner: "home", method: "KO" } } as unknown as LiveState;
    expect(fixtureScoreFromLive(st, cfg)).toEqual({ homeScore: 1, awayScore: 0, outcome: "home" });
  });

  it("gives nothing for athletics (no home and away)", () => {
    expect(fixtureScoreFromLive({ family: "performance", ranked: [] } as unknown as LiveState, cfg)).toBeNull();
  });
});
