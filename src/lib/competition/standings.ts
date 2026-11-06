// League and group tables from completed fixtures. Pure, deterministic, client-safe.

export type PointsSettings = { pointsWin: number; pointsDraw: number; pointsLoss: number; allowDraws: boolean };

export type TableFixture = {
  homeEntryId: string | null;
  awayEntryId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerEntryId?: string | null;
  status: string;
};

export type TableRow = {
  position: number;
  entryId: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  for: number;
  against: number;
  difference: number;
  points: number;
};

type Counted = { home: string; away: string; hs: number; as: number; outcome: "H" | "A" | "D" };

/**
 * Who won a completed fixture. A higher score wins. Level scores are a draw when draws are allowed
 * and no winner was recorded; otherwise the recorded winner (penalties, tie-break) takes it. A level
 * score with draws off and no winner can't be placed, so it's left out of the table.
 */
function outcomeOf(f: TableFixture, allowDraws: boolean): Counted["outcome"] | null {
  const hs = f.homeScore!;
  const as = f.awayScore!;
  if (hs > as) return "H";
  if (as > hs) return "A";
  if (f.winnerEntryId && f.winnerEntryId === f.homeEntryId) return "H";
  if (f.winnerEntryId && f.winnerEntryId === f.awayEntryId) return "A";
  return allowDraws ? "D" : null;
}

function counted(fixtures: TableFixture[], allowDraws: boolean, ids: Set<string>): Counted[] {
  const out: Counted[] = [];
  for (const f of fixtures) {
    if (f.status !== "COMPLETED" || !f.homeEntryId || !f.awayEntryId || f.homeScore === null || f.awayScore === null) continue;
    if (!ids.has(f.homeEntryId) || !ids.has(f.awayEntryId)) continue;
    const outcome = outcomeOf(f, allowDraws);
    if (!outcome) continue;
    out.push({ home: f.homeEntryId, away: f.awayEntryId, hs: f.homeScore, as: f.awayScore, outcome });
  }
  return out;
}

function tally(entries: { id: string; name: string }[], games: Counted[], p: PointsSettings): Map<string, TableRow> {
  const rows = new Map<string, TableRow>();
  for (const e of entries) {
    rows.set(e.id, { position: 0, entryId: e.id, name: e.name, played: 0, won: 0, drawn: 0, lost: 0, for: 0, against: 0, difference: 0, points: 0 });
  }
  for (const g of games) {
    const h = rows.get(g.home);
    const a = rows.get(g.away);
    if (!h || !a) continue;
    h.played++;
    a.played++;
    h.for += g.hs;
    h.against += g.as;
    a.for += g.as;
    a.against += g.hs;
    if (g.outcome === "H") {
      h.won++, a.lost++, (h.points += p.pointsWin), (a.points += p.pointsLoss);
    } else if (g.outcome === "A") {
      a.won++, h.lost++, (a.points += p.pointsWin), (h.points += p.pointsLoss);
    } else {
      h.drawn++, a.drawn++, (h.points += p.pointsDraw), (a.points += p.pointsDraw);
    }
  }
  for (const r of rows.values()) r.difference = r.for - r.against;
  return rows;
}

/**
 * Table with tie-breakers in this order:
 *  1. points  2. score difference  3. scores for
 *  4. head-to-head among the entries still level on all three (points, then difference, in the
 *     games between just those entries)
 *  5. name A–Z, then id, so the order is always the same for the same input.
 */
export function computeTable(entries: { id: string; name: string }[], fixtures: TableFixture[], settings: PointsSettings): TableRow[] {
  const ids = new Set(entries.map((e) => e.id));
  const games = counted(fixtures, settings.allowDraws, ids);
  const rows = [...tally(entries, games, settings).values()];

  const key = (r: TableRow) => `${r.points}|${r.difference}|${r.for}`;
  const tiedSets = new Map<string, Set<string>>();
  for (const r of rows) tiedSets.set(key(r), (tiedSets.get(key(r)) ?? new Set()).add(r.entryId));
  const h2h = new Map<string, TableRow>();
  for (const set of tiedSets.values()) {
    if (set.size < 2) continue;
    const mini = tally(
      rows.filter((r) => set.has(r.entryId)).map((r) => ({ id: r.entryId, name: r.name })),
      games.filter((g) => set.has(g.home) && set.has(g.away)),
      settings
    );
    for (const [id, r] of mini) h2h.set(id, r);
  }

  rows.sort((x, y) => {
    const hx = h2h.get(x.entryId);
    const hy = h2h.get(y.entryId);
    return (
      y.points - x.points ||
      y.difference - x.difference ||
      y.for - x.for ||
      (hy?.points ?? 0) - (hx?.points ?? 0) ||
      (hy?.difference ?? 0) - (hx?.difference ?? 0) ||
      x.name.localeCompare(y.name) ||
      (x.entryId < y.entryId ? -1 : x.entryId > y.entryId ? 1 : 0)
    );
  });
  rows.forEach((r, i) => (r.position = i + 1));
  return rows;
}
