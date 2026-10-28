import { describe, expect, it } from "vitest";
import { oversText, requiredRunRate, runRate, scoreCricket, type CricketEvent } from "@/lib/scoring/cricket";

const ball = (runs: number, extra?: CricketEvent extends never ? never : any, wicket?: any, striker = "A", nonStriker = "B", bowler = "X"): CricketEvent => ({ type: "ball", striker, nonStriker, bowler, runs, extra, wicket });

describe("cricket engine", () => {
  it("counts runs, overs, fours/sixes and rotates strike", () => {
    const s = scoreCricket([ball(1), ball(4, undefined, undefined, "B", "A"), ball(6, undefined, undefined, "B", "A")], { oversPerInnings: 5 });
    const inn = s.innings[0];
    expect(inn.runs).toBe(11);
    expect(oversText(inn.legalBalls)).toBe("0.3");
    expect(inn.batting.find((b) => b.player === "A")).toMatchObject({ runs: 1, balls: 1 });
    expect(inn.batting.find((b) => b.player === "B")).toMatchObject({ runs: 10, balls: 2, fours: 1, sixes: 1 });
    expect(inn.striker).toBe("B");
  });
  it("handles wides, no-balls, byes and leg byes", () => {
    const s = scoreCricket(
      [ball(0, { kind: "wide" }), ball(4, { kind: "noball" }), ball(0, { kind: "legbye", runs: 2 }), ball(0, { kind: "wide", runs: 4 })],
      { oversPerInnings: 5 },
    );
    const inn = s.innings[0];
    expect(inn.runs).toBe(1 + 5 + 2 + 5);
    expect(inn.legalBalls).toBe(1);
    expect(inn.extras).toEqual({ wides: 6, noballs: 1, byes: 0, legbyes: 2, total: 9 });
    const bowler = inn.bowling[0];
    expect(bowler).toMatchObject({ runs: 11, balls: 1, wides: 6, noballs: 1 });
    expect(inn.batting.find((b) => b.player === "A")).toMatchObject({ runs: 4, balls: 2, fours: 1 });
  });
  it("credits wickets correctly and records dismissals", () => {
    const s = scoreCricket(
      [ball(0, undefined, { kind: "caught", playerOut: "A", fielder: "F" }), ball(1, undefined, { kind: "runout", playerOut: "C", fielder: "G" }, "C", "B")],
      { oversPerInnings: 5 },
    );
    const inn = s.innings[0];
    expect(inn.wickets).toBe(2);
    expect(inn.bowling[0].wickets).toBe(1);
    expect(inn.batting.find((b) => b.player === "A")?.out).toBe("c F b X");
    expect(inn.batting.find((b) => b.player === "C")?.out).toBe("run out (G)");
  });
  it("records a maiden and swaps strike at the end of an over", () => {
    const s = scoreCricket(Array.from({ length: 6 }, () => ball(0)), { oversPerInnings: 5 });
    expect(s.innings[0].bowling[0].maidens).toBe(1);
    expect(s.innings[0].striker).toBe("B");
  });
  it("sets a target, chases it and declares the result", () => {
    const first = Array.from({ length: 6 }, () => ball(1));
    const second: CricketEvent[] = [ball(4, undefined, undefined, "P", "Q", "Y"), ball(4, undefined, undefined, "P", "Q", "Y")];
    const s = scoreCricket([...first, ...second], { oversPerInnings: 1 });
    expect(s.innings[0]).toMatchObject({ runs: 6, complete: true });
    expect(s.target).toBe(7);
    expect(s.innings[1].runs).toBe(8);
    expect(s.result).toBe("Team batting second won by 10 wickets");
  });
  it("reports defending wins, ties and rates", () => {
    const s = scoreCricket([...Array.from({ length: 6 }, () => ball(2)), ...Array.from({ length: 6 }, () => ball(1, undefined, undefined, "P", "Q", "Y"))], { oversPerInnings: 1 });
    expect(s.result).toBe("Team batting first won by 6 runs");
    expect(runRate(12, 6)).toBe(12);
    const mid = scoreCricket([...Array.from({ length: 6 }, () => ball(2)), ball(1, undefined, undefined, "P", "Q", "Y")], { oversPerInnings: 1 });
    expect(requiredRunRate(mid, { oversPerInnings: 1 })).toBeCloseTo((12 * 6) / 5);
    const tie = scoreCricket([...Array.from({ length: 6 }, () => ball(1)), ...Array.from({ length: 6 }, () => ball(1, undefined, undefined, "P", "Q", "Y"))], { oversPerInnings: 1 });
    expect(tie.result).toBe("Match tied");
  });
});
