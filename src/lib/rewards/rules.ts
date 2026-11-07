// TRIQ Rewards: earn rules and fixed caps (spec §3, §9). Pure; no DB, safe on server and client.
//
// Two numbers, kept apart on purpose:
//   XP     progress. Sets levels per sport. Never expires, never spent.
//   Points currency for the academy's reward catalogue. Expire 12 months after they are earned.
//
// Nothing here ever deducts for a missed session, an injury or an illness: there is no negative earn
// rule at all (same principle as src/lib/athlete/points-rules.ts). The only negative ledger rows are a
// redemption debit (refunded on cancel) and the expiry job.

export const EARN_TRIGGERS = [
  "SESSION_ATTENDED",
  "DRILL_COMPLETED",
  "MATCH_PLAYED",
  "MATCH_WON",
  "PERSONAL_BEST",
  "SKILL_IMPROVED",
  "COACH_BONUS",
] as const;
export type EarnTrigger = (typeof EARN_TRIGGERS)[number];
export const isEarnTrigger = (v: unknown): v is EarnTrigger => typeof v === "string" && (EARN_TRIGGERS as readonly string[]).includes(v);

export type EarnValue = { xp: number; points: number };

/** Spec §3 defaults. For COACH_BONUS these are the maximum per award. */
export const DEFAULT_EARN_RULES: Readonly<Record<EarnTrigger, EarnValue>> = {
  SESSION_ATTENDED: { xp: 10, points: 5 },
  DRILL_COMPLETED: { xp: 5, points: 3 },
  MATCH_PLAYED: { xp: 10, points: 5 },
  MATCH_WON: { xp: 10, points: 5 },
  PERSONAL_BEST: { xp: 20, points: 10 },
  SKILL_IMPROVED: { xp: 15, points: 5 },
  COACH_BONUS: { xp: 20, points: 10 },
};

/**
 * The most an academy may set each rule to. Owners tune values between 0 and this ceiling; the
 * ceilings themselves are fixed in code so no academy can inflate points. Coach bonus can't go above
 * the spec's "up to 20 XP / up to 10 points".
 */
export const EARN_RULE_CEILINGS: Readonly<Record<EarnTrigger, EarnValue>> = {
  SESSION_ATTENDED: { xp: 20, points: 10 },
  DRILL_COMPLETED: { xp: 10, points: 6 },
  MATCH_PLAYED: { xp: 20, points: 10 },
  MATCH_WON: { xp: 20, points: 10 },
  PERSONAL_BEST: { xp: 40, points: 20 },
  SKILL_IMPROVED: { xp: 30, points: 10 },
  COACH_BONUS: { xp: 20, points: 10 },
};

export const EARN_LABELS: Readonly<Record<EarnTrigger, string>> = {
  SESSION_ATTENDED: "Session attended",
  DRILL_COMPLETED: "Drill completed",
  MATCH_PLAYED: "Match played",
  MATCH_WON: "Match won",
  PERSONAL_BEST: "Personal best",
  SKILL_IMPROVED: "Skill assessment improved",
  COACH_BONUS: "Coach bonus",
};

/** Ledger sourceType per trigger (PointsLedger/XpLedger.sourceType). */
export const TRIGGER_SOURCE_TYPE: Readonly<Record<EarnTrigger, string>> = {
  SESSION_ATTENDED: "ATTENDANCE",
  DRILL_COMPLETED: "DRILL",
  MATCH_PLAYED: "MATCH",
  MATCH_WON: "MATCH",
  PERSONAL_BEST: "PERFORMANCE",
  SKILL_IMPROVED: "SKILL_REPORT",
  COACH_BONUS: "MANUAL",
};

/** Source types whose positive rows count as "earned" for the monthly caps (refunds don't). */
export const EARN_SOURCE_TYPES = ["ATTENDANCE", "DRILL", "MATCH", "PERFORMANCE", "SKILL_REPORT", "MANUAL"] as const;
/** Non-earn source types. */
export const SOURCE = { REDEMPTION: "REDEMPTION", REFUND: "REVERSAL", EXPIRY: "EXPIRY" } as const;

/** Fixed limits (spec §3 and §9). Not configurable by academies. */
export const CAPS = {
  /** Attendance points per child per calendar month (academy time zone). */
  attendancePointsPerMonth: 100,
  /** All earned points per child per calendar month. */
  pointsPerMonth: 300,
  /** Coach bonus: max per award. */
  coachBonusPointsPerAward: 10,
  coachBonusXpPerAward: 20,
  /** Coach bonus points one coach may give one child in a rolling 7 days. Over the cap is refused. */
  coachBonusPointsPerWeek: 20,
  /** A coach award at or above this many points goes to the owner for review. */
  reviewAtPoints: 10,
  /** A coach's Nth award (or more) within a rolling 24 hours goes to the owner for review. */
  reviewAtAwardsPerDay: 3,
  /** Coach-awarded badges ("Team player", "Most improved") per child per term. */
  coachBadgesPerTerm: 1,
} as const;

export const BONUS_REASONS = {
  EFFORT: "Great effort",
  TEAMWORK: "Teamwork",
  SPORTSMANSHIP: "Sportsmanship",
  LEADERSHIP: "Leadership",
  IMPROVEMENT: "Big improvement",
  HELPING: "Helping others",
} as const;
export type BonusReason = keyof typeof BONUS_REASONS;
export const isBonusReason = (v: unknown): v is BonusReason => typeof v === "string" && v in BONUS_REASONS;

