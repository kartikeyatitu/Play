import { describe, expect, it } from "vitest";
import { GOALS_SPORTS, scoreGoals } from "@/lib/scoring/goals";
import { RALLY_SPORTS, scoreRally, setWon } from "@/lib/scoring/rally";
import { scoreTennis, TENNIS_DEFAULT } from "@/lib/scoring/tennis";
import { formatDistance, formatTime, isPersonalBest, rankResults } from "@/lib/scoring/performance";
import { BOUT_SPORTS, scoreBout } from "@/lib/scoring/bout";
import { chessStandings, eloUpdate, expectedScore } from "@/lib/scoring/chess";

describe("goals family", () => {
  it("scores football with own goals credited to the opponent", () => {
    const s = scoreGoals(
      [
        { type: "period_start", period: 1 },
        { type: "score", side: "home", kind: "goal", player: "Aarav", assist: "Kabir", minute: 12 },
        { type: "score", side: "home", kind: "own_goal", player: "Ishaan", minute: 30 },
        { type: "card", side: "away", colour: "yellow", player: "Dev" },
        { type: "period_end", period: 1 },
        { type: "period_start", period: 2 },
        { type: "score", side: "home", kind: "penalty", player: "Aarav", minute: 70 },
        { type: "period_end", period: 2 },
      ],
      GOALS_SPORTS.football,
    );
    expect(s.score).toEqual({ home: 2, away: 1 });
    expect(s.byPeriod).toEqual([{ home: 1, away: 1 }, { home: 1, away: 0 }]);
    expect(s.finished).toBe(true);
    expect(s.winner).toBe("home");
    expect(s.players.find((p) => p.player === "Aarav")).toMatchObject({ points: 2, scores: { goal: 1, penalty: 1 } });
    expect(s.players.find((p) => p.player === "Kabir")?.assists).toBe(1);
    expect(s.players.find((p) => p.player === "Ishaan")).toBeUndefined();
  });
  it("weights basketball shots and ignores unknown kinds", () => {
    const s = scoreGoals(
      [
        { type: "period_start", period: 1 },
        { type: "score", side: "away", kind: "3pt", player: "Myra" },
        { type: "score", side: "away", kind: "ft", player: "Myra" },
        { type: "score", side: "home", kind: "2pt", player: "Sara" },
        { type: "score", side: "home", kind: "goal" },
      ],
      GOALS_SPORTS.basketball,
    );
    expect(s.score).toEqual({ home: 2, away: 4 });
    expect(s.finished).toBe(false);
    expect(s.winner).toBeNull();
  });
});

describe("rally family", () => {
  it("applies win-by-two and the cap", () => {
    expect(setWon(21, 19, 21, 2, 30)).toBe(true);
    expect(setWon(21, 20, 21, 2, 30)).toBe(false);
    expect(setWon(30, 29, 21, 2, 30)).toBe(true);
  });
  it("plays a best-of-three badminton match", () => {
    const pts = (side: "home" | "away", n: number) => Array.from({ length: n }, () => ({ type: "point" as const, side }));
    const s = scoreRally([...pts("home", 21), ...pts("away", 21), ...pts("home", 20), ...pts("away", 20), ...pts("home", 2)], RALLY_SPORTS.badminton);
    expect(s.sets).toEqual([{ home: 21, away: 0 }, { home: 0, away: 21 }, { home: 22, away: 20 }]);
    expect(s.winner).toBe("home");
  });
  it("uses a shorter deciding set in volleyball", () => {
    const pts = (side: "home" | "away", n: number) => Array.from({ length: n }, () => ({ type: "point" as const, side }));
    const s = scoreRally([...pts("home", 25), ...pts("away", 25), ...pts("home", 25), ...pts("away", 25), ...pts("away", 15)], RALLY_SPORTS.volleyball);
    expect(s.sets[4]).toEqual({ home: 0, away: 15 });
    expect(s.winner).toBe("away");
  });
});

