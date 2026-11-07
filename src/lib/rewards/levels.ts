// TRIQ Rewards: XP levels per sport (spec §4). Pure.
//
// How this relates to the Athlete Passport level (src/lib/athlete/passport-build.ts `sportLevel`):
//   - Passport level (Foundation → Advanced, 1–4) is a SKILL level: it comes only from matches played,
//     win rate and coach assessments, and can go down if assessments do.
//   - Rewards XP level (Level 1–10, academy-named tiers) is an EFFORT/PROGRESS level: it comes only from
//     the append-only XP ledger and never goes down (XP never expires and is never spent).
// They are deliberately separate measures and are always shown with their own labels. To keep them from
// being confused, the default XP tier names never reuse the passport's LEVEL_NAMES (a test pins this),
// and owners can't set a tier name that collides with them. Reward eligibility ("Level 3+") means the
// XP level. Neither ever reads attendance absences, medical or wellbeing data.

import { LEVEL_NAMES as PASSPORT_LEVEL_NAMES, normalizeSport } from "@/lib/athlete/passport-build";
import type { EarnTrigger } from "./rules";

/** XP needed for each level; index 0 = Level 1. Same in every academy (spec: levels mean something across TRIQ). */
export const XP_LEVEL_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200] as const;
export const MAX_XP_LEVEL = XP_LEVEL_THRESHOLDS.length;
export const DEFAULT_TIER_NAMES = ["Rookie", "Starter", "Regular", "Pro", "Captain"] as const;

export type XpLevel = {
  level: number;
  xp: number;
  /** XP at which this level started. */
  floor: number;
  /** XP needed for the next level, or null at the top. */
  nextAt: number | null;
  /** 0–1 progress through this level (1 at the top). */
  progress: number;
};

export function xpLevel(xpIn: number): XpLevel {
  const xp = Math.max(0, Math.trunc(Number.isFinite(xpIn) ? xpIn : 0));
  let i = 0;
  while (i + 1 < XP_LEVEL_THRESHOLDS.length && xp >= XP_LEVEL_THRESHOLDS[i + 1]) i++;
  const floor = XP_LEVEL_THRESHOLDS[i];
  const nextAt = i + 1 < XP_LEVEL_THRESHOLDS.length ? XP_LEVEL_THRESHOLDS[i + 1] : null;
  const progress = nextAt == null ? 1 : Math.min(1, (xp - floor) / (nextAt - floor));
  return { level: i + 1, xp, floor, nextAt, progress: Math.round(progress * 1000) / 1000 };
}

/** Tier name for a level: names[level-1], the last name repeating for levels beyond the list. */
export function tierName(level: number, names: ReadonlyArray<string> = DEFAULT_TIER_NAMES): string {
  const list = names.length ? names : DEFAULT_TIER_NAMES;
  return list[Math.min(Math.max(1, level), list.length) - 1];
}

const PASSPORT_NAMES_LOWER = new Set(PASSPORT_LEVEL_NAMES.map((n) => n.toLowerCase()));

/** Owner-entered tier names: 1–10 names, each 1–24 chars, no passport level names. Falls back to defaults. */
export function sanitizeTierNames(v: unknown): string[] {
  if (!Array.isArray(v)) return [...DEFAULT_TIER_NAMES];
  const names = v
    .map((x) => (typeof x === "string" ? x.replace(/\s+/g, " ").trim().slice(0, 24) : ""))
    .filter((x) => x && !PASSPORT_NAMES_LOWER.has(x.toLowerCase()))
    .slice(0, MAX_XP_LEVEL);
  return names.length ? names : [...DEFAULT_TIER_NAMES];
}

// ── XP rows carry their sport in reasonCode: "<TRIGGER>@<sport>" ────────────
// (XpLedger has no sport column; the schema is fixed for v1.)

export const GENERAL_SPORT = "general";

export function xpReasonCode(trigger: EarnTrigger | string, sport: string | null | undefined): string {
  return `${trigger}@${normalizeSport(sport) || GENERAL_SPORT}`;
}

export function parseXpReason(reasonCode: string): { trigger: string; sport: string } {
  const at = reasonCode.lastIndexOf("@");
  if (at < 0) return { trigger: reasonCode, sport: GENERAL_SPORT };
  return { trigger: reasonCode.slice(0, at), sport: reasonCode.slice(at + 1) || GENERAL_SPORT };
}

export type XpRow = { delta: number; reasonCode: string };

export function xpBySport(rows: ReadonlyArray<XpRow>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const { sport } = parseXpReason(r.reasonCode);
    out[sport] = (out[sport] ?? 0) + (Math.trunc(r.delta) || 0);
  }
  for (const k of Object.keys(out)) out[k] = Math.max(0, out[k]);
  return out;
}

export function levelsBySport(rows: ReadonlyArray<XpRow>, names?: ReadonlyArray<string>) {
  return Object.entries(xpBySport(rows))
    .map(([sport, xp]) => {
      const l = xpLevel(xp);
      return { sport, ...l, tier: tierName(l.level, names) };
    })
    .sort((a, b) => b.xp - a.xp || a.sport.localeCompare(b.sport));
}

/** Highest XP level across sports (what "Level 3+" eligibility checks unless an item names a sport). */
export function topXpLevel(rows: ReadonlyArray<XpRow>, sport?: string | null): number {
  const by = xpBySport(rows);
  if (sport) return xpLevel(by[normalizeSport(sport)] ?? 0).level;
  return Math.max(1, ...Object.values(by).map((x) => xpLevel(x).level));
}

// ── Elo rating for head-to-head sports (spec §4) ────────────────────────────
// Pure helper only. Ratings are not stored in v1 (no table); see the build report.

export const HEAD_TO_HEAD_SPORTS = ["chess", "badminton", "tennis", "table_tennis"] as const;
export const ELO_START = 1000;

export function eloExpected(ra: number, rb: number): number {
  return 1 / (1 + 10 ** ((rb - ra) / 400));
}

/** New ratings after one game. score: 1 = A won, 0.5 = draw, 0 = B won. */
export function eloUpdate(ra: number, rb: number, score: 0 | 0.5 | 1, k = 24): { a: number; b: number } {
  const ea = eloExpected(ra, rb);
  const d = k * (score - ea);
  return { a: Math.round(ra + d), b: Math.round(rb - d) };
}
