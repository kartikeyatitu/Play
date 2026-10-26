// Competition engine: pure, deterministic, client-safe. No DB, no randomness.
// Spec: docs/specs/03-triq-play.md (§7). Everything persisted is derived from these functions.

export const COMPETITION_FORMATS = ["LEAGUE", "KNOCKOUT"] as const;
export type CompetitionFormat = (typeof COMPETITION_FORMATS)[number];

export const ENTRY_TYPES = ["TEAM", "INDIVIDUAL"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const COMPETITION_STATUSES = ["DRAFT", "OPEN", "SCHEDULED", "COMPLETED", "CANCELLED"] as const;
export type CompetitionStatus = (typeof COMPETITION_STATUSES)[number];

export const FIXTURE_STATUSES = ["SCHEDULED", "COMPLETED", "BYE", "POSTPONED", "CANCELLED"] as const;
export type FixtureStatus = (typeof FIXTURE_STATUSES)[number];

export const MAX_ENTRIES = 128;
export const MAX_KNOCKOUT_ENTRIES = 64;
export const MAX_SCORE = 999;

export const isCompetitionFormat = (v: unknown): v is CompetitionFormat =>
  typeof v === "string" && (COMPETITION_FORMATS as readonly string[]).includes(v);
export const isEntryType = (v: unknown): v is EntryType => typeof v === "string" && (ENTRY_TYPES as readonly string[]).includes(v);
export const isCompetitionStatus = (v: unknown): v is CompetitionStatus =>
  typeof v === "string" && (COMPETITION_STATUSES as readonly string[]).includes(v);
export const isFixtureStatus = (v: unknown): v is FixtureStatus => typeof v === "string" && (FIXTURE_STATUSES as readonly string[]).includes(v);

// ───────────────────────────── seeding ─────────────────────────────

export type SeedableEntry = { id: string; seed?: number | null; createdAt?: Date | string | number | null };

function timeOf(v: SeedableEntry["createdAt"]): number {
  if (v === null || v === undefined) return Number.MAX_SAFE_INTEGER;
  const t = v instanceof Date ? v.getTime() : typeof v === "number" ? v : new Date(v).getTime();
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
}

/**
 * Deterministic seed order: seeded entries first (ascending seed), then unseeded by registration time,
 * then by id. The same input always yields the same order.
 */
export function seedOrder(entries: SeedableEntry[]): string[] {
  return [...entries]
    .sort((a, b) => {
      const sa = a.seed ?? Number.MAX_SAFE_INTEGER;
      const sb = b.seed ?? Number.MAX_SAFE_INTEGER;
      if (sa !== sb) return sa - sb;
      const ta = timeOf(a.createdAt);
      const tb = timeOf(b.createdAt);
      if (ta !== tb) return ta - tb;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .map((e) => e.id);
}

// ───────────────────────────── fixture generation ─────────────────────────────

export type GeneratedFixture = {
  round: number; // 1-based
  slot: number; // 0-based position within the round (bracket order for knockouts)
  homeEntryId: string | null;
  awayEntryId: string | null;
  status: "SCHEDULED" | "BYE";
  winnerEntryId: string | null;
};

/**
 * Round-robin by the circle method. With an odd number of entries one entry sits out each round (no
 * fixture is created for the bye). `legs = 2` plays everyone twice with home/away swapped.
 * n entries → n(n-1)/2 fixtures per leg, each pair exactly once per leg, nobody twice in a round.
 */
export function roundRobin(orderedIds: string[], legs: 1 | 2 = 1): GeneratedFixture[] {
  const ids = dedupe(orderedIds);
  if (ids.length < 2) return [];
  const list: (string | null)[] = ids.length % 2 === 0 ? [...ids] : [...ids, null];
  const n = list.length;
  const roundsPerLeg = n - 1;
  const firstLeg: GeneratedFixture[] = [];

  for (let r = 0; r < roundsPerLeg; r++) {
    let slot = 0;
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (!a || !b) continue; // bye
      // Alternate the fixed entry's home/away so nobody is always at home.
      const swap = i === 0 ? r % 2 === 1 : false;
      firstLeg.push({
        round: r + 1,
        slot: slot++,
        homeEntryId: swap ? b : a,
        awayEntryId: swap ? a : b,
        status: "SCHEDULED",
        winnerEntryId: null,
      });
    }
    // Rotate every position except the first: last moves to index 1.
    const last = list.pop() as string | null;
    list.splice(1, 0, last);
  }

  if (legs === 1) return firstLeg;
  const secondLeg = firstLeg.map((f) => ({
    ...f,
    round: f.round + roundsPerLeg,
    homeEntryId: f.awayEntryId,
    awayEntryId: f.homeEntryId,
  }));
  return [...firstLeg, ...secondLeg];
}

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Standard bracket order for `size` seeds: seed 1 and 2 can only meet in the final, 1–4 in the semis…
 * size 8 → [1, 8, 4, 5, 2, 7, 3, 6]; consecutive pairs are the round-1 fixtures.
 */
export function bracketOrder(size: number): number[] {
  if (size < 2) return [1];
  let order = [1, 2];
  while (order.length < size) {
    const m = order.length * 2 + 1;
    order = order.flatMap((s) => [s, m - s]);
  }
  return order;
}

export function knockoutRounds(entryCount: number): number {
  return entryCount < 2 ? 0 : Math.log2(nextPowerOfTwo(entryCount));
}

/**
 * Single-elimination bracket for entries already in seed order. Pads to the next power of two; byes go
 * to the top seeds and their winners are pre-filled into round 2. Later-round fixtures start empty and
 * are filled as results come in (see `nextFixturePosition`).
 */
export function singleElimination(orderedIds: string[]): GeneratedFixture[] {
  const ids = dedupe(orderedIds);
  if (ids.length < 2) return [];
  const size = nextPowerOfTwo(ids.length);
  const rounds = Math.log2(size);
  const order = bracketOrder(size);
  const bySeed = (seed: number): string | null => (seed <= ids.length ? ids[seed - 1] : null);

  const fixtures: GeneratedFixture[] = [];
  for (let s = 0; s < size / 2; s++) {
    const home = bySeed(order[2 * s]);
    const away = bySeed(order[2 * s + 1]);
    const bye = !home || !away;
    fixtures.push({
      round: 1,
      slot: s,
      homeEntryId: home,
      awayEntryId: away,
      status: bye ? "BYE" : "SCHEDULED",
      winnerEntryId: bye ? (home ?? away) : null,
    });
  }
  for (let r = 2; r <= rounds; r++) {
    const count = size / 2 ** r;
    for (let s = 0; s < count; s++) {
      fixtures.push({ round: r, slot: s, homeEntryId: null, awayEntryId: null, status: "SCHEDULED", winnerEntryId: null });
    }
  }
  // Pre-fill round 2 with bye winners.
  for (const f of fixtures) {
    if (f.round !== 1 || f.status !== "BYE") continue;
    const next = nextFixturePosition(f.round, f.slot, rounds);
    if (!next) continue;
    const target = fixtures.find((x) => x.round === next.round && x.slot === next.slot)!;
    if (next.side === "home") target.homeEntryId = f.winnerEntryId;
    else target.awayEntryId = f.winnerEntryId;
  }
  return fixtures;
}

export function generateFixtures(
  format: CompetitionFormat,
  entries: SeedableEntry[],
  opts: { legs?: 1 | 2 } = {}
): GeneratedFixture[] {
  const order = seedOrder(entries);
  return format === "LEAGUE" ? roundRobin(order, opts.legs ?? 1) : singleElimination(order);
}

/** Where the winner of knockout fixture (round, slot) goes next; null for the final. */
export function nextFixturePosition(
  round: number,
  slot: number,
  totalRounds: number
): { round: number; slot: number; side: "home" | "away" } | null {
  if (round >= totalRounds) return null;
  return { round: round + 1, slot: Math.floor(slot / 2), side: slot % 2 === 0 ? "home" : "away" };
}

// ───────────────────────────── results ─────────────────────────────

export type ResultInput = { homeScore: unknown; awayScore: unknown; winnerEntryId?: unknown };
export type ResultContext = {
  format: CompetitionFormat;
  allowDraws: boolean;
  status: string;
  homeEntryId: string | null;
  awayEntryId: string | null;
};
export type ValidResult = { ok: true; homeScore: number; awayScore: number; winnerEntryId: string | null };

function toScore(v: unknown): number | null {
  if (v === null || v === undefined || typeof v === "boolean") return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isInteger(n) && n >= 0 && n <= MAX_SCORE ? n : null;
}

/**
 * Validates a result against the fixture and competition rules. Winner is derived from the score;
 * a knockout tie must name the winner (penalties, tie-break…). League draws only when allowed.
 */
export function validateResult(input: ResultInput, ctx: ResultContext): ValidResult | { ok: false; error: string } {
  if (!ctx.homeEntryId || !ctx.awayEntryId) return { ok: false, error: "Both sides must be known before a result can be recorded." };
  if (ctx.status === "BYE" || ctx.status === "CANCELLED") return { ok: false, error: "This fixture doesn't take a result." };
  const homeScore = toScore(input.homeScore);
  const awayScore = toScore(input.awayScore);
  if (homeScore === null || awayScore === null) return { ok: false, error: `Scores must be whole numbers from 0 to ${MAX_SCORE}.` };

  if (homeScore !== awayScore) {
    return { ok: true, homeScore, awayScore, winnerEntryId: homeScore > awayScore ? ctx.homeEntryId : ctx.awayEntryId };
  }
  if (ctx.format === "KNOCKOUT") {
    const w = typeof input.winnerEntryId === "string" ? input.winnerEntryId : "";
    if (w !== ctx.homeEntryId && w !== ctx.awayEntryId) return { ok: false, error: "Scores are level — pick who went through (e.g. on penalties)." };
    return { ok: true, homeScore, awayScore, winnerEntryId: w };
  }
  if (!ctx.allowDraws) return { ok: false, error: "Draws aren't allowed in this competition." };
  return { ok: true, homeScore, awayScore, winnerEntryId: null };
}

/**
 * A knockout result can be changed only while the next-round fixture it feeds hasn't been played.
 * `nextFixtureStatus` is null for the final.
 */
export function canCorrectKnockoutResult(nextFixtureStatus: string | null): boolean {
  return nextFixtureStatus === null || nextFixtureStatus !== "COMPLETED";
}

// ───────────────────────────── standings ─────────────────────────────

export type PointsRule = { win: number; draw: number; loss: number };
export const DEFAULT_POINTS: PointsRule = { win: 3, draw: 1, loss: 0 };

export type StandingsFixture = {
  homeEntryId: string | null;
  awayEntryId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
};

export type StandingRow = {
  position: number;
  entryId: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  scoresFor: number;
  scoresAgainst: number;
  diff: number;
  points: number;
};

function isCounted(f: StandingsFixture): f is StandingsFixture & { homeEntryId: string; awayEntryId: string; homeScore: number; awayScore: number } {
  return f.status === "COMPLETED" && !!f.homeEntryId && !!f.awayEntryId && f.homeScore !== null && f.awayScore !== null;
}

/**
 * League table. Only COMPLETED fixtures count. Tie-breakers, in order:
 *  1. points
 *  2. head-to-head points among all entries tied on points
 *  3. overall score difference
 *  4. scores for
 *  5. wins
 *  6. entry name (A–Z), then id — so the order is always deterministic.
 */
export function computeStandings(
  entries: { id: string; name: string }[],
  fixtures: StandingsFixture[],
  points: PointsRule = DEFAULT_POINTS
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const e of entries) {
    rows.set(e.id, { position: 0, entryId: e.id, name: e.name, played: 0, won: 0, drawn: 0, lost: 0, scoresFor: 0, scoresAgainst: 0, diff: 0, points: 0 });
  }
  const counted = fixtures.filter(isCounted).filter((f) => rows.has(f.homeEntryId) && rows.has(f.awayEntryId));

  for (const f of counted) {
    const h = rows.get(f.homeEntryId)!;
    const a = rows.get(f.awayEntryId)!;
    h.played++;
    a.played++;
    h.scoresFor += f.homeScore;
    h.scoresAgainst += f.awayScore;
    a.scoresFor += f.awayScore;
    a.scoresAgainst += f.homeScore;
    if (f.homeScore > f.awayScore) {
      h.won++;
      a.lost++;
      h.points += points.win;
      a.points += points.loss;
    } else if (f.homeScore < f.awayScore) {
      a.won++;
      h.lost++;
      a.points += points.win;
      h.points += points.loss;
    } else {
      h.drawn++;
      a.drawn++;
      h.points += points.draw;
      a.points += points.draw;
    }
  }
  for (const r of rows.values()) r.diff = r.scoresFor - r.scoresAgainst;

  // Head-to-head points among each group tied on points.
  const all = [...rows.values()];
  const h2h = new Map<string, number>();
  const byPoints = new Map<number, StandingRow[]>();
  for (const r of all) byPoints.set(r.points, [...(byPoints.get(r.points) ?? []), r]);
  for (const group of byPoints.values()) {
    if (group.length < 2) continue;
    const ids = new Set(group.map((r) => r.entryId));
    for (const f of counted) {
      if (!ids.has(f.homeEntryId) || !ids.has(f.awayEntryId)) continue;
      const add = (id: string, p: number) => h2h.set(id, (h2h.get(id) ?? 0) + p);
      if (f.homeScore > f.awayScore) {
        add(f.homeEntryId, points.win);
        add(f.awayEntryId, points.loss);
      } else if (f.homeScore < f.awayScore) {
        add(f.awayEntryId, points.win);
        add(f.homeEntryId, points.loss);
      } else {
        add(f.homeEntryId, points.draw);
        add(f.awayEntryId, points.draw);
      }
    }
  }

  all.sort(
    (x, y) =>
      y.points - x.points ||
      (h2h.get(y.entryId) ?? 0) - (h2h.get(x.entryId) ?? 0) ||
      y.diff - x.diff ||
      y.scoresFor - x.scoresFor ||
      y.won - x.won ||
      x.name.localeCompare(y.name) ||
      (x.entryId < y.entryId ? -1 : x.entryId > y.entryId ? 1 : 0)
  );
  all.forEach((r, i) => (r.position = i + 1));
  return all;
}

/** True when every fixture is decided (completed, bye or cancelled). */
export function allFixturesDecided(fixtures: { status: string }[]): boolean {
  return fixtures.length > 0 && fixtures.every((f) => f.status === "COMPLETED" || f.status === "BYE" || f.status === "CANCELLED");
}

/** Knockout champion: the winner of the final, once played. */
export function knockoutChampion(fixtures: { round: number; winnerEntryId: string | null; status: string }[]): string | null {
  if (fixtures.length === 0) return null;
  const last = Math.max(...fixtures.map((f) => f.round));
  const final = fixtures.filter((f) => f.round === last);
  return final.length === 1 && (final[0].status === "COMPLETED" || final[0].status === "BYE") ? final[0].winnerEntryId : null;
}

// ───────────────────────────── lifecycle ─────────────────────────────

const TRANSITIONS: Record<CompetitionStatus, CompetitionStatus[]> = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["DRAFT", "SCHEDULED", "CANCELLED"],
  SCHEDULED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * Allowed manual status changes. SCHEDULED is reached only by generating fixtures; going back to DRAFT
 * is allowed only while no fixtures exist; COMPLETED needs every fixture decided.
 */
export function canTransition(
  from: string,
  to: string,
  ctx: { hasFixtures: boolean; allDecided: boolean; viaGeneration?: boolean }
): { ok: true } | { ok: false; error: string } {
  if (!isCompetitionStatus(from) || !isCompetitionStatus(to)) return { ok: false, error: "Unknown status." };
  if (!TRANSITIONS[from].includes(to)) return { ok: false, error: `Can't move a ${from.toLowerCase()} competition to ${to.toLowerCase()}.` };
  if (to === "SCHEDULED" && !ctx.viaGeneration) return { ok: false, error: "Generate fixtures to schedule the competition." };
  if (to === "DRAFT" && ctx.hasFixtures) return { ok: false, error: "Fixtures already exist." };
  if (to === "COMPLETED" && !ctx.allDecided) return { ok: false, error: "Some fixtures still need a result." };
  return { ok: true };
}

/** Registration is possible while the competition is DRAFT or OPEN. */
export function registrationOpen(status: string): boolean {
  return status === "DRAFT" || status === "OPEN";
}

// ───────────────────────────── eligibility ─────────────────────────────

/** Completed years between `dob` and `on` (calendar based, UTC). */
export function ageOn(dob: Date, on: Date): number {
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const m = on.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

export type EligibilityRule = { minAge: number | null; maxAge: number | null; ageCutoffDate: Date | null; eligibleBatchId: string | null };
export type EligibilityCandidate = { dob: Date | null; batchIds: string[] };

/** Eligibility verdict for an individual entry. Only the verdict leaves the server, never the DOB. */
export function checkEligibility(rule: EligibilityRule, c: EligibilityCandidate): { ok: true } | { ok: false; error: string } {
  if (rule.eligibleBatchId && !c.batchIds.includes(rule.eligibleBatchId)) {
    return { ok: false, error: "This player isn't enrolled in the batch this competition is limited to." };
  }
  if (rule.minAge !== null || rule.maxAge !== null) {
    if (!c.dob) return { ok: false, error: "Add the player's date of birth to check age eligibility." };
    const cutoff = rule.ageCutoffDate ?? new Date();
    const age = ageOn(c.dob, cutoff);
    if (rule.minAge !== null && age < rule.minAge) return { ok: false, error: `Player must be at least ${rule.minAge} on the cut-off date.` };
    if (rule.maxAge !== null && age > rule.maxAge) return { ok: false, error: `Player must be ${rule.maxAge} or younger on the cut-off date.` };
  }
  return { ok: true };
}

// ───────────────────────────── configuration ─────────────────────────────

export type CompetitionConfig = {
  name: string;
  sport: string | null;
  format: CompetitionFormat;
  entryType: EntryType;
  legs: 1 | 2;
  startDate: Date | null;
  endDate: Date | null;
  venue: string | null;
  maxEntries: number;
  minAge: number | null;
  maxAge: number | null;
  ageCutoffDate: Date | null;
  eligibleBatchId: string | null;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  allowDraws: boolean;
};

function optInt(v: unknown): number | null | "bad" {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : "bad";
}

function optDate(v: unknown): Date | null | "bad" {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return "bad";
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? "bad" : d;
}

/** Validates and normalises organizer input. Batch ownership is checked by the caller (needs the DB). */
export function validateCompetitionConfig(raw: Record<string, unknown>): { ok: true; value: CompetitionConfig } | { ok: false; error: string } {
  const name = String(raw.name ?? "").trim();
  if (name.length < 3 || name.length > 80) return { ok: false, error: "Name must be 3–80 characters." };
  const sport = String(raw.sport ?? "").trim().slice(0, 40) || null;
  const format = raw.format;
  if (!isCompetitionFormat(format)) return { ok: false, error: "Pick league or knockout." };
  const entryType = raw.entryType ?? "TEAM";
  if (!isEntryType(entryType)) return { ok: false, error: "Pick team or individual entries." };
  const legs = format === "LEAGUE" && Number(raw.legs) === 2 ? 2 : 1;

  const startDate = optDate(raw.startDate);
  const endDate = optDate(raw.endDate);
  if (startDate === "bad" || endDate === "bad") return { ok: false, error: "Dates must be valid." };
  if (startDate && endDate && endDate < startDate) return { ok: false, error: "End date can't be before the start date." };
  const venue = String(raw.venue ?? "").trim().slice(0, 120) || null;

  const maxEntries = optInt(raw.maxEntries);
  const cap = format === "KNOCKOUT" ? MAX_KNOCKOUT_ENTRIES : MAX_ENTRIES;
  if (maxEntries === "bad" || maxEntries === null || maxEntries < 2 || maxEntries > cap) {
    return { ok: false, error: `Maximum entries must be between 2 and ${cap}.` };
  }

  const minAge = optInt(raw.minAge);
  const maxAge = optInt(raw.maxAge);
  if (minAge === "bad" || maxAge === "bad") return { ok: false, error: "Ages must be whole numbers." };
  for (const a of [minAge, maxAge]) if (a !== null && (a < 3 || a > 80)) return { ok: false, error: "Ages must be between 3 and 80." };
  if (minAge !== null && maxAge !== null && minAge > maxAge) return { ok: false, error: "Minimum age can't be above maximum age." };
  let ageCutoffDate = optDate(raw.ageCutoffDate);
  if (ageCutoffDate === "bad") return { ok: false, error: "Age cut-off date must be valid." };
  if ((minAge !== null || maxAge !== null) && !ageCutoffDate) ageCutoffDate = startDate;
  if ((minAge !== null || maxAge !== null) && !ageCutoffDate) return { ok: false, error: "Set a start date or an age cut-off date for the age rule." };
  if (minAge === null && maxAge === null) ageCutoffDate = null;

  const eligibleBatchId = String(raw.eligibleBatchId ?? "").trim() || null;

  const pw = optInt(raw.pointsWin ?? 3);
  const pd = optInt(raw.pointsDraw ?? 1);
  const pl = optInt(raw.pointsLoss ?? 0);
  if (pw === "bad" || pd === "bad" || pl === "bad" || pw === null || pd === null || pl === null) return { ok: false, error: "Points must be whole numbers." };
  for (const p of [pw, pd, pl]) if (p < 0 || p > 10) return { ok: false, error: "Points must be between 0 and 10." };
  if (!(pw >= pd && pd >= pl)) return { ok: false, error: "Points must be win ≥ draw ≥ loss." };
  const allowDraws = format === "LEAGUE" ? raw.allowDraws !== false && raw.allowDraws !== "false" : false;

  if (entryType === "TEAM" && (minAge !== null || maxAge !== null || eligibleBatchId)) {
    // Team entries have no roster in v1, so player rules can't be enforced — refuse rather than pretend.
    return { ok: false, error: "Age and batch rules apply to individual entries only (team rosters come later)." };
  }

  return {
    ok: true,
    value: {
      name,
      sport,
      format,
      entryType,
      legs,
      startDate,
      endDate,
      venue,
      maxEntries,
      minAge,
      maxAge,
      ageCutoffDate,
      eligibleBatchId,
      pointsWin: pw,
      pointsDraw: pd,
      pointsLoss: pl,
      allowDraws,
    },
  };
}

function dedupe(ids: string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
}

/**
 * Parses a `YYYY-MM-DDTHH:mm` value typed in the academy's local time (IST, same convention as
 * src/lib/turf.ts) into a UTC instant. Empty → null; anything malformed → "bad".
 */
export function parseFixtureTime(v: unknown): Date | null | "bad" {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return "bad";
  const d = new Date(`${v}:00+05:30`);
  return Number.isNaN(d.getTime()) ? "bad" : d;
}
