// How a draw is laid out in the Fixture table without any schema change. Pure and client-safe.
//
// Fixture only has (round, slot), so group-stage-plus-knockout draws encode their structure in those:
//   • group stage:  round = 1..R (matchday),            slot = group * GROUP_STRIDE + index
//   • knockout:     round = KO_BASE * advance + k,      slot = bracket position (0-based)
// where `advance` is how many entries go through from each group and k = 1..K is the knockout round.
// Plain leagues and plain knockouts keep rounds below KO_BASE and slots below GROUP_STRIDE, so they
// read exactly as before. Everything about a draw can be read back from its fixtures alone.

export const GROUP_STRIDE = 100;
export const KO_BASE = 100;
export const MAX_GROUPS = 16;
export const MAX_ADVANCE = 8;

export type DrawMode = "ROUND_ROBIN" | "KNOCKOUT" | "GROUPS";
export const DRAW_MODES: DrawMode[] = ["ROUND_ROBIN", "KNOCKOUT", "GROUPS"];
export const isDrawMode = (v: unknown): v is DrawMode => typeof v === "string" && (DRAW_MODES as string[]).includes(v);

export type DrawFixture = {
  round: number;
  slot: number;
  homeEntryId: string | null;
  awayEntryId: string | null;
  status: "SCHEDULED" | "BYE";
  winnerEntryId: string | null;
};

export const isKnockoutPhaseRound = (round: number) => round >= KO_BASE;
export const encodeKnockoutRound = (advance: number, k: number) => KO_BASE * advance + k;
export const knockoutRoundIndex = (round: number) => (round >= KO_BASE ? round % KO_BASE : round);
export const advanceFromRound = (round: number) => (round >= KO_BASE ? Math.floor(round / KO_BASE) : 0);
export const encodeGroupSlot = (group: number, index: number) => group * GROUP_STRIDE + index;
export const groupOfSlot = (slot: number) => Math.floor(slot / GROUP_STRIDE);

/** "Group A" … "Group P". */
export function groupLabel(group: number): string {
  return `Group ${String.fromCharCode(65 + group)}`;
}

/** Which kind of draw these fixtures are. With no fixtures, the competition's format decides. */
export function detectDrawMode(format: string, fixtures: { round: number }[]): DrawMode {
  if (fixtures.some((f) => isKnockoutPhaseRound(f.round))) return "GROUPS";
  return format === "KNOCKOUT" ? "KNOCKOUT" : "ROUND_ROBIN";
}

/** For a group draw: group count and how many advance, read back from the fixtures. */
export function groupDrawShape(fixtures: { round: number; slot: number }[]): { groups: number; advance: number } {
  let groups = 0;
  let advance = 0;
  for (const f of fixtures) {
    if (isKnockoutPhaseRound(f.round)) advance = Math.max(advance, advanceFromRound(f.round));
    else groups = Math.max(groups, groupOfSlot(f.slot) + 1);
  }
  return { groups, advance };
}

/** "Final", "Semi-final", "Quarter-final", "Round of 16"… for knockout round k of K. */
export function knockoutRoundLabel(k: number, totalRounds: number): string {
  const left = totalRounds - k; // 0 = final
  if (left === 0) return "Final";
  if (left === 1) return "Semi-final";
  if (left === 2) return "Quarter-final";
  return `Round of ${2 ** (left + 1)}`;
}

/** Label for any persisted round of a draw. */
export function roundLabel(mode: DrawMode, round: number, fixtures: { round: number }[]): string {
  if (mode === "ROUND_ROBIN") return `Round ${round}`;
  if (mode === "KNOCKOUT") {
    const total = Math.max(...fixtures.map((f) => f.round), round);
    return knockoutRoundLabel(round, total);
  }
  if (!isKnockoutPhaseRound(round)) return `Matchday ${round}`;
  const total = Math.max(...fixtures.filter((f) => isKnockoutPhaseRound(f.round)).map((f) => knockoutRoundIndex(f.round)), knockoutRoundIndex(round));
  return knockoutRoundLabel(knockoutRoundIndex(round), total);
}

/**
 * Where a knockout winner goes next, in persisted round numbers. Works for plain knockouts (rounds
 * 1..K) and the knockout phase of a group draw (rounds base+1..base+K). Null after the final.
 */
export function nextKnockoutPosition(
  round: number,
  slot: number,
  knockoutRounds: number[]
): { round: number; slot: number; side: "home" | "away" } | null {
  const ko = isKnockoutPhaseRound(round);
  const base = ko ? round - knockoutRoundIndex(round) : 0;
  const k = round - base;
  const total = Math.max(0, ...knockoutRounds.filter((r) => isKnockoutPhaseRound(r) === ko).map((r) => r - base));
  if (k >= total) return null;
  return { round: base + k + 1, slot: Math.floor(slot / 2), side: slot % 2 === 0 ? "home" : "away" };
}
