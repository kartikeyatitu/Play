// TRIQ Rewards: ledger maths (spec §5, §8). Pure; no DB.
//
// Both ledgers are append-only. No balance column is trusted: the balance is computed from the rows.
//
// Points lots: every positive row is a lot that expires at `expiresAt` (12 months after earning).
// A debit (redemption) consumes the soonest-expiring unexpired lots first, so a child never loses
// points to expiry that they could have spent. An EXPIRY row (sourceRef = the lot's id) removes what is
// left of that lot. Balance at `now` = what remains in lots that have not expired at `now`. A lot past
// its date but not yet processed by the job already counts as expired (it shows in `pendingExpiry`).

import { DAY_MS, SOURCE, type EarnTrigger } from "./rules";

export const POINTS_EXPIRY_MONTHS = 12;
export const EXPIRY_WARNING_DAYS = 30;

// ── Idempotency keys ────────────────────────────────────────────────────────

const TRIGGER_KEY: Readonly<Record<EarnTrigger, string>> = {
  SESSION_ATTENDED: "attendance",
  DRILL_COMPLETED: "drill",
  MATCH_PLAYED: "match",
  MATCH_WON: "match-win",
  PERSONAL_BEST: "pb",
  SKILL_IMPROVED: "skill",
  COACH_BONUS: "bonus",
};

const SAFE_PART = /^[A-Za-z0-9_.-]{1,128}$/;

function part(v: string, what: string): string {
  const s = String(v ?? "").trim();
  if (!SAFE_PART.test(s)) throw new Error(`Invalid ${what} for idempotency key`);
  return s;
}

/** `<source>:<sourceId>:<studentId>`, e.g. `attendance:<sessionId>:<studentId>`. Same key in both ledgers. */
export function earnKey(trigger: EarnTrigger, sourceId: string, studentId: string): string {
  return `${TRIGGER_KEY[trigger]}:${part(sourceId, "source id")}:${part(studentId, "student id")}`;
}
export const redeemKey = (redemptionId: string) => `redeem:${part(redemptionId, "redemption id")}`;
export const refundKey = (redemptionId: string) => `refund:${part(redemptionId, "redemption id")}`;
export const expiryKey = (lotId: string) => `expire:${part(lotId, "ledger row id")}`;

// ── Dates ───────────────────────────────────────────────────────────────────

/** Same day-of-month `months` later (UTC), clamped to the month's last day (29 Feb → 28 Feb). */
export function addMonthsUtc(d: Date, months: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(y, m, Math.min(d.getUTCDate(), lastDay), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()),
  );
}

export const pointsExpiryFor = (earnedAt: Date) => addMonthsUtc(earnedAt, POINTS_EXPIRY_MONTHS);

// ── Simulation ──────────────────────────────────────────────────────────────

export type PointsRow = {
  id: string;
  delta: number;
  sourceType: string;
  sourceRef?: string | null;
  createdAt: Date | string;
  expiresAt?: Date | string | null;
};

export type Lot = { id: string; amount: number; remaining: number; createdAt: Date; expiresAt: Date | null };

export type PointsState = {
  /** Spendable now. Never negative. */
  balance: number;
  lots: Lot[];
  /** Lots past their expiry with points left and no EXPIRY row yet: what the job will write off. */
  pendingExpiry: { lotId: string; amount: number; expiresAt: Date }[];
  /** For each debit row id, the lots it consumed (used to give a refund the same expiry). */
  consumed: Map<string, { lotId: string; amount: number; expiresAt: Date | null }[]>;
  /** Debits not covered by any lot (should stay 0; reported, never hidden). */
  deficit: number;
};

const toDate = (d: Date | string | null | undefined): Date | null => (d == null ? null : d instanceof Date ? d : new Date(d));
const isLive = (lot: Lot, at: number) => lot.remaining > 0 && (lot.expiresAt == null || lot.expiresAt.getTime() > at);

