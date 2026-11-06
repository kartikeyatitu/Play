// Single-elimination brackets. Pure, deterministic, client-safe.
import { bracketOrder, nextPowerOfTwo, singleElimination } from "@/lib/competition";
import type { DrawFixture } from "./phase";

export type KnockoutDraw = {
  fixtures: DrawFixture[];
  /** Bracket size (next power of two at or above the entry count). */
  size: number;
  rounds: number;
  /** Entries given a first-round bye (always the top seeds). */
  byes: string[];
};

/**
 * Bracket for entries already in seed order (seed 1 first). Pads to the next power of two; the
 * byes go to the top seeds, whose round-1 "fixture" is stored as a BYE with the winner set and the
 * winner already placed into round 2. Seeds 1 and 2 can only meet in the final, 1–4 in the semis.
 * Later rounds start empty and are filled as results come in.
 */
export function knockoutDraw(orderedIds: string[]): KnockoutDraw {
  const fixtures = singleElimination(orderedIds) as DrawFixture[];
  if (fixtures.length === 0) return { fixtures: [], size: 0, rounds: 0, byes: [] };
  const size = nextPowerOfTwo(new Set(orderedIds).size);
  return {
    fixtures,
    size,
    rounds: Math.log2(size),
    byes: fixtures.filter((f) => f.status === "BYE").map((f) => f.winnerEntryId!),
  };
}

/** Round-1 opponents by seed for a bracket of `size`, e.g. 8 → [[1,8],[4,5],[2,7],[3,6]]. */
export function firstRoundSeedPairs(size: number): [number, number][] {
  const order = bracketOrder(size);
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < order.length; i += 2) pairs.push([order[i], order[i + 1]]);
  return pairs;
}
