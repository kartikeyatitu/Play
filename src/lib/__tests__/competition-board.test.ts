import { describe, expect, it } from "vitest";
import { buildFixturesBoard, type BoardCompetitionRow, type BoardFixtureRow } from "@/lib/competition/board";
import { drawModesFor, planDraw } from "@/lib/competition/draw";
import { liveSportKeyFor } from "@/lib/competition/live-link";
import { entryDisplayName } from "@/lib/competition/names";
import { detectDrawMode, groupLabel, knockoutRoundLabel, roundLabel } from "@/lib/competition/phase";

const comp = (over: Partial<BoardCompetitionRow> = {}): BoardCompetitionRow => ({
  id: "c1",
  name: "Winter Cup",
  sport: "Football",
  format: "LEAGUE",
  entryType: "TEAM",
  status: "SCHEDULED",
  legs: 1,
  venue: null,
  startDate: null,
  pointsWin: 3,
  pointsDraw: 1,
  pointsLoss: 0,
  allowDraws: true,
  ...over,
});
const entries = (names: string[]) => names.map((name, i) => ({ id: `e${i + 1}`, name, seed: null, status: "REGISTERED" }));
const rows = (fs: Omit<BoardFixtureRow, "id" | "scheduledAt" | "venue" | "homeScore" | "awayScore" | "winnerEntryId" | "version" | "status">[]): BoardFixtureRow[] =>
  fs.map((f) => ({ ...f, id: `f${f.round}-${f.slot}`, scheduledAt: null, venue: null, status: "SCHEDULED", homeScore: null, awayScore: null, winnerEntryId: null, version: 0 }));

describe("entryDisplayName", () => {
  it("never shows an individual's full name", () => {
    expect(entryDisplayName("Aarav Kumar Sharma", "INDIVIDUAL")).toBe("Aarav S.");
    expect(entryDisplayName("  diya   patel ", "INDIVIDUAL")).toBe("diya P.");
    expect(entryDisplayName("Kabir", "INDIVIDUAL")).toBe("Kabir");
    expect(entryDisplayName("Aarav Sharma (2)", "INDIVIDUAL")).toBe("Aarav S. (2)");
  });
  it("shows team names as they are", () => {
    expect(entryDisplayName("Noida Strikers U12", "TEAM")).toBe("Noida Strikers U12");
  });
});

describe("phase labels", () => {
  it("names knockout rounds", () => {
    expect(knockoutRoundLabel(3, 3)).toBe("Final");
    expect(knockoutRoundLabel(2, 3)).toBe("Semi-final");
    expect(knockoutRoundLabel(1, 3)).toBe("Quarter-final");
    expect(knockoutRoundLabel(1, 5)).toBe("Round of 32");
    expect(groupLabel(0)).toBe("Group A");
  });
  it("labels persisted rounds per draw mode", () => {
    const ko = [{ round: 1 }, { round: 2 }];
    expect(roundLabel("KNOCKOUT", 1, ko)).toBe("Semi-final");
    expect(roundLabel("ROUND_ROBIN", 4, [])).toBe("Round 4");
    const grp = [{ round: 1 }, { round: 3 }, { round: 201 }, { round: 202 }];
    expect(roundLabel("GROUPS", 3, grp)).toBe("Matchday 3");
    expect(roundLabel("GROUPS", 202, grp)).toBe("Final");
  });
  it("detects the draw mode from fixtures", () => {
    expect(detectDrawMode("LEAGUE", [])).toBe("ROUND_ROBIN");
    expect(detectDrawMode("KNOCKOUT", [{ round: 3 }])).toBe("KNOCKOUT");
    expect(detectDrawMode("LEAGUE", [{ round: 1 }, { round: 101 }])).toBe("GROUPS");
  });
});

describe("planDraw", () => {
  const e = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `e${i + 1}`, seed: null, createdAt: new Date(2026, 0, 1, 0, i) }));
  it("offers draw types by format", () => {
    expect(drawModesFor("LEAGUE")).toEqual(["ROUND_ROBIN", "GROUPS"]);
    expect(drawModesFor("KNOCKOUT")).toEqual(["KNOCKOUT", "GROUPS"]);
  });
  it("counts real matches for each mode", () => {
    const rr = planDraw(e(6), { mode: "ROUND_ROBIN", double: true });
    expect(rr.ok && rr.plan.matches).toBe(30);
    const ko = planDraw(e(6), { mode: "KNOCKOUT" });
    expect(ko.ok && ko.plan.matches).toBe(5);
    const g = planDraw(e(8), { mode: "GROUPS", groups: 2, advance: 2 });
    expect(g.ok && g.plan.matches).toBe(12 + 3);
  });
  it("respects seeds", () => {
    const list = e(4).map((x, i) => ({ ...x, seed: i === 3 ? 1 : null }));
    const ko = planDraw(list, { mode: "KNOCKOUT" });
    expect(ko.ok && ko.plan.fixtures[0].homeEntryId).toBe("e4");
  });
  it("refuses too few entries and bad group shapes", () => {
    expect(planDraw(e(1), { mode: "ROUND_ROBIN" }).ok).toBe(false);
    expect(planDraw(e(4), { mode: "GROUPS", groups: 2, advance: 2 }).ok).toBe(false);
    expect(planDraw(e(65), { mode: "KNOCKOUT" }).ok).toBe(false);
  });
});