export function simulatePoints(rows: ReadonlyArray<PointsRow>, now: Date): PointsState {
  const ordered = rows
    .map((r, i) => ({ r, i, at: toDate(r.createdAt)!.getTime() }))
    .sort((a, b) => a.at - b.at || (a.r.delta > 0 ? 0 : 1) - (b.r.delta > 0 ? 0 : 1) || a.i - b.i);
  const lots: Lot[] = [];
  const byId = new Map<string, Lot>();
  const consumed = new Map<string, { lotId: string; amount: number; expiresAt: Date | null }[]>();
  let deficit = 0;

  for (const { r, at } of ordered) {
    const delta = Math.trunc(r.delta) || 0;
    if (delta > 0) {
      const lot: Lot = { id: r.id, amount: delta, remaining: delta, createdAt: new Date(at), expiresAt: toDate(r.expiresAt) };
      // Pay any earlier shortfall first.
      const pay = Math.min(deficit, lot.remaining);
      lot.remaining -= pay;
      deficit -= pay;
      lots.push(lot);
      byId.set(lot.id, lot);
      continue;
    }
    if (delta === 0) continue;
    if (r.sourceType === SOURCE.EXPIRY) {
      const lot = r.sourceRef ? byId.get(r.sourceRef) : undefined;
      if (lot) lot.remaining = Math.max(0, lot.remaining - -delta);
      continue;
    }
    // A debit: soonest-expiring live lots first (never-expiring last), then oldest.
    let need = -delta;
    const used: { lotId: string; amount: number; expiresAt: Date | null }[] = [];
    const live = lots
      .filter((l) => isLive(l, at))
      .sort((a, b) => (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity) || a.createdAt.getTime() - b.createdAt.getTime());
    for (const l of live) {
      if (need <= 0) break;
      const take = Math.min(need, l.remaining);
      l.remaining -= take;
      need -= take;
      used.push({ lotId: l.id, amount: take, expiresAt: l.expiresAt });
    }
    deficit += need;
    consumed.set(r.id, used);
  }

  const nowMs = now.getTime();
  const live = lots.filter((l) => isLive(l, nowMs)).reduce((s, l) => s + l.remaining, 0);
  const pendingExpiry = lots
    .filter((l) => l.remaining > 0 && l.expiresAt != null && l.expiresAt.getTime() <= nowMs)
    .map((l) => ({ lotId: l.id, amount: l.remaining, expiresAt: l.expiresAt as Date }));
  return { balance: Math.max(0, live - deficit), lots, pendingExpiry, consumed, deficit };
}

export const pointsBalance = (rows: ReadonlyArray<PointsRow>, now: Date) => simulatePoints(rows, now).balance;

/** Points that will expire within `days` (default 30) and the first date, for the parent warning. */
export function expiringSoon(rows: ReadonlyArray<PointsRow>, now: Date, days = EXPIRY_WARNING_DAYS): { amount: number; firstAt: Date | null } {
  const until = now.getTime() + days * DAY_MS;
  const soon = simulatePoints(rows, now).lots.filter(
    (l) => l.remaining > 0 && l.expiresAt != null && l.expiresAt.getTime() > now.getTime() && l.expiresAt.getTime() <= until,
  );
  const firstAt = soon.reduce<Date | null>((m, l) => (m == null || l.expiresAt! < m ? l.expiresAt : m), null);
  return { amount: soon.reduce((s, l) => s + l.remaining, 0), firstAt };
}

/** The negative EXPIRY rows the job should write now (one per lot, idempotent by lot id). */
export function expiryRowsDue(rows: ReadonlyArray<PointsRow>, now: Date): { lotId: string; delta: number; idempotencyKey: string }[] {
  return simulatePoints(rows, now).pendingExpiry.map((p) => ({ lotId: p.lotId, delta: -p.amount, idempotencyKey: expiryKey(p.lotId) }));
}

/**
 * Expiry for a refund row. The refund keeps the latest expiry of the lots the debit used, so cancelling
 * can't be used to stretch points' life by much, but it never lands inside the 30-day warning window
 * (the parent always gets the warning before refunded points expire).
 */
export function refundExpiry(state: PointsState, debitRowId: string, now: Date): Date {
  const floor = new Date(now.getTime() + (EXPIRY_WARNING_DAYS + 1) * DAY_MS);
  const used = state.consumed.get(debitRowId) ?? [];
  const latest = used.reduce<Date | null>((m, u) => (u.expiresAt && (!m || u.expiresAt > m) ? u.expiresAt : m), null);
  if (used.some((u) => u.expiresAt == null)) return pointsExpiryFor(now);
  return latest && latest > floor ? latest : floor;
}

/** Sum of earned (positive, earn-source) points in [start, end). */
export function earnedInWindow(rows: ReadonlyArray<PointsRow>, start: Date, end: Date, sourceTypes: ReadonlyArray<string>): number {
  const s = start.getTime();
  const e = end.getTime();
  return rows.reduce((sum, r) => {
    const at = toDate(r.createdAt)!.getTime();
    return r.delta > 0 && at >= s && at < e && sourceTypes.includes(r.sourceType) ? sum + r.delta : sum;
  }, 0);
}
