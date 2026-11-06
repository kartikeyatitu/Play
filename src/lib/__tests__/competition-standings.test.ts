import { describe, expect, it } from "vitest";
import { computeTable, type PointsSettings, type TableFixture } from "@/lib/competition/standings";

const P: PointsSettings = { pointsWin: 3, pointsDraw: 1, pointsLoss: 0, allowDraws: true };
const E = (...names: string[]) => names.map((n) => ({ id: n.toLowerCase(), name: n }));
const done = (home: string, away: string, hs: number, as: number, winnerEntryId: string | null = null): TableFixture => ({
  homeEntryId: home,
  awayEntryId: away,
  homeScore: hs,
  awayScore: as,
  winnerEntryId,
  status: "COMPLETED",
});
const order = (rows: { entryId: string }[]) => rows.map((r) => r.entryId);

describe("computeTable", () => {
  it("counts played, won, drawn, lost, for, against, difference, points", () => {
    const rows = computeTable(E("A", "B", "C"), [done("a", "b", 2, 1), done("b", "c", 0, 0), done("c", "a", 3, 1)], P);
    const a = rows.find((r) => r.entryId === "a")!;
    expect(a).toMatchObject({ played: 2, won: 1, drawn: 0, lost: 1, for: 3, against: 4, difference: -1, points: 3 });
    const b = rows.find((r) => r.entryId === "b")!;
    expect(b).toMatchObject({ played: 2, won: 0, drawn: 1, lost: 1, for: 1, against: 2, difference: -1, points: 1 });
    const c = rows.find((r) => r.entryId === "c")!;
    expect(c).toMatchObject({ played: 2, won: 1, drawn: 1, lost: 0, for: 3, against: 1, difference: 2, points: 4 });
    expect(order(rows)).toEqual(["c", "a", "b"]);
    expect(rows.map((r) => r.position)).toEqual([1, 2, 3]);
  });

  it("uses the competition's points settings", () => {
    const rows = computeTable(E("A", "B"), [done("a", "b", 1, 1), done("b", "a", 2, 0)], { pointsWin: 2, pointsDraw: 1, pointsLoss: 1, allowDraws: true });
    expect(rows.find((r) => r.entryId === "b")!.points).toBe(3);
    expect(rows.find((r) => r.entryId === "a")!.points).toBe(2);
  });

  it("ignores fixtures that aren't completed, are byes or involve unknown entries", () => {
    const rows = computeTable(
      E("A", "B"),
      [
        { ...done("a", "b", 5, 0), status: "SCHEDULED" },
        { ...done("a", "b", 5, 0), status: "POSTPONED" },
        { homeEntryId: "a", awayEntryId: null, homeScore: null, awayScore: null, status: "BYE" },
        done("a", "zz", 9, 0),
        { ...done("a", "b", 1, 0), homeScore: null },
      ],
      P
    );
    expect(rows.every((r) => r.played === 0 && r.points === 0)).toBe(true);
  });

  it("level score with a recorded winner counts as a win when draws are off; without a winner it's left out", () => {
    const noDraws = { ...P, allowDraws: false };
    const rows = computeTable(E("A", "B", "C"), [done("a", "b", 1, 1, "b"), done("a", "c", 2, 2)], noDraws);
    expect(rows.find((r) => r.entryId === "b")).toMatchObject({ won: 1, points: 3, played: 1 });
    expect(rows.find((r) => r.entryId === "a")).toMatchObject({ lost: 1, played: 1, drawn: 0 });
    expect(rows.find((r) => r.entryId === "c")!.played).toBe(0);
  });

  it("level score counts as a draw when draws are allowed", () => {
    const rows = computeTable(E("A", "B"), [done("a", "b", 2, 2)], P);
    expect(rows.every((r) => r.drawn === 1 && r.points === 1)).toBe(true);
  });

  it("tie-breaker 2: score difference beats scores for", () => {
    // A and B both 3 pts. A: +3 (3-0). B: +1 (5-4).
    const rows = computeTable(E("A", "B", "C", "D"), [done("a", "c", 3, 0), done("b", "d", 5, 4)], P);
    expect(order(rows).slice(0, 2)).toEqual(["a", "b"]);
  });

  it("tie-breaker 3: scores for when points and difference are level", () => {
    const rows = computeTable(E("A", "B", "C", "D"), [done("a", "c", 1, 0), done("b", "d", 4, 3)], P);
    expect(order(rows).slice(0, 2)).toEqual(["b", "a"]);
  });

  it("tie-breaker 4: head-to-head only after points, difference and for are all level", () => {
    // Z beats Y 1-0, Y beats X 3-0 (so Y's difference is +2), X beats Z 2-1… construct exact level.
    // Y and Z: both 3 pts, diff 0, for 2 → Z won their meeting.
    const fixtures = [done("z", "y", 1, 0), done("y", "x", 2, 1), done("x", "z", 2, 1)];
    const rows = computeTable(E("X", "Y", "Z"), fixtures, P);
    // All three: 3 pts, diff 0, for 2 except x (for 3) → x first by "for".
    expect(rows.find((r) => r.entryId === "x")!.for).toBe(3);
    expect(order(rows)[0]).toBe("x");
    // y and z level on points (3), difference (0) and for (2): z beat y.
    expect(order(rows).slice(1)).toEqual(["z", "y"]);
  });

  it("head-to-head is not used ahead of difference", () => {
    // B beat A head-to-head, but A has the better difference overall.
    const rows = computeTable(E("A", "B", "C", "D"), [done("b", "a", 1, 0), done("a", "c", 5, 0), done("d", "b", 1, 0)], P);
    expect(rows.find((r) => r.entryId === "a")!.points).toBe(3);
    expect(rows.find((r) => r.entryId === "b")!.points).toBe(3);
    expect(order(rows).indexOf("a")).toBeLessThan(order(rows).indexOf("b"));
  });

  it("head-to-head mini-league among three tied entries", () => {
    // P, Q, R each beat S 1-0 and draw each other 1-1 → all level everywhere: falls to name.
    const fixtures = [done("p", "s", 1, 0), done("q", "s", 1, 0), done("r", "s", 1, 0), done("p", "q", 1, 1), done("q", "r", 1, 1), done("r", "p", 1, 1)];
    expect(order(computeTable(E("R", "Q", "P", "S"), fixtures, P))).toEqual(["p", "q", "r", "s"]);
  });

  it("falls back to name then id, so the order is stable", () => {
    const rows = computeTable([{ id: "2", name: "Same" }, { id: "1", name: "Same" }, { id: "3", name: "Alpha" }], [], P);
    expect(order(rows)).toEqual(["3", "1", "2"]);
    expect(computeTable(E("C", "B", "A"), [], P)).toEqual(computeTable(E("A", "C", "B"), [], P));
  });

  it("includes entries with no games played", () => {
    const rows = computeTable(E("A", "B", "C"), [done("a", "b", 1, 0)], P);
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.entryId === "c")!.played).toBe(0);
  });
});
