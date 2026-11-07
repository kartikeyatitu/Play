import { describe, it, expect } from "vitest";
import {
  addMonthsUtc,
  earnedInWindow,
  earnKey,
  expiringSoon,
  expiryKey,
  expiryRowsDue,
  pointsBalance,
  pointsExpiryFor,
  redeemKey,
  refundExpiry,
  refundKey,
  simulatePoints,
  type PointsRow,
} from "@/lib/rewards/ledger";
import { EARN_SOURCE_TYPES } from "@/lib/rewards/rules";

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));
let n = 0;
const earn = (amount: number, at: Date, id = `e${++n}`): PointsRow => ({ id, delta: amount, sourceType: "ATTENDANCE", createdAt: at, expiresAt: pointsExpiryFor(at) });
const spend = (amount: number, at: Date, id = `s${++n}`): PointsRow => ({ id, delta: -amount, sourceType: "REDEMPTION", createdAt: at });
const expire = (lotId: string, amount: number, at: Date): PointsRow => ({ id: `x${++n}`, delta: -amount, sourceType: "EXPIRY", sourceRef: lotId, createdAt: at });

describe("idempotency keys", () => {
  it("are source + source id + student", () => {
    expect(earnKey("SESSION_ATTENDED", "sess1", "stu1")).toBe("attendance:sess1:stu1");
    expect(earnKey("MATCH_WON", "m1", "stu1")).toBe("match-win:m1:stu1");
    expect(earnKey("MATCH_PLAYED", "m1", "stu1")).not.toBe(earnKey("MATCH_WON", "m1", "stu1"));
    expect(redeemKey("r1")).toBe("redeem:r1");
    expect(refundKey("r1")).toBe("refund:r1");
    expect(expiryKey("lot1")).toBe("expire:lot1");
  });

  it("are deterministic, so a retry hits the unique key", () => {
    expect(earnKey("DRILL_COMPLETED", "d1", "s1")).toBe(earnKey("DRILL_COMPLETED", "d1", "s1"));
  });

  it("reject ids that could forge another key", () => {
    expect(() => earnKey("SESSION_ATTENDED", "a:b", "s1")).toThrow();
    expect(() => earnKey("SESSION_ATTENDED", "", "s1")).toThrow();
    expect(() => earnKey("SESSION_ATTENDED", "x", "s 1")).toThrow();
  });
});

describe("expiry date", () => {
  it("is 12 months after earning", () => {
    expect(pointsExpiryFor(d(2026, 3, 15)).toISOString()).toBe(d(2027, 3, 15).toISOString());
  });
  it("clamps month ends", () => {
    expect(addMonthsUtc(d(2028, 2, 29), 12).toISOString()).toBe(d(2029, 2, 28).toISOString());
    expect(addMonthsUtc(d(2026, 1, 31), 1).toISOString()).toBe(d(2026, 2, 28).toISOString());
  });
});