describe("tennis", () => {
  const pts = (side: "home" | "away", n: number) => Array.from({ length: n }, () => ({ type: "point" as const, side }));
  it("calls points, deuce and advantage", () => {
    expect(scoreTennis(pts("home", 2)).display).toBe("30–0");
    expect(scoreTennis([...pts("home", 3), ...pts("away", 3)]).display).toBe("Deuce");
    expect(scoreTennis([...pts("home", 3), ...pts("away", 3), ...pts("away", 1)]).display).toBe("Advantage away");
  });
  it("wins a set 6-0 and plays a tiebreak at 6-6", () => {
    const game = (s: "home" | "away") => pts(s, 4);
    const s1 = scoreTennis(Array.from({ length: 6 }, () => game("home")).flat());
    expect(s1.sets).toEqual([{ home: 6, away: 0 }]);
    const to66 = Array.from({ length: 6 }, () => [...game("home"), ...game("away")]).flat();
    const tb = scoreTennis([...to66, ...pts("away", 7)], TENNIS_DEFAULT);
    expect(tb.sets[0]).toEqual({ home: 6, away: 7 });
    expect(tb.setsWon.away).toBe(1);
  });
});

describe("performance family", () => {
  it("ranks times (lower wins) with ties and DNFs", () => {
    const r = rankResults(
      [
        { athlete: "A", value: 31200 },
        { athlete: "B", value: 30950 },
        { athlete: "C", value: 31200 },
        { athlete: "D", value: null, status: "DNF" },
      ],
      "time",
    );
    expect(r.map((x) => [x.athlete, x.rank])).toEqual([["B", 1], ["A", 2], ["C", 2], ["D", null]]);
    expect(r[3].status).toBe("DNF");
  });
  it("takes the best of several field attempts (higher wins)", () => {
    const r = rankResults([{ athlete: "A", value: 540, attempt: 1 }, { athlete: "A", value: 575, attempt: 2 }, { athlete: "B", value: 560 }], "distance");
    expect(r[0]).toMatchObject({ athlete: "A", best: 575, rank: 1 });
  });
  it("detects personal bests and formats marks", () => {
    expect(isPersonalBest(30000, 30500, "time")).toBe(true);
    expect(isPersonalBest(500, 560, "distance")).toBe(false);
    expect(formatTime(63450)).toBe("1:03.45");
    expect(formatTime(9580)).toBe("9.58");
    expect(formatDistance(645)).toBe("6.45 m");
  });
});

describe("bouts", () => {
  it("ends on a point gap, a stoppage, or the judges", () => {
    const gap = scoreBout([{ type: "score", side: "home", points: 3, round: 1 }, { type: "score", side: "home", points: 5, round: 1 }], BOUT_SPORTS.karate);
    expect(gap).toMatchObject({ winner: "home", method: "Point gap" });
    const ko = scoreBout([{ type: "stoppage", winner: "away", method: "KO" }], BOUT_SPORTS.boxing);
    expect(ko).toMatchObject({ winner: "away", method: "KO" });
    const dec = scoreBout(
      [
        { type: "judge_card", judge: "J1", round: 1, home: 10, away: 9 },
        { type: "judge_card", judge: "J2", round: 1, home: 9, away: 10 },
        { type: "judge_card", judge: "J3", round: 1, home: 10, away: 9 },
      ],
      BOUT_SPORTS.boxing,
      true,
    );
    expect(dec).toMatchObject({ winner: "home", method: "Decision 2–1" });
  });
});

describe("chess", () => {
  it("updates Elo symmetrically and builds standings", () => {
    expect(expectedScore(1500, 1500)).toBe(0.5);
    expect(eloUpdate(1500, 1500, "1-0", 20)).toEqual({ white: 1510, black: 1490 });
    const t = chessStandings([
      { white: "A", black: "B", result: "1-0" },
      { white: "B", black: "C", result: "1/2-1/2" },
      { white: "C", black: "A", result: "0-1" },
    ]);
    expect(t.map((r) => [r.player, r.points])).toEqual([["A", 2], ["B", 0.5], ["C", 0.5]]);
  });
});
