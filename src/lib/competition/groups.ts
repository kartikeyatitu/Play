// Group stage plus knockout. Pure, deterministic, client-safe. Layout: see ./phase.ts.
import { nextPowerOfTwo } from "@/lib/competition";
import { firstRoundSeedPairs, knockoutDraw } from "./knockout";
import { MAX_ADVANCE, MAX_GROUPS, encodeGroupSlot, encodeKnockoutRound, type DrawFixture } from "./phase";
import { roundRobinDraw } from "./round-robin";

export type GroupDrawOptions = { groups: number; advance: number; double?: boolean };

export type GroupDraw = {
  /** Entry ids per group, in seed order. */
  groups: string[][];
  /** Group fixtures followed by the empty knockout bracket. */
  fixtures: DrawFixture[];
  groupRounds: number;
  knockoutRounds: number;
  bracketSize: number;
};

/**
 * Snake seeding into groups: seeds 1..G go to groups A..G, seeds G+1..2G back from G to A, and so
 * on. Top seeds are spread out and group strength stays even. Group sizes differ by at most one.
 */
export function splitIntoGroups(orderedIds: string[], groupCount: number): string[][] {
  const groups: string[][] = Array.from({ length: Math.max(0, groupCount) }, () => []);
  if (groupCount < 1) return groups;
  orderedIds.forEach((id, i) => {
    const pass = Math.floor(i / groupCount);
    const pos = i % groupCount;
    groups[pass % 2 === 0 ? pos : groupCount - 1 - pos].push(id);
  });
  return groups;
}

export function validateGroupOptions(entryCount: number, o: GroupDrawOptions): { ok: true } | { ok: false; error: string } {
  const { groups, advance } = o;
  if (!Number.isInteger(groups) || groups < 2 || groups > MAX_GROUPS) return { ok: false, error: `Pick between 2 and ${MAX_GROUPS} groups.` };
  if (!Number.isInteger(advance) || advance < 1 || advance > MAX_ADVANCE) return { ok: false, error: `Between 1 and ${MAX_ADVANCE} can go through from each group.` };
  const smallest = Math.floor(entryCount / groups);
  if (smallest < 2) return { ok: false, error: `${entryCount} entries can't fill ${groups} groups of at least 2.` };
  if (smallest <= advance) return { ok: false, error: `With groups of ${smallest}, fewer than ${smallest} must go through from each group.` };
  return { ok: true };
}

/** Group fixtures (round robin per group) plus an empty bracket for groups × advance qualifiers. */
export function groupStageDraw(orderedIds: string[], o: GroupDrawOptions): { ok: true; draw: GroupDraw } | { ok: false; error: string } {
  const ids = [...new Set(orderedIds.filter(Boolean))];
  const v = validateGroupOptions(ids.length, o);
  if (!v.ok) return v;
  const groups = splitIntoGroups(ids, o.groups);
  const fixtures: DrawFixture[] = [];
  let groupRounds = 0;
  groups.forEach((members, g) => {
    const rr = roundRobinDraw(members, { double: o.double });
    groupRounds = Math.max(groupRounds, rr.rounds);
    for (const f of rr.fixtures) fixtures.push({ ...f, slot: encodeGroupSlot(g, f.slot) });
  });
  fixtures.sort((a, b) => a.round - b.round || a.slot - b.slot);

  const bracketSize = nextPowerOfTwo(o.groups * o.advance);
  const knockoutRounds = Math.log2(bracketSize);
  for (let k = 1; k <= knockoutRounds; k++) {
    for (let s = 0; s < bracketSize / 2 ** k; s++) {
      fixtures.push({ round: encodeKnockoutRound(o.advance, k), slot: s, homeEntryId: null, awayEntryId: null, status: "SCHEDULED", winnerEntryId: null });
    }
  }
  return { ok: true, draw: { groups, fixtures, groupRounds, knockoutRounds, bracketSize } };
}

/**
 * Knockout seed order from final group tables: all group winners (group A first), then all
 * runners-up, and so on. Then any first-round pairing of two entries from the same group is undone by
 * swapping with another qualifier of the same finishing place, so group-mates don't meet straight
 * away when that can be avoided. Byes (bracket padding) fall to the group winners.
 */
export function knockoutQualifierOrder(groupTables: string[][], advance: number): string[] {
  const groupOf = new Map<string, number>();
  const order: string[] = [];
  for (let place = 0; place < advance; place++) {
    groupTables.forEach((table, g) => {
      const id = table[place];
      if (id && !groupOf.has(id)) {
        groupOf.set(id, g);
        order.push(id);
      }
    });
  }
  const q = order.length;
  if (q < 2) return order;
  const pairs = firstRoundSeedPairs(nextPowerOfTwo(q)).filter(([a, b]) => a <= q && b <= q);
  const tierOf = (seed: number) => {
    // Seeds were laid out place by place; recover each seed's place from its entry.
    const id = order[seed - 1];
    let place = 0;
    for (const t of groupTables) {
      const i = t.indexOf(id);
      if (i >= 0) place = i;
    }
    return place;
  };
  const clashes = (a: number, b: number) => groupOf.get(order[a - 1]) === groupOf.get(order[b - 1]);
  const partner = new Map<number, number>();
  for (const [a, b] of pairs) partner.set(a, b).set(b, a);

  for (const [a, b] of pairs) {
    if (!clashes(a, b)) continue;
    const low = Math.max(a, b); // the lower-ranked seed moves
    for (let c = 1; c <= q; c++) {
      if (c === low || c === a || c === b || tierOf(c) !== tierOf(low)) continue;
      const pc = partner.get(c);
      const swap = () => ([order[low - 1], order[c - 1]] = [order[c - 1], order[low - 1]]);
      swap();
      const ok = !clashes(a, b) && (pc === undefined || !clashes(c, pc));
      if (ok) break;
      swap();
    }
  }
  return order;
}

/**
 * Seeded knockout fixtures for a group draw, in persisted round numbers. The bracket size matches the
 * empty bracket written by `groupStageDraw` (groups × advance qualifiers).
 */
export function seedKnockoutPhase(groupTables: string[][], advance: number): DrawFixture[] {
  const order = knockoutQualifierOrder(groupTables, advance);
  return knockoutDraw(order).fixtures.map((f) => ({ ...f, round: encodeKnockoutRound(advance, f.round) }));
}