describe("balance", () => {
  it("sums unexpired rows", () => {
    const rows = [earn(50, d(2026, 1, 1)), earn(30, d(2026, 6, 1)), spend(20, d(2026, 7, 1))];
    expect(pointsBalance(rows, d(2026, 8, 1))).toBe(60);
  });

  it("drops expired lots even before the job runs", () => {
    const rows = [earn(50, d(2025, 1, 1)), earn(30, d(2026, 6, 1))];
    const s = simulatePoints(rows, d(2026, 2, 1));
    expect(s.balance).toBe(30);
    expect(s.pendingExpiry).toEqual([{ lotId: rows[0].id, amount: 50, expiresAt: d(2026, 1, 1) }]);
  });

  it("spends the soonest-expiring points first, so expiry only takes what's left", () => {
    const a = earn(100, d(2025, 3, 1));
    const b = earn(100, d(2025, 9, 1));
    const rows = [a, b, spend(120, d(2025, 10, 1))];
    const s = simulatePoints(rows, d(2026, 3, 2)); // a expired
    expect(s.pendingExpiry).toEqual([]); // a was fully spent
    expect(s.balance).toBe(80);
  });

  it("an EXPIRY row removes the rest of its lot and balance is unchanged by running the job", () => {
    const a = earn(100, d(2025, 3, 1));
    const rows = [a, spend(40, d(2025, 6, 1))];
    const now = d(2026, 3, 5);
    const due = expiryRowsDue(rows, now);
    expect(due).toEqual([{ lotId: a.id, delta: -60, idempotencyKey: `expire:${a.id}` }]);
    const before = pointsBalance(rows, now);
    const after = [...rows, expire(a.id, 60, now)];
    expect(pointsBalance(after, now)).toBe(before);
    expect(expiryRowsDue(after, now)).toEqual([]); // idempotent: nothing more due
  });

  it("a debit can't use points that had already expired at the time", () => {
    const a = earn(100, d(2025, 1, 1));
    const rows = [a, spend(50, d(2026, 2, 1))];
    const s = simulatePoints(rows, d(2026, 2, 2));
    expect(s.deficit).toBe(50);
    expect(s.balance).toBe(0);
  });

  it("a refund row gives the points back", () => {
    const a = earn(200, d(2026, 1, 1));
    const debit = spend(150, d(2026, 2, 1));
    const refund: PointsRow = { id: "rf", delta: 150, sourceType: "REVERSAL", createdAt: d(2026, 2, 3), expiresAt: d(2027, 1, 1) };
    expect(pointsBalance([a, debit], d(2026, 2, 2))).toBe(50);
    expect(pointsBalance([a, debit, refund], d(2026, 2, 4))).toBe(200);
  });

  it("never reports a negative balance", () => {
    expect(pointsBalance([spend(10, d(2026, 1, 1))], d(2026, 2, 1))).toBe(0);
  });
});

describe("refund expiry", () => {
  it("keeps the latest expiry of the lots the debit used", () => {
    const a = earn(100, d(2026, 1, 1));
    const b = earn(100, d(2026, 4, 1));
    const debit = spend(150, d(2026, 5, 1));
    const s = simulatePoints([a, b, debit], d(2026, 5, 2));
    expect(refundExpiry(s, debit.id, d(2026, 5, 2)).toISOString()).toBe(d(2027, 4, 1).toISOString());
  });

  it("never lands inside the 30-day warning window", () => {
    const a = earn(100, d(2025, 6, 1));
    const debit = spend(100, d(2026, 5, 20));
    const now = d(2026, 5, 25);
    const s = simulatePoints([a, debit], now);
    expect(refundExpiry(s, debit.id, now).getTime()).toBeGreaterThan(now.getTime() + 30 * 86400000);
  });
});

describe("expiring soon", () => {
  it("reports points expiring in the next 30 days", () => {
    const a = earn(40, d(2025, 11, 20));
    const b = earn(10, d(2026, 6, 1));
    const r = expiringSoon([a, b], d(2026, 11, 1));
    expect(r.amount).toBe(40);
    expect(r.firstAt?.toISOString()).toBe(d(2026, 11, 20).toISOString());
    expect(expiringSoon([b], d(2026, 11, 1)).amount).toBe(0);
  });
});

describe("earned in window", () => {
  it("counts earn sources only, not refunds or debits", () => {
    const rows: PointsRow[] = [
      earn(5, d(2026, 11, 2)),
      { id: "m", delta: 10, sourceType: "MANUAL", createdAt: d(2026, 11, 3) },
      { id: "r", delta: 150, sourceType: "REVERSAL", createdAt: d(2026, 11, 4) },
      spend(20, d(2026, 11, 5)),
      earn(5, d(2026, 10, 30)),
    ];
    expect(earnedInWindow(rows, d(2026, 11, 1), d(2026, 12, 1), EARN_SOURCE_TYPES)).toBe(15);
  });
});
