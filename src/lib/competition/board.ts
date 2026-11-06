// View model for the fixtures screens, built from DB rows. Pure, client-safe; no full names of
// individual entries leave this function (see entryDisplayName).
import { entryDisplayName } from "./names";
import {
  detectDrawMode,
  groupDrawShape,
  groupLabel,
  groupOfSlot,
  isKnockoutPhaseRound,
  knockoutRoundIndex,
  roundLabel,
  type DrawMode,
} from "./phase";
import { computeTable, type PointsSettings, type TableFixture, type TableRow } from "./standings";

export type BoardCompetitionRow = {
  id: string;
  name: string;
  sport: string | null;
  format: string;
  entryType: string;
  status: string;
  legs: number;
  venue: string | null;
  startDate: Date | null;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  allowDraws: boolean;
};
export type BoardEntryRow = { id: string; name: string; seed: number | null; status: string };
export type BoardFixtureRow = {
  id: string;
  round: number;
  slot: number;
  homeEntryId: string | null;
  awayEntryId: string | null;
  scheduledAt: Date | null;
  venue: string | null;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  winnerEntryId: string | null;
  version: number;
};
export type BoardLiveRow = { id: string; fixtureId: string | null; status: string };

export type FixtureCompetitionOption = { id: string; name: string; format: string; status: string; entries: number; fixtures: number };

export type FixtureCard = {
  id: string;
  round: number;
  slot: number;
  phase: "league" | "group" | "knockout";
  group: string | null;
  homeEntryId: string | null;
  awayEntryId: string | null;
  homeName: string | null;
  awayName: string | null;
  scheduledAt: string | null;
  venue: string | null;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  winnerEntryId: string | null;
  version: number;
  /** Both sides known and the fixture takes a result. */
  playable: boolean;
  /** Level scores need a named winner (knockout ties). */
  needsWinnerOnTie: boolean;
  live: { id: string; status: string } | null;
};

export type BoardRound = { round: number; label: string; phase: FixtureCard["phase"]; fixtures: FixtureCard[]; resting: string[] };
export type BoardTable = { label: string; rows: TableRow[] };
export type BracketRound = { label: string; fixtures: FixtureCard[] };

export type FixturesBoard = {
  competition: {
    id: string;
    name: string;
    sport: string | null;
    format: string;
    entryType: string;
    status: string;
    legs: number;
    venue: string | null;
    startDate: string | null;
    points: PointsSettings;
  };
  mode: DrawMode;
  entries: { id: string; name: string; seed: number | null }[];
  rounds: BoardRound[];
  tables: BoardTable[];
  bracket: BracketRound[];
  groupStage: { groups: number; advance: number; complete: boolean; seeded: boolean } | null;
  hasFixtures: boolean;
  hasResults: boolean;
  unscheduled: number;
  champion: string | null;
};

const decided = (s: string) => s === "COMPLETED" || s === "BYE" || s === "CANCELLED";

export function pointsOf(c: Pick<BoardCompetitionRow, "pointsWin" | "pointsDraw" | "pointsLoss" | "allowDraws">): PointsSettings {
  return { pointsWin: c.pointsWin, pointsDraw: c.pointsDraw, pointsLoss: c.pointsLoss, allowDraws: c.allowDraws };
}

/** Group number → entry ids in that group, read from the group-stage fixtures. */
export function groupMembers(fixtures: Pick<BoardFixtureRow, "round" | "slot" | "homeEntryId" | "awayEntryId">[]): Map<number, string[]> {
  const out = new Map<number, string[]>();
  const sorted = [...fixtures].filter((f) => !isKnockoutPhaseRound(f.round)).sort((a, b) => a.round - b.round || a.slot - b.slot);
  for (const f of sorted) {
    const g = groupOfSlot(f.slot);
    const list = out.get(g) ?? [];
    for (const e of [f.homeEntryId, f.awayEntryId]) if (e && !list.includes(e)) list.push(e);
    out.set(g, list);
  }
  return out;
}

/** Final (or current) table for each group, in group order. */
export function groupTables(
  entries: { id: string; name: string }[],
  fixtures: (TableFixture & { round: number; slot: number })[],
  points: PointsSettings
): { group: number; rows: TableRow[] }[] {
  const members = groupMembers(fixtures);
  const name = new Map(entries.map((e) => [e.id, e.name]));
  return [...members.keys()]
    .sort((a, b) => a - b)
    .map((g) => {
      const ids = members.get(g)!;
      const groupFixtures = fixtures.filter((f) => !isKnockoutPhaseRound(f.round) && groupOfSlot(f.slot) === g);
      return { group: g, rows: computeTable(ids.map((id) => ({ id, name: name.get(id) ?? "" })), groupFixtures, points) };
    });
}

