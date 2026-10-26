import { describe, it, expect } from "vitest";
import { blockAllows, cancellationQuote, rescheduleCheck, DEFAULT_VENUE_POLICY } from "@/lib/venue-policy";
import { computeUtilisation } from "@/lib/venue-utilisation";

const now = new Date("2026-11-01T06:00:00Z");
const at = (hoursFromNow: number) => new Date(now.getTime() + hoursFromNow * 3600_000);
const booking = (o: Partial<{ status: string; source: string; start: number; hours: number; advancePaid: number }> = {}) => {
  const start = at(o.start ?? 48);
  return {
    status: o.status ?? "CONFIRMED",
    source: o.source ?? "COUNTER",
    startTime: start,
    endTime: new Date(start.getTime() + (o.hours ?? 1) * 3600_000),
    advancePaid: o.advancePaid ?? 1000,
  };
};

describe("cancellationQuote", () => {
  it("full refund at or beyond 24h", () => {
    expect(cancellationQuote(booking({ start: 24 }), now)).toMatchObject({ allowed: true, tier: "FULL", refundDue: 1000 });
    expect(cancellationQuote(booking({ start: 100 }), now).refundDue).toBe(1000);
  });
  it("50% between 4h and 24h, rounded down", () => {
    expect(cancellationQuote(booking({ start: 23.9, advancePaid: 999 }), now)).toMatchObject({ tier: "PARTIAL", refundDue: 499 });
    expect(cancellationQuote(booking({ start: 4 }), now)).toMatchObject({ tier: "PARTIAL", refundDue: 500 });
  });
  it("nothing under 4h or after start", () => {
    expect(cancellationQuote(booking({ start: 3.9 }), now)).toMatchObject({ tier: "NONE", refundDue: 0, allowed: true });
    expect(cancellationQuote(booking({ start: -1 }), now)).toMatchObject({ tier: "NONE", refundDue: 0 });
  });
  it("nothing received → nothing due", () => {
    expect(cancellationQuote(booking({ advancePaid: 0 }), now)).toMatchObject({ tier: "NOTHING_RECEIVED", refundDue: 0 });
  });
  it("paid-but-slot-taken is always a full refund and flags the gateway", () => {
    expect(cancellationQuote(booking({ status: "PAID_CONFLICT", start: 1, advancePaid: 300 }), now)).toMatchObject({ tier: "FULL", refundDue: 300, checkGateway: true });
  });
  it("blocks and finished bookings", () => {
    expect(cancellationQuote(booking({ source: "BLOCK", advancePaid: 0 }), now)).toMatchObject({ tier: "BLOCK", allowed: true });
    expect(cancellationQuote(booking({ status: "COMPLETED" }), now).allowed).toBe(false);
    expect(cancellationQuote(booking({ status: "CANCELLED" }), now).allowed).toBe(false);
  });
  it("respects a custom policy", () => {
    const p = { ...DEFAULT_VENUE_POLICY, fullRefundHours: 48, partialRefundPct: 25 };
    expect(cancellationQuote(booking({ start: 30 }), now, p)).toMatchObject({ tier: "PARTIAL", refundDue: 250 });
  });
});

describe("rescheduleCheck", () => {
  const target = (startH: number, hours = 1, extra: Partial<{ sameSlot: boolean; startHour: number; openHour: number; closeHour: number }> = {}) => ({
    newStart: at(startH),
    newEnd: at(startH + hours),
    sameSlot: false,
    startHour: 10,
    openHour: 6,
    closeHour: 23,
    ...extra,
  });
  it("allows a confirmed booking far enough ahead", () => {
    expect(rescheduleCheck(booking(), target(72), now)).toEqual({ ok: true });
  });
  it("blocks inside the cutoff, past targets and length changes", () => {
    expect(rescheduleCheck(booking({ start: 3 }), target(72), now).ok).toBe(false);
    expect(rescheduleCheck(booking(), target(-2), now).ok).toBe(false);
    expect(rescheduleCheck(booking(), target(72, 2), now).ok).toBe(false);
  });
  it("blocks outside opening hours, same slot, non-confirmed and blocks", () => {
    expect(rescheduleCheck(booking(), target(72, 1, { startHour: 23 }), now).ok).toBe(false);
    expect(rescheduleCheck(booking(), target(72, 1, { sameSlot: true }), now).ok).toBe(false);
    expect(rescheduleCheck(booking({ status: "HOLD" }), target(72), now).ok).toBe(false);
    expect(rescheduleCheck(booking({ source: "BLOCK" }), target(72), now).ok).toBe(false);
  });
  it("blocks only allow cancel", () => {
    expect(blockAllows("CANCEL")).toBe(true);
    expect(blockAllows("COMPLETE")).toBe(false);
    expect(blockAllows("COLLECT_BALANCE")).toBe(false);
  });
});

describe("computeUtilisation", () => {
  const facilities = [
    { id: "f1", name: "Turf 1", openHour: 6, closeHour: 22 }, // 16h/day
    { id: "f2", name: "Court", openHour: 8, closeHour: 10 }, // 2h/day
  ];
  const b = (facilityId: string, hours: number, status: string, source = "COUNTER", amount = 1000, advancePaid = 0) => ({
    facilityId,
    startTime: now,
    endTime: new Date(now.getTime() + hours * 3600_000),
    status,
    source,
    amount,
    advancePaid,
  });

  it("counts delivered bookings, subtracts blocks from capacity and ignores holds", () => {
    const { rows, total } = computeUtilisation(
      facilities,
      [
        b("f1", 2, "CONFIRMED", "ONLINE", 2000, 500),
        b("f1", 1, "COMPLETED", "COUNTER", 1000, 1000),
        b("f1", 1, "NO_SHOW", "LEASE", 1000, 0),
        b("f1", 4, "CONFIRMED", "BLOCK", 0, 0),
        b("f1", 3, "CANCELLED"),
        b("f1", 1, "HOLD", "ONLINE"),
        b("f1", 1, "EXPIRED", "ONLINE"),
        b("f1", 2, "CANCELLED", "BLOCK"),
        b("zz", 5, "CONFIRMED"),
      ],
      2
    );
    const f1 = rows[0];
    expect(f1).toMatchObject({ capacityHours: 32, blockedHours: 4, bookedHours: 4, bookings: 3, bookedValue: 4000, recorded: 1500, cancellations: 1, noShows: 1, online: 1, counter: 2 });
    expect(f1.utilisation).toBeCloseTo(4 / 28);
    expect(rows[1]).toMatchObject({ capacityHours: 4, bookedHours: 0, utilisation: 0 });
    expect(total).toMatchObject({ capacityHours: 36, blockedHours: 4, bookedHours: 4, bookings: 3 });
    expect(total.utilisation).toBeCloseTo(4 / 32);
  });

  it("utilisation is null when nothing was available", () => {
    const { rows } = computeUtilisation([facilities[1]], [b("f2", 2, "CONFIRMED", "BLOCK")], 1);
    expect(rows[0].utilisation).toBeNull();
  });
});
