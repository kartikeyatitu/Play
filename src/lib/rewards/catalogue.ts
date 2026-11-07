// TRIQ Rewards: catalogue items, eligibility and the redemption state machine (spec §5). Pure.

import { normalizeSport } from "@/lib/athlete/passport-build";

export const REWARD_KINDS = ["KIT", "COACH_SESSION", "SHOWCASE", "FEE_CREDIT", "OTHER"] as const;
export type RewardKind = (typeof REWARD_KINDS)[number];
export const REWARD_KIND_LABELS: Readonly<Record<RewardKind, string>> = {
  KIT: "Kit (academy hands over)",
  COACH_SESSION: "Session with a coach (academy schedules)",
  SHOWCASE: "Showcase match place (coach selects)",
  FEE_CREDIT: "Fee credit (owner approves)",
  OTHER: "Other",
};

/** RewardItem.eligibility JSON. */
export type Eligibility = {
  kind: RewardKind;
  /** Minimum XP level (1–10). */
  minLevel?: number;
  /** When set, minLevel is checked in this sport; otherwise the child's best sport. */
  sport?: string;
  /** 0–1, over the last 90 days. */
  minAttendanceRate?: number;
  /** Approvals allowed per rolling 7 days (e.g. coach session capacity). */
  weeklyCapacity?: number;
  /** FEE_CREDIT only: credit in minor units (paise). Recorded for the owner; never written to fee tables here. */
  feeCreditMinor?: number;
};

const int = (v: unknown, lo: number, hi: number): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.trunc(n))) : undefined;
};

export function parseEligibility(v: unknown): Eligibility {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const kind = (REWARD_KINDS as readonly string[]).includes(o.kind as string) ? (o.kind as RewardKind) : "OTHER";
  const out: Eligibility = { kind };
  const minLevel = int(o.minLevel, 1, 10);
  if (minLevel && minLevel > 1) out.minLevel = minLevel;
  const sport = typeof o.sport === "string" ? normalizeSport(o.sport) : "";
  if (sport) out.sport = sport;
  const rate = typeof o.minAttendanceRate === "number" && Number.isFinite(o.minAttendanceRate) ? Math.min(1, Math.max(0, o.minAttendanceRate)) : undefined;
  if (rate) out.minAttendanceRate = Math.round(rate * 100) / 100;
  const cap = int(o.weeklyCapacity, 1, 1000);
  if (cap) out.weeklyCapacity = cap;
  if (kind === "FEE_CREDIT") {
    const minor = int(o.feeCreditMinor, 0, 10_000_000);
    if (minor) out.feeCreditMinor = minor;
  }
  return out;
}

export type EligibilityContext = {
  active: boolean;
  costPoints: number;
  stock: number | null;
  balance: number;
  /** XP level in `eligibility.sport` when set, else the best level across sports. */
  level: number;
  /** 0–1 over the last 90 days; null with no sessions. */
  attendanceRate: number | null;
  feeCreditsEnabled: boolean;
};

/** Every reason the child can't have this item right now (empty = eligible). Checked again at request time. */
export function eligibilityProblems(e: Eligibility, c: EligibilityContext): string[] {
  const out: string[] = [];
  if (!c.active) out.push("Not available");
  if (e.kind === "FEE_CREDIT" && !c.feeCreditsEnabled) out.push("Fee credits are off at this academy");
  if (c.stock != null && c.stock <= 0) out.push("Out of stock");
  if (e.minLevel && c.level < e.minLevel) out.push(`Needs Level ${e.minLevel}${e.sport ? ` in ${e.sport.replace(/_/g, " ")}` : ""}`);
  if (e.minAttendanceRate) {
    const need = Math.round(e.minAttendanceRate * 100);
    if (c.attendanceRate == null || c.attendanceRate < e.minAttendanceRate) out.push(`Needs ${need}%+ attendance`);
  }
  if (c.balance < c.costPoints) out.push(`Needs ${c.costPoints - c.balance} more points`);
  return out;
}

export type RewardItemInput = { name: string; description: string | null; costPoints: number; stock: number | null; eligibility: Eligibility };

export function parseRewardItemInput(v: unknown): { ok: true; value: RewardItemInput } | { ok: false; error: string } {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const name = typeof o.name === "string" ? o.name.replace(/\s+/g, " ").trim() : "";
  if (name.length < 2 || name.length > 80) return { ok: false, error: "Name must be 2–80 characters" };
  const description = typeof o.description === "string" && o.description.trim() ? o.description.trim().slice(0, 300) : null;
  const cost = typeof o.costPoints === "number" ? o.costPoints : Number(o.costPoints);
  if (!Number.isInteger(cost) || cost < 1 || cost > 100_000) return { ok: false, error: "Cost must be a whole number of points (1–100000)" };
  let stock: number | null = null;
  if (o.stock !== null && o.stock !== undefined && o.stock !== "") {
    const s = typeof o.stock === "number" ? o.stock : Number(o.stock);
    if (!Number.isInteger(s) || s < 0 || s > 100_000) return { ok: false, error: "Stock must be blank (unlimited) or a whole number" };
    stock = s;
  }
  return { ok: true, value: { name, description, costPoints: cost, stock, eligibility: parseEligibility(o.eligibility) } };
}

/** Spec §5 launch catalogue, offered to owners as a starting point (fee credit off until opted in). */
export const SUGGESTED_ITEMS: ReadonlyArray<RewardItemInput> = [
  { name: "Academy T-shirt", description: null, costPoints: 150, stock: 20, eligibility: { kind: "KIT" } },
  { name: "Academy bag", description: null, costPoints: 300, stock: 10, eligibility: { kind: "KIT" } },
  { name: "Session with a senior coach", description: null, costPoints: 200, stock: null, eligibility: { kind: "COACH_SESSION", minLevel: 3, weeklyCapacity: 2 } },
  { name: "Place in showcase match", description: null, costPoints: 250, stock: 11, eligibility: { kind: "SHOWCASE", minLevel: 3, minAttendanceRate: 0.8 } },
];

// ── Redemption state machine ────────────────────────────────────────────────
// REQUESTED → APPROVED → FULFILLED, and REQUESTED/APPROVED → CANCELLED (decline or cancel). Points are
// debited at request time (so they can't be spent twice) and refunded as a NEW ledger row on cancel.
// Stock/capacity is taken at approval and put back if an approved redemption is cancelled.

export const REDEMPTION_STATUSES = ["REQUESTED", "APPROVED", "FULFILLED", "CANCELLED"] as const;
export type RedemptionStatus = (typeof REDEMPTION_STATUSES)[number];
export type RedemptionAction = "approve" | "decline" | "fulfil" | "cancel";

const NEXT: Readonly<Record<RedemptionAction, { from: RedemptionStatus[]; to: RedemptionStatus }>> = {
  approve: { from: ["REQUESTED"], to: "APPROVED" },
  decline: { from: ["REQUESTED"], to: "CANCELLED" },
  fulfil: { from: ["APPROVED"], to: "FULFILLED" },
  cancel: { from: ["REQUESTED", "APPROVED"], to: "CANCELLED" },
};

export function nextStatus(current: string, action: RedemptionAction): RedemptionStatus | null {
  const t = NEXT[action];
  return (t.from as string[]).includes(current) ? t.to : null;
}

/** Points go back to the child when the redemption ends without fulfilment. */
export const refundsOn = (action: RedemptionAction) => action === "decline" || action === "cancel";
/** Stock goes back only if it was taken (the redemption had been approved). */
export const restocksOn = (action: RedemptionAction, from: string) => action === "cancel" && from === "APPROVED";
