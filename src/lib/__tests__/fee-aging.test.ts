import { describe, it, expect } from "vitest";
import { AGING_BUCKETS, bucketFor, buildAgingReport, daysOverdue, isOverdueCandidate, localDateString, type AgingFeeInput } from "@/lib/fee-aging";

// IST = UTC+5:30. 2026-11-08 00:00 IST = 2026-11-07T18:30:00Z.
const JUST_BEFORE_MIDNIGHT_IST = new Date("2026-11-07T18:29:59.999Z"); // 7 Nov, 23:59:59.999 IST
const MIDNIGHT_IST = new Date("2026-11-07T18:30:00.000Z"); // 8 Nov, 00:00 IST

const rec = (o: Partial<AgingFeeInput> = {}): AgingFeeInput => ({
  feeRecordId: "f1",
  studentId: "s1",
  studentName: "Aarav",
  familyId: "p1",
  familyName: "Mehta",
  familyPhone: "9876543210",
  amount: 2000,
  month: "2026-11",
  status: "PENDING",
  ...o,
});

describe("localDateString / daysOverdue at the IST midnight boundary", () => {
  it("uses the IST calendar day, not the UTC one", () => {
    expect(localDateString(JUST_BEFORE_MIDNIGHT_IST)).toBe("2026-11-07");
    expect(localDateString(MIDNIGHT_IST)).toBe("2026-11-08");
    // Same instants in UTC are both 7 Nov
    expect(MIDNIGHT_IST.toISOString().slice(0, 10)).toBe("2026-11-07");
  });

  it("day count flips exactly at IST midnight", () => {
    expect(daysOverdue("2026-11", JUST_BEFORE_MIDNIGHT_IST)).toBe(6);
    expect(daysOverdue("2026-11", MIDNIGHT_IST)).toBe(7);
  });

  it("bucket boundary 7 → 8 days flips at IST midnight", () => {
    const before = new Date("2026-11-08T18:29:59Z"); // 8 Nov 23:59:59 IST → 7 days
    const after = new Date("2026-11-08T18:30:00Z"); // 9 Nov 00:00 IST → 8 days
    expect(bucketFor(daysOverdue("2026-11", before)!)).toBe("d0_7");
    expect(bucketFor(daysOverdue("2026-11", after)!)).toBe("d8_15");
  });

  it("1st of the month at 00:00 IST is day 0 (due today), the instant before is a future fee", () => {
    const due = new Date("2026-10-31T18:30:00Z"); // 1 Nov 00:00 IST
    const before = new Date("2026-10-31T18:29:59Z");
    expect(daysOverdue("2026-11", due)).toBe(0);
    expect(daysOverdue("2026-11", before)).toBe(-1);
  });

  it("rejects a bad month and falls back to IST on a bad timezone", () => {
    expect(daysOverdue("2026-13", MIDNIGHT_IST)).toBeNull();
    expect(daysOverdue("Nov", MIDNIGHT_IST)).toBeNull();
    expect(localDateString(MIDNIGHT_IST, "Not/AZone")).toBe("2026-11-08");
  });

  it("crosses month and year ends", () => {
    expect(daysOverdue("2025-12", new Date("2026-01-01T00:00:00Z"))).toBe(31);
  });
});

describe("bucketFor", () => {
  it.each([
    [0, "d0_7"], [7, "d0_7"], [8, "d8_15"], [15, "d8_15"], [16, "d16_30"], [30, "d16_30"], [31, "d30_plus"], [400, "d30_plus"],
  ])("%i days → %s", (d, k) => expect(bucketFor(d)).toBe(k));
  it("future and invalid are not overdue", () => {
    expect(bucketFor(-1)).toBeNull();
    expect(bucketFor(Number.NaN)).toBeNull();
  });
  it("buckets are contiguous", () => {
    for (let i = 1; i < AGING_BUCKETS.length; i++) expect(AGING_BUCKETS[i].min).toBe((AGING_BUCKETS[i - 1].max as number) + 1);
  });
});

describe("buildAgingReport", () => {
  const now = new Date("2026-11-20T06:00:00Z"); // 20 Nov IST

  it("totals per bucket and families sorted by amount owed", () => {
    const r = buildAgingReport(
      [
        rec({ feeRecordId: "a", familyId: "p1", familyName: "Mehta", amount: 1500, month: "2026-11" }), // 19d → 16–30
        rec({ feeRecordId: "b", familyId: "p2", familyName: "Shah", amount: 3000, month: "2026-11", studentId: "s2", studentName: "Kabir" }),
        rec({ feeRecordId: "c", familyId: "p1", familyName: "Mehta", amount: 1500, month: "2026-11", studentId: "s3", studentName: "Ira" }),
        rec({ feeRecordId: "d", familyId: "p3", familyName: "Rao", amount: 2500, month: "2026-09" }), // 80d → 30+
        rec({ feeRecordId: "e", familyId: "p4", amount: 999, month: "2026-12" }), // future → left out
      ],
      now,
    );
    expect(r.today).toBe("2026-11-20");
    const b16 = r.buckets.find((b) => b.key === "d16_30")!;
    expect(b16.total).toBe(6000);
    expect(b16.recordCount).toBe(3);
    // Shah 3000 and Mehta 3000 tie on amount and days → name order
    expect(b16.families.map((f) => f.familyName)).toEqual(["Mehta", "Shah"]);
    expect(b16.families[0].lines).toHaveLength(2);
    expect(r.buckets.find((b) => b.key === "d30_plus")!.total).toBe(2500);
    expect(r.total).toBe(8500);
    expect(r.buckets).toHaveLength(4);
  });

  it("largest family first", () => {
    const r = buildAgingReport(
      [rec({ feeRecordId: "x", familyId: "small", amount: 500 }), rec({ feeRecordId: "y", familyId: "big", amount: 5000 })],
      now,
    );
    expect(r.buckets.find((b) => b.key === "d16_30")!.families.map((f) => f.familyId)).toEqual(["big", "small"]);
  });

  it("leaves out paid, parent-reported and zero records", () => {
    expect(isOverdueCandidate("PAID")).toBe(false);
    expect(isOverdueCandidate("PENDING_VERIFICATION")).toBe(false);
    const r = buildAgingReport(
      [rec({ status: "PAID" }), rec({ status: "PENDING_VERIFICATION" }), rec({ amount: 0 }), rec({ month: "bad" })],
      now,
    );
    expect(r.total).toBe(0);
    expect(r.buckets.every((b) => b.families.length === 0)).toBe(true);
  });
});