describe("liveSportKeyFor", () => {
  it("maps free-text sport names to head-to-head live sports", () => {
    expect(liveSportKeyFor("Football")).toBe("football");
    expect(liveSportKeyFor("Table Tennis")).toBe("table_tennis");
    expect(liveSportKeyFor("table-tennis")).toBe("table_tennis");
    expect(liveSportKeyFor("Athletics")).toBeNull();
    expect(liveSportKeyFor("Quidditch")).toBeNull();
    expect(liveSportKeyFor(null)).toBeNull();
  });
});

describe("buildFixturesBoard", () => {
  it("league: rounds, resting entries, table and unscheduled count", () => {
    const fx = rows([
      { round: 1, slot: 0, homeEntryId: "e1", awayEntryId: "e2" },
      { round: 2, slot: 0, homeEntryId: "e3", awayEntryId: "e1" },
      { round: 3, slot: 0, homeEntryId: "e2", awayEntryId: "e3" },
    ]);
    fx[0] = { ...fx[0], status: "COMPLETED", homeScore: 2, awayScore: 0, winnerEntryId: "e1" };
    const b = buildFixturesBoard(comp(), entries(["Alpha", "Bravo", "Charlie"]), fx);
    expect(b.mode).toBe("ROUND_ROBIN");
    expect(b.rounds.map((r) => r.label)).toEqual(["Round 1", "Round 2", "Round 3"]);
    expect(b.rounds[0].resting).toEqual(["Charlie"]);
    expect(b.tables).toHaveLength(1);
    expect(b.tables[0].rows[0]).toMatchObject({ name: "Alpha", points: 3 });
    expect(b.hasResults).toBe(true);
    expect(b.unscheduled).toBe(2);
    expect(b.bracket).toEqual([]);
  });

  it("individual entries are shown as first name and initial everywhere", () => {
    const fx = rows([{ round: 1, slot: 0, homeEntryId: "e1", awayEntryId: "e2" }]);
    const b = buildFixturesBoard(comp({ entryType: "INDIVIDUAL" }), entries(["Aarav Sharma", "Diya Patel"]), fx);
    const json = JSON.stringify(b);
    expect(json).not.toContain("Sharma");
    expect(json).not.toContain("Patel");
    expect(b.rounds[0].fixtures[0].homeName).toBe("Aarav S.");
    expect(b.tables[0].rows.map((r) => r.name).sort()).toEqual(["Aarav S.", "Diya P."]);
  });

  it("knockout: bracket rounds, champion, ties need a winner", () => {
    const fx = rows([
      { round: 1, slot: 0, homeEntryId: "e1", awayEntryId: "e4" },
      { round: 1, slot: 1, homeEntryId: "e2", awayEntryId: "e3" },
      { round: 2, slot: 0, homeEntryId: "e1", awayEntryId: "e2" },
    ]);
    fx[2] = { ...fx[2], status: "COMPLETED", homeScore: 1, awayScore: 1, winnerEntryId: "e2" };
    const b = buildFixturesBoard(comp({ format: "KNOCKOUT", allowDraws: false }), entries(["A", "B", "C", "D"]), fx);
    expect(b.mode).toBe("KNOCKOUT");
    expect(b.bracket.map((r) => r.label)).toEqual(["Semi-final", "Final"]);
    expect(b.champion).toBe("B");
    expect(b.rounds[0].fixtures[0].needsWinnerOnTie).toBe(true);
    expect(b.tables).toEqual([]);
  });

  it("groups: per-group tables, group-stage state and an unseeded bracket", () => {
    const fx = rows([
      { round: 1, slot: 0, homeEntryId: "e1", awayEntryId: "e2" },
      { round: 1, slot: 100, homeEntryId: "e3", awayEntryId: "e4" },
      { round: 101, slot: 0, homeEntryId: null, awayEntryId: null },
    ]);
    fx[0] = { ...fx[0], status: "COMPLETED", homeScore: 0, awayScore: 3, winnerEntryId: "e2" };
    const b = buildFixturesBoard(comp(), entries(["A", "B", "C", "D"]), fx);
    expect(b.mode).toBe("GROUPS");
    expect(b.tables.map((t) => t.label)).toEqual(["Group A", "Group B"]);
    expect(b.tables[0].rows[0].name).toBe("B");
    expect(b.groupStage).toEqual({ groups: 2, advance: 1, complete: false, seeded: false });
    expect(b.rounds[0].fixtures.map((f) => f.group)).toEqual(["Group A", "Group B"]);
    expect(b.rounds.map((r) => r.label)).toEqual(["Matchday 1", "Final"]);
    expect(b.bracket[0].fixtures[0].playable).toBe(false);
    expect(b.rounds[0].fixtures[0].needsWinnerOnTie).toBe(false);
  });

  it("links live matches, preferring one that isn't abandoned", () => {
    const fx = rows([{ round: 1, slot: 0, homeEntryId: "e1", awayEntryId: "e2" }]);
    const b = buildFixturesBoard(comp(), entries(["A", "B"]), fx, [
      { id: "m1", fixtureId: "f1-0", status: "LIVE" },
      { id: "m0", fixtureId: "f1-0", status: "ABANDONED" },
    ]);
    expect(b.rounds[0].fixtures[0].live).toEqual({ id: "m1", status: "LIVE" });
  });
});
