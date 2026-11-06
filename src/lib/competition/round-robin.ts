// Round-robin draw by the circle method. Pure, deterministic, client-safe.
import type { DrawFixture } from "./phase";

export type RoundRobinOptions = {
  /** Play everyone twice; the second half mirrors the first with home and away swapped. */
  double?: boolean;
};

export type RoundRobinDraw = {
  fixtures: DrawFixture[];
  /** Entry resting in each round when the count is odd (one per round). */
  byes: { round: number; entryId: string }[];
  rounds: number;
};

/**
 * The greedy pass can leave an entry two or more home games ahead. Flipping every fixture along a
 * chain "t hosts x1, x1 hosts x2, … hosts s" moves t down by two and s up by two and leaves everyone
 * in between unchanged. Repeat with the shortest such chain (BFS in fixture order, so deterministic)
 * until every entry is within one game of level.
 */
function repairBalance(fixtures: DrawFixture[], balance: Map<string, number>, ids: string[]) {
  for (let guard = 0; guard < ids.length * ids.length; guard++) {
    const t = ids.find((id) => balance.get(id)! >= 2);
    if (!t) return;
    const hosts = new Map<string, number[]>(); // entry → indexes of fixtures it hosts
    fixtures.forEach((f, i) => hosts.set(f.homeEntryId!, [...(hosts.get(f.homeEntryId!) ?? []), i]));
    const prev = new Map<string, number>([[t, -1]]);
    const queue = [t];
    let target: string | null = null;
    while (queue.length && !target) {
      const u = queue.shift()!;
      for (const i of hosts.get(u) ?? []) {
        const v = fixtures[i].awayEntryId!;
        if (prev.has(v)) continue;
        prev.set(v, i);
        if (balance.get(t)! - balance.get(v)! >= 3) {
          target = v;
          break;
        }
        queue.push(v);
      }
    }
    if (!target) return;
    for (let v = target; v !== t; ) {
      const f = fixtures[prev.get(v)!];
      const u = f.homeEntryId!;
      f.homeEntryId = v;
      f.awayEntryId = u;
      v = u;
    }
    balance.set(t, balance.get(t)! - 2);
    balance.set(target, balance.get(target)! + 2);
  }
}

function dedupe(ids: string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => !!id && (seen.has(id) ? false : (seen.add(id), true)));
}

/**
 * Circle method: entry 0 stays put, everyone else rotates one place per round. Odd counts get a
 * phantom entry and whoever meets it rests that round. Each pair meets exactly once per half and
 * nobody plays twice in a round.
 *
 * Home and away are then oriented greedily, in round order: the entry that has been at home less
 * often so far hosts; on a tie, whoever was away in their previous fixture hosts (fewer runs of
 * home or away games); then the round/slot parity breaks it. This keeps every entry within one home
 * game of its away games in a single round robin, and exactly level in a double one.
 */
export function roundRobinDraw(orderedIds: string[], opts: RoundRobinOptions = {}): RoundRobinDraw {
  const ids = dedupe(orderedIds);
  if (ids.length < 2) return { fixtures: [], byes: [], rounds: 0 };
  const list: (string | null)[] = ids.length % 2 === 0 ? [...ids] : [...ids, null];
  const n = list.length;
  const half = n - 1;

  const pairs: { round: number; a: string; b: string }[] = [];
  const byes: { round: number; entryId: string }[] = [];
  for (let r = 0; r < half; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (!a || !b) {
        const rest = a ?? b;
        if (rest) byes.push({ round: r + 1, entryId: rest });
        continue;
      }
      pairs.push({ round: r + 1, a, b });
    }
    const last = list.pop() as string | null;
    list.splice(1, 0, last);
  }

  const balance = new Map<string, number>(ids.map((id) => [id, 0]));
  const lastSide = new Map<string, "H" | "A">();
  const first: DrawFixture[] = [];
  const slotInRound = new Map<number, number>();
  for (const p of pairs) {
    const slot = slotInRound.get(p.round) ?? 0;
    slotInRound.set(p.round, slot + 1);
    const ba = balance.get(p.a)!;
    const bb = balance.get(p.b)!;
    let aHome: boolean;
    if (ba !== bb) aHome = ba < bb;
    else if (lastSide.get(p.a) !== lastSide.get(p.b)) aHome = lastSide.get(p.a) !== "H";
    else aHome = (p.round + slot) % 2 === 1;
    const home = aHome ? p.a : p.b;
    const away = aHome ? p.b : p.a;
    balance.set(home, balance.get(home)! + 1);
    balance.set(away, balance.get(away)! - 1);
    lastSide.set(home, "H");
    lastSide.set(away, "A");
    first.push({ round: p.round, slot, homeEntryId: home, awayEntryId: away, status: "SCHEDULED", winnerEntryId: null });
  }
  repairBalance(first, balance, ids);

  if (!opts.double) return { fixtures: first, byes, rounds: half };
  const second = first.map((f) => ({ ...f, round: f.round + half, homeEntryId: f.awayEntryId, awayEntryId: f.homeEntryId }));
  return {
    fixtures: [...first, ...second],
    byes: [...byes, ...byes.map((b) => ({ round: b.round + half, entryId: b.entryId }))],
    rounds: half * 2,
  };
}