export function buildFixturesBoard(
  c: BoardCompetitionRow,
  entryRows: BoardEntryRow[],
  fixtureRows: BoardFixtureRow[],
  liveRows: BoardLiveRow[] = []
): FixturesBoard {
  const mode = detectDrawMode(c.format, fixtureRows);
  const display = new Map(entryRows.map((e) => [e.id, entryDisplayName(e.name, c.entryType)]));
  const live = new Map<string, { id: string; status: string }>();
  for (const l of liveRows) if (l.fixtureId && (!live.has(l.fixtureId) || l.status !== "ABANDONED")) live.set(l.fixtureId, { id: l.id, status: l.status });
  const points = pointsOf(c);

  const card = (f: BoardFixtureRow): FixtureCard => {
    const ko = mode === "KNOCKOUT" || (mode === "GROUPS" && isKnockoutPhaseRound(f.round));
    const phase: FixtureCard["phase"] = ko ? "knockout" : mode === "GROUPS" ? "group" : "league";
    return {
      id: f.id,
      round: f.round,
      slot: f.slot,
      phase,
      group: phase === "group" ? groupLabel(groupOfSlot(f.slot)) : null,
      homeEntryId: f.homeEntryId,
      awayEntryId: f.awayEntryId,
      homeName: f.homeEntryId ? (display.get(f.homeEntryId) ?? "—") : null,
      awayName: f.awayEntryId ? (display.get(f.awayEntryId) ?? "—") : null,
      scheduledAt: f.scheduledAt ? f.scheduledAt.toISOString() : null,
      venue: f.venue,
      status: f.status,
      homeScore: f.homeScore,
      awayScore: f.awayScore,
      winnerEntryId: f.winnerEntryId,
      version: f.version,
      playable: !!f.homeEntryId && !!f.awayEntryId && f.status !== "BYE" && f.status !== "CANCELLED",
      needsWinnerOnTie: ko,
      live: live.get(f.id) ?? null,
    };
  };

  const sorted = [...fixtureRows].sort((a, b) => a.round - b.round || a.slot - b.slot);
  const cards = sorted.map(card);
  const registered = entryRows.filter((e) => e.status === "REGISTERED");
  const roundNumbers = [...new Set(sorted.map((f) => f.round))];
  const rounds: BoardRound[] = roundNumbers.map((r) => {
    const fs = cards.filter((f) => f.round === r);
    const phase = fs[0]?.phase ?? "league";
    let resting: string[] = [];
    if (phase === "league") {
      const playing = new Set(fs.flatMap((f) => [f.homeEntryId, f.awayEntryId]));
      resting = registered.filter((e) => !playing.has(e.id)).map((e) => display.get(e.id)!);
    }
    return { round: r, label: roundLabel(mode, r, sorted), phase, fixtures: fs, resting };
  });

  const tableEntries = registered.map((e) => ({ id: e.id, name: display.get(e.id)! }));
  let tables: BoardTable[] = [];
  let groupStage: FixturesBoard["groupStage"] = null;
  if (mode === "ROUND_ROBIN" && sorted.length) tables = [{ label: "Table", rows: computeTable(tableEntries, sorted, points) }];
  if (mode === "GROUPS") {
    tables = groupTables(tableEntries, sorted, points).map((t) => ({ label: groupLabel(t.group), rows: t.rows }));
    const shape = groupDrawShape(sorted);
    const groupFixtures = sorted.filter((f) => !isKnockoutPhaseRound(f.round));
    const koFirst = sorted.filter((f) => isKnockoutPhaseRound(f.round) && knockoutRoundIndex(f.round) === 1);
    groupStage = {
      ...shape,
      complete: groupFixtures.length > 0 && groupFixtures.every((f) => decided(f.status)),
      seeded: koFirst.some((f) => f.homeEntryId || f.awayEntryId),
    };
  }

  let bracket: BracketRound[] = [];
  const koCards = cards.filter((f) => f.phase === "knockout");
  if (koCards.length) {
    bracket = [...new Set(koCards.map((f) => f.round))].map((r) => ({ label: roundLabel(mode, r, sorted), fixtures: koCards.filter((f) => f.round === r) }));
  }
  let champion: string | null = null;
  const final = bracket[bracket.length - 1]?.fixtures;
  if (final?.length === 1 && decided(final[0].status) && final[0].winnerEntryId) champion = display.get(final[0].winnerEntryId) ?? null;

  return {
    competition: {
      id: c.id,
      name: c.name,
      sport: c.sport,
      format: c.format,
      entryType: c.entryType,
      status: c.status,
      legs: c.legs,
      venue: c.venue,
      startDate: c.startDate ? c.startDate.toISOString().slice(0, 10) : null,
      points,
    },
    mode,
    entries: registered.map((e) => ({ id: e.id, name: display.get(e.id)!, seed: e.seed })),
    rounds,
    tables,
    bracket,
    groupStage,
    hasFixtures: sorted.length > 0,
    hasResults: sorted.some((f) => f.status === "COMPLETED"),
    unscheduled: sorted.filter((f) => !f.scheduledAt && !decided(f.status)).length,
    champion,
  };
}
