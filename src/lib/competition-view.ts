// View shapes for TRIQ Play screens + the pure function that builds them from DB rows.
// Kept out of the "use server" actions file, which may only export async functions.
import { computeStandings, knockoutChampion, knockoutRounds, allFixturesDecided, type StandingRow } from "@/lib/competition";

export type CompetitionSummary = {
  id: string;
  name: string;
  sport: string | null;
  format: string;
  entryType: string;
  status: string;
  startDate: string | null;
  maxEntries: number;
  entryCount: number;
};

export type EntryView = { id: string; name: string; seed: number | null; status: string; studentId: string | null; batchId: string | null };

export type FixtureView = {
  id: string;
  round: number;
  slot: number;
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
  officialUserId: string | null;
  version: number;
};

export type CompetitionDetail = {
  id: string;
  name: string;
  sport: string | null;
  format: string;
  entryType: string;
  legs: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
  venue: string | null;
  maxEntries: number;
  minAge: number | null;
  maxAge: number | null;
  ageCutoffDate: string | null;
  eligibleBatchId: string | null;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  allowDraws: boolean;
  entries: EntryView[];
  fixtures: FixtureView[];
  standings: StandingRow[];
  totalRounds: number;
  championEntryId: string | null;
  allDecided: boolean;
  officials: { userId: string; name: string }[];
  canManage: boolean;
};

type Row = Record<string, any>;
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

export function buildCompetitionDetail(
  c: Row,
  entries: Row[],
  fixtures: Row[],
  officials: { userId: string; name: string }[],
  canManage: boolean
): CompetitionDetail {
  const names = new Map<string, string>(entries.map((e) => [e.id, e.name]));
  const fx: FixtureView[] = [...fixtures]
    .sort((a, b) => a.round - b.round || a.slot - b.slot)
    .map((f) => ({
      id: f.id,
      round: f.round,
      slot: f.slot,
      homeEntryId: f.homeEntryId,
      awayEntryId: f.awayEntryId,
      homeName: f.homeEntryId ? names.get(f.homeEntryId) ?? null : null,
      awayName: f.awayEntryId ? names.get(f.awayEntryId) ?? null : null,
      scheduledAt: iso(f.scheduledAt),
      venue: f.venue,
      status: f.status,
      homeScore: f.homeScore,
      awayScore: f.awayScore,
      winnerEntryId: f.winnerEntryId,
      officialUserId: f.officialUserId,
      version: f.version,
    }));
  // Standings include every entry that is registered or has played (withdrawn entries keep their results).
  const played = new Set(fx.filter((f) => f.status === "COMPLETED").flatMap((f) => [f.homeEntryId, f.awayEntryId]));
  const tableEntries = entries.filter((e) => e.status === "REGISTERED" || played.has(e.id)).map((e) => ({ id: e.id, name: e.name }));
  const registered = entries.filter((e) => e.status === "REGISTERED").length;

  return {
    id: c.id,
    name: c.name,
    sport: c.sport,
    format: c.format,
    entryType: c.entryType,
    legs: c.legs,
    status: c.status,
    startDate: day(c.startDate),
    endDate: day(c.endDate),
    venue: c.venue,
    maxEntries: c.maxEntries,
    minAge: c.minAge,
    maxAge: c.maxAge,
    ageCutoffDate: day(c.ageCutoffDate),
    eligibleBatchId: c.eligibleBatchId,
    pointsWin: c.pointsWin,
    pointsDraw: c.pointsDraw,
    pointsLoss: c.pointsLoss,
    allowDraws: c.allowDraws,
    entries: entries.map((e) => ({ id: e.id, name: e.name, seed: e.seed, status: e.status, studentId: e.studentId, batchId: e.batchId })),
    fixtures: fx,
    standings: c.format === "LEAGUE" ? computeStandings(tableEntries, fx, { win: c.pointsWin, draw: c.pointsDraw, loss: c.pointsLoss }) : [],
    totalRounds: c.format === "KNOCKOUT" ? (fx.length ? Math.max(...fx.map((f) => f.round)) : knockoutRounds(registered)) : 0,
    championEntryId: c.format === "KNOCKOUT" ? knockoutChampion(fx) : null,
    allDecided: allFixturesDecided(fx),
    officials,
    canManage,
  };
}
