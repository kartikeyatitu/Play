// TRIQ Rewards: academy settings. Pure.
//
// v1 has no settings table (schema is fixed), so settings are stored as an append-only AuditLog row
// (action REWARDS_SETTINGS, details = this JSON). The newest row wins; every change is therefore audited
// with who made it. Move to a real table when the schema next changes.

import { resolveEarnRules, type EarnTrigger, type EarnValue } from "./rules";
import { DEFAULT_TIER_NAMES, sanitizeTierNames } from "./levels";

export const SETTINGS_ACTION = "REWARDS_SETTINGS";

export type RewardsSettings = {
  earnRules: Record<EarnTrigger, EarnValue>;
  tierNames: string[];
  /** Fee-credit rewards: off unless the owner opts in. Even when on, nothing here writes fee tables. */
  feeCreditsEnabled: boolean;
  /** Owner's estimate of what one point costs the academy, in minor units (paise). 0 = not set. */
  pointValueMinor: number;
};

export const DEFAULT_SETTINGS: RewardsSettings = {
  earnRules: resolveEarnRules({}),
  tierNames: [...DEFAULT_TIER_NAMES],
  feeCreditsEnabled: false,
  pointValueMinor: 0,
};

export function parseSettings(v: unknown): RewardsSettings {
  let o: Record<string, unknown> = {};
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      if (p && typeof p === "object" && !Array.isArray(p)) o = p;
    } catch {
      /* defaults */
    }
  } else if (v && typeof v === "object" && !Array.isArray(v)) o = v as Record<string, unknown>;
  const pv = typeof o.pointValueMinor === "number" && Number.isFinite(o.pointValueMinor) ? Math.min(100_000, Math.max(0, Math.trunc(o.pointValueMinor))) : 0;
  return {
    earnRules: resolveEarnRules(o.earnRules),
    tierNames: sanitizeTierNames(o.tierNames),
    feeCreditsEnabled: o.feeCreditsEnabled === true,
    pointValueMinor: pv,
  };
}
