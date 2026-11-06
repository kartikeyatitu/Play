// One entry point for every draw type. Pure, deterministic, client-safe (the UI uses it to preview).
import { MAX_KNOCKOUT_ENTRIES, seedOrder, type SeedableEntry } from "@/lib/competition";
import { groupStageDraw } from "./groups";
import { knockoutDraw } from "./knockout";
import { isKnockoutPhaseRound, type DrawFixture, type DrawMode } from "./phase";
import { roundRobinDraw } from "./round-robin";

export type DrawRequest = { mode: DrawMode; double?: boolean; groups?: number; advance?: number };

export type DrawPlan = {
  mode: DrawMode;
  fixtures: DrawFixture[];
  /** Fixtures that will actually be played (BYEs and empty knockout slots included in `fixtures`). */
  matches: number;
  rounds: number;
  groups: string[][] | null;
};

/** Which draw types a competition's format allows. */
export function drawModesFor(format: string): DrawMode[] {
  return format === "KNOCKOUT" ? ["KNOCKOUT", "GROUPS"] : ["ROUND_ROBIN", "GROUPS"];
}

export function planDraw(entries: SeedableEntry[], req: DrawRequest): { ok: true; plan: DrawPlan } | { ok: false; error: string } {
  const order = seedOrder(entries);
  if (order.length < 2) return { ok: false, error: "At least 2 entries are needed." };
  if (req.mode === "ROUND_ROBIN") {
    const d = roundRobinDraw(order, { double: !!req.double });
    return { ok: true, plan: { mode: req.mode, fixtures: d.fixtures, matches: d.fixtures.length, rounds: d.rounds, groups: null } };
  }
  if (req.mode === "KNOCKOUT") {
    if (order.length > MAX_KNOCKOUT_ENTRIES) return { ok: false, error: `A knockout takes at most ${MAX_KNOCKOUT_ENTRIES} entries.` };
    const d = knockoutDraw(order);
    return { ok: true, plan: { mode: req.mode, fixtures: d.fixtures, matches: order.length - 1, rounds: d.rounds, groups: null } };
  }
  const r = groupStageDraw(order, { groups: Number(req.groups), advance: Number(req.advance), double: !!req.double });
  if (!r.ok) return r;
  const groupMatches = r.draw.fixtures.filter((f) => !isKnockoutPhaseRound(f.round)).length;
  const qualifiers = Number(req.groups) * Number(req.advance);
  return {
    ok: true,
    plan: {
      mode: req.mode,
      fixtures: r.draw.fixtures,
      matches: groupMatches + qualifiers - 1,
      rounds: r.draw.groupRounds + r.draw.knockoutRounds,
      groups: r.draw.groups,
    },
  };
}
