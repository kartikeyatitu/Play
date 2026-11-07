import { describe, expect, it } from "vitest";
import { financialYearLabel, formatInvoiceNumber, istMonthOf, istPeriod, nextInvoiceNumber, previousIstMonth } from "@/lib/billing/periods";

describe("IST periods", () => {
  it("month boundaries are IST midnight", () => {
    const { periodStart, periodEnd } = istPeriod("2026-11");
    expect(periodStart.toISOString()).toBe("2026-10-31T18:30:00.000Z");
    expect(periodEnd.toISOString()).toBe("2026-11-30T18:29:59.999Z");
  });
  it("annual period spans 12 months", () => {
    const { periodEnd } = istPeriod("2026-04", 12);
    expect(periodEnd.toISOString()).toBe("2027-03-31T18:29:59.999Z");
  });
  it("uses IST to pick the month", () => {
    expect(istMonthOf(new Date("2026-11-30T19:00:00Z"))).toBe("2026-12");
    expect(previousIstMonth(new Date("2026-12-01T02:00:00Z"))).toBe("2026-11");
    expect(previousIstMonth(new Date("2027-01-01T02:00:00Z"))).toBe("2026-12");
  });
  it("rejects bad months", () => {
    expect(() => istPeriod("2026-13")).toThrow();
    expect(() => istPeriod("nov")).toThrow();
  });
});

describe("financial year and invoice numbers", () => {
  it("April–March in IST", () => {
    expect(financialYearLabel(new Date("2026-11-07T10:00:00Z"))).toBe("FY26-27");
    expect(financialYearLabel(new Date("2027-03-31T18:00:00Z"))).toBe("FY26-27");
    expect(financialYearLabel(new Date("2027-03-31T18:30:00Z"))).toBe("FY27-28"); // 1 Apr 00:00 IST
  });
  it("sequential per FY", () => {
    expect(formatInvoiceNumber("FY26-27", 1)).toBe("TRIQ/2627/0001");
    expect(formatInvoiceNumber("FY26-27", 9999).length).toBeLessThanOrEqual(16);
    expect(nextInvoiceNumber("FY26-27", [])).toBe("TRIQ/2627/0001");
    expect(nextInvoiceNumber("FY26-27", ["TRIQ/2627/0001", "TRIQ/2627/0007", "TRIQ/2526/0042"])).toBe("TRIQ/2627/0008");
    expect(nextInvoiceNumber("FY27-28", ["TRIQ/2627/0099"])).toBe("TRIQ/2728/0001");
  });
});
