import { describe, it, expect } from "vitest";
import {
  attributedBatchId,
  bookingHours,
  computeBusinessReport,
  daysInMonth,
  isReportMonth,
  monthBounds,
  pct,
  type ReportInput,
} from "@/lib/business-report";

const input: ReportInput = {
  month: "2026-10",
  daysInMonth: 31,
  fees: [
    { amount: 2000, status: "PAID", batchId: "a" },
    { amount: 2000, status: "PENDING", batchId: "a" },
    { amount: 1500.5, status: "PENDING_VERIFICATION", batchId: "b" },
    { amount: 1000, status: "PAID", batchId: null },
  ],
  outstandingAll: { amount: 9000, count: 6 },
  batches: [
    { id: "a", name: "U-12", capacity: 20, enrolled: 15 },
    { id: "b", name: "Swim", capacity: null, enrolled: 8 },
  ],
  sessions: [
    { batchId: "a", status: "COMPLETED", marked: 10, present: 8 },
    { batchId: "a", status: "CANCELLED", marked: 0, present: 0 },
    { batchId: "b", status: "SCHEDULED", marked: 5, present: 5 },
  ],
  students: { active: 23, newInMonth: 3 },
  trials: [{ status: "ENROLLED" }, { status: "NO_SHOW" }, { status: "SCHEDULED" }, { status: "ENROLLED" }],
  facilities: [{ id: "f1", name: "Turf 1", openHour: 6, closeHour: 22 }],
  bookings: [
    { facilityId: "f1", hours: 2, status: "COMPLETED", advancePaid: 1600, isAllocation: false },
    { facilityId: "f1", hours: 1, status: "CANCELLED", advancePaid: 800, isAllocation: false },
    { facilityId: "f1", hours: 2, status: "CONFIRMED", advancePaid: 0, isAllocation: true },
  ],
};

describe("computeBusinessReport", () => {
  const r = computeBusinessReport(input);

  it("sums money from real fee rows only", () => {
    expect(r.money.billed).toBe(6500.5);
    expect(r.money.collected).toBe(3000);
    expect(r.money.outstandingMonth).toBe(3500.5);
    expect(r.money.outstandingAll).toBe(9000);
    expect(r.money.collectionRate).toBeCloseTo(3000 / 6500.5);
  });

  it("computes attendance over non-cancelled sessions", () => {
    expect(r.attendance).toEqual({ present: 13, marked: 15, rate: 13 / 15, sessions: 2, cancelled: 1 });
  });

  it("computes trial conversion", () => {
    expect(r.trials).toEqual({ booked: 4, enrolled: 2, conversionRate: 0.5 });
  });

  it("builds per-batch rows and capacity utilisation only from batches with capacity", () => {
    const a = r.batches.rows.find((b) => b.id === "a")!;
    expect(a).toMatchObject({ utilisation: 0.75, sessions: 1, cancelled: 1, attendanceRate: 0.8, billed: 4000, collected: 2000, outstanding: 2000 });
    const b = r.batches.rows.find((x) => x.id === "b")!;
    expect(b.utilisation).toBeNull();
    expect(r.batches.utilisation).toBe(15 / 20);
  });

  it("computes court utilisation and revenue from counted bookings", () => {
    const f = r.facilities.rows[0];
    expect(f.openHours).toBe(16 * 31);
    expect(f.bookedHours).toBe(4);
    expect(f.allocationHours).toBe(2);
    expect(f.revenue).toBe(1600);
    expect(r.facilities.utilisation).toBeCloseTo(4 / 496);
  });

  it("returns null rates instead of guesses when there is no data", () => {
    const empty = computeBusinessReport({ ...input, fees: [], sessions: [], trials: [], batches: [], facilities: [], bookings: [] });
    expect(empty.money.collectionRate).toBeNull();
    expect(empty.attendance.rate).toBeNull();
    expect(empty.trials.conversionRate).toBeNull();
    expect(empty.batches.utilisation).toBeNull();
    expect(empty.facilities.utilisation).toBeNull();
    expect(pct(null)).toBe("—");
  });
});

describe("helpers", () => {
  it("validates report months", () => {
    expect(isReportMonth("2026-10", "2026-10")).toBe(true);
    expect(isReportMonth("2026-11", "2026-10")).toBe(false);
    expect(isReportMonth("2026-13", "2026-12")).toBe(false);
    expect(isReportMonth(202610, "2026-10")).toBe(false);
  });
  it("knows month lengths and bounds", () => {
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
    const b = monthBounds("2026-12");
    expect(b.from.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(b.to.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
  it("attributes a student to the earliest enrolment", () => {
    expect(attributedBatchId([])).toBeNull();
    expect(attributedBatchId([{ batchId: "x", joinedAt: "2026-05-01" }, { batchId: "y", joinedAt: "2026-01-01" }])).toBe("y");
  });
  it("counts booking hours", () => {
    expect(bookingHours(new Date("2026-10-01T10:00:00Z"), new Date("2026-10-01T12:00:00Z"))).toBe(2);
  });
});
