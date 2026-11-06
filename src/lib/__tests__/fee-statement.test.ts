import { describe, it, expect } from "vitest";
import { buildFeeStatement, normaliseStatementRange } from "@/lib/fee-statement";

const records = [
  { id: "aug", month: "2026-08", amount: 2000, status: "PENDING" },
  { id: "sep", month: "2026-09", amount: 2000, status: "PAID", paymentMethod: "OFFLINE_RECORDED", paidOn: "2026-09-05" },
  { id: "oct", month: "2026-10", amount: 2000, status: "PENDING_VERIFICATION" },
  { id: "nov", month: "2026-11", amount: 2000, status: "PAID", paymentMethod: "ONLINE_VERIFIED", paidOn: "2026-11-02" },
  { id: "cov", month: "2026-12", amount: 0, status: "PAID", paymentMethod: "PLAN_COVERED" },
];
const receipts = [
  { receiptNumber: "R-1", token: "t1", feeRecordId: "sep", month: "2026-09", amount: 2000, paymentMode: "CASH", issuedOn: "2026-09-05" },
  { receiptNumber: "R-0", token: "t0", feeRecordId: null, month: "2026-09", amount: 500, paymentMode: "CASH", issuedOn: "2026-09-20" },
];

describe("buildFeeStatement", () => {
  it("dues, payments and receipts in range with balances", () => {
    const s = buildFeeStatement({ from: "2026-09-01", to: "2026-11-30", records, receipts });
    expect(s.openingBalance).toBe(2000); // Aug unpaid
    expect(s.billed).toBe(6000); // Sep, Oct, Nov
    expect(s.paid).toBe(4000); // Sep + Nov
    expect(s.closingBalance).toBe(4000); // Aug + Oct (awaiting confirmation still owed)
    expect(s.lines.map((l) => `${l.kind}:${l.date}`)).toEqual([
      "DUE:2026-09-01",
      "PAYMENT:2026-09-05",
      "RECEIPT:2026-09-20",
      "DUE:2026-10-01",
      "DUE:2026-11-01",
      "PAYMENT:2026-11-02",
    ]);
    const sepPay = s.lines.find((l) => l.kind === "PAYMENT" && l.month === "2026-09");
    expect(sepPay && sepPay.kind === "PAYMENT" && sepPay.receipt).toEqual({ number: "R-1", token: "t1" });
  });

  it("plan-covered ₹0 months are not dues", () => {
    const s = buildFeeStatement({ from: "2026-12-01", to: "2026-12-31", records, receipts: [] });
    expect(s.lines).toEqual([]);
    expect(s.billed).toBe(0);
  });

  it("a payment made in range for an older due is counted", () => {
    const s = buildFeeStatement({ from: "2026-11-01", to: "2026-11-30", records, receipts: [] });
    expect(s.paid).toBe(2000);
    expect(s.openingBalance).toBe(4000); // Aug + Oct
  });
});

describe("normaliseStatementRange", () => {
  it("defaults to this calendar year to today", () => {
    expect(normaliseStatementRange(undefined, undefined, "2026-11-06")).toEqual({ from: "2026-01-01", to: "2026-11-06" });
  });
  it("swaps reversed dates and ignores junk", () => {
    expect(normaliseStatementRange("2026-10-01", "2026-09-01", "2026-11-06")).toEqual({ from: "2026-09-01", to: "2026-10-01" });
    expect(normaliseStatementRange("x", "2026-02-30x", "2026-11-06")).toEqual({ from: "2026-01-01", to: "2026-11-06" });
  });
  it("caps very long ranges", () => {
    expect(normaliseStatementRange("2010-01-01", "2026-11-06", "2026-11-06", 30).from).toBe("2026-10-07");
  });
});