const clampInt = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.trunc(n)));
};

/** Academy overrides merged onto the defaults, each clamped to 0..ceiling. Unknown keys are dropped. */
export function resolveEarnRules(overrides: unknown): Record<EarnTrigger, EarnValue> {
  const src = overrides && typeof overrides === "object" && !Array.isArray(overrides) ? (overrides as Record<string, any>) : {};
  const out = {} as Record<EarnTrigger, EarnValue>;
  for (const t of EARN_TRIGGERS) {
    const d = DEFAULT_EARN_RULES[t];
    const c = EARN_RULE_CEILINGS[t];
    const o = src[t] && typeof src[t] === "object" ? src[t] : {};
    out[t] = { xp: clampInt(o.xp, 0, c.xp, d.xp), points: clampInt(o.points, 0, c.points, d.points) };
  }
  return out;
}

/**
 * Points actually granted for an award after the monthly caps. Never negative, never more than asked.
 * `earnedThisMonth` and `attendanceEarnedThisMonth` are the child's earned (positive, earn-source) points
 * so far this month.
 */
export function capPoints(
  requested: number,
  trigger: EarnTrigger,
  earnedThisMonth: number,
  attendanceEarnedThisMonth: number,
): { granted: number; capped: boolean } {
  const want = Math.max(0, Math.trunc(requested) || 0);
  let room = Math.max(0, CAPS.pointsPerMonth - Math.max(0, earnedThisMonth));
  if (trigger === "SESSION_ATTENDED") room = Math.min(room, Math.max(0, CAPS.attendancePointsPerMonth - Math.max(0, attendanceEarnedThisMonth)));
  const granted = Math.min(want, room);
  return { granted, capped: granted < want };
}

export type BonusCheck =
  | { ok: true; points: number; xp: number; needsReview: boolean }
  | { ok: false; error: string };

/**
 * Validates a coach bonus against the fixed caps. Over any cap is refused (never trimmed).
 * `weekPointsByCoach` = bonus points this coach gave this child in the last 7 days (incl. pending review);
 * `awardsByCoachToday` = this coach's bonus awards (any child) in the last 24 hours (incl. pending);
 * `monthRoom` = points still under the child's monthly cap.
 */
export function checkCoachBonus(input: {
  points: unknown;
  xp?: unknown;
  rule: EarnValue;
  weekPointsByCoach: number;
  awardsByCoachToday: number;
  monthRoom: number;
  reviewable: boolean;
}): BonusCheck {
  const maxPts = Math.min(input.rule.points, CAPS.coachBonusPointsPerAward);
  const maxXp = Math.min(input.rule.xp, CAPS.coachBonusXpPerAward);
  const p = typeof input.points === "number" && Number.isInteger(input.points) ? input.points : NaN;
  if (!(p >= 1)) return { ok: false, error: "Choose at least 1 point" };
  if (p > maxPts) return { ok: false, error: `A bonus can be at most ${maxPts} points` };
  const xpIn = input.xp == null ? Math.min(maxXp, p * 2) : input.xp;
  const xp = typeof xpIn === "number" && Number.isInteger(xpIn) ? xpIn : NaN;
  if (!(xp >= 0) || xp > maxXp) return { ok: false, error: `A bonus can be at most ${maxXp} XP` };
  const weekLeft = CAPS.coachBonusPointsPerWeek - Math.max(0, input.weekPointsByCoach);
  if (p > weekLeft) {
    return { ok: false, error: weekLeft > 0 ? `Weekly bonus cap: only ${weekLeft} more points for this player this week` : "Weekly bonus cap reached for this player" };
  }
  if (p > Math.max(0, input.monthRoom)) return { ok: false, error: "This player has reached the monthly points cap" };
  const needsReview = input.reviewable && (p >= CAPS.reviewAtPoints || input.awardsByCoachToday + 1 >= CAPS.reviewAtAwardsPerDay);
  return { ok: true, points: p, xp, needsReview };
}

// ── Time windows ────────────────────────────────────────────────────────────

const DEFAULT_TZ = "Asia/Kolkata";

/** Offset of `tz` from UTC at `at`, in ms (IST = +19800000). */
export function tzOffsetMs(at: Date, tz: string = DEFAULT_TZ): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(at);
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"), g("second"));
    return asUtc - Math.floor(at.getTime() / 1000) * 1000;
  } catch {
    return tz === DEFAULT_TZ ? 0 : tzOffsetMs(at, DEFAULT_TZ);
  }
}

/** [start, end) of the calendar month containing `at`, in the academy's time zone, as UTC instants. */
export function monthWindow(at: Date, tz: string = DEFAULT_TZ): { start: Date; end: Date; key: string } {
  const local = new Date(at.getTime() + tzOffsetMs(at, tz));
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const startGuess = Date.UTC(y, m, 1);
  const endGuess = Date.UTC(y, m + 1, 1);
  const start = new Date(startGuess - tzOffsetMs(new Date(startGuess), tz));
  const end = new Date(endGuess - tzOffsetMs(new Date(endGuess), tz));
  return { start, end, key: `${y}-${String(m + 1).padStart(2, "0")}` };
}

export const DAY_MS = 24 * 60 * 60 * 1000;
