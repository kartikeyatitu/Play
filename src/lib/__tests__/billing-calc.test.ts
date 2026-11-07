import { describe, expect, it } from "vitest";
import { TRIQ_GST_STATE_CODE, calculateTriqBill, stateCodeOf, taxBreakup } from "@/lib/billing/calc";
import { GST_STATE_CODES } from "@/lib/gst";

const SAME_STATE = GST_STATE_CODES[TRIQ_GST_STATE_CODE];
const OTHER_STATE = (TRIQ_GST_STATE_CODE as string) === "06" ? "Delhi" : "Haryana";

describe("calculateTriqBill (India, monthly, no offer)", () => {
  const cases: [number, number][] = [
    [0, 0],
    [30, 0],
    [31, 465_000], // 31 × ₹150
    [35, 525_000],
    [100, 1_500_000],
    [500, 7_500_000],
  ];
  for (const [students, taxable] of cases) {
    it(`${students} students -> taxable ${taxable} paise, 18% GST`, () => {
      const b = calculateTriqBill({ activeStudents: students, country: "IN", orgState: OTHER_STATE });
      expect(b.currency).toBe("INR");
      expect(b.taxableMinor).toBe(taxable);
      expect(b.taxMinor).toBe(Math.round(taxable * 0.18));
      expect(b.totalMinor).toBe(b.taxableMinor + b.taxMinor);
      expect(b.billable).toBe(students > 30);
      expect(Number.isInteger(b.taxableMinor) && Number.isInteger(b.taxMinor)).toBe(true);
    });
  }

  it("free tier has no tax lines", () => {
    const b = calculateTriqBill({ activeStudents: 30, orgState: SAME_STATE });
    expect(b.taxKind).toBe("NONE");
    expect(b.totalMinor).toBe(0);
  });
});

describe("GST split", () => {
  it("same state -> CGST + SGST equal halves", () => {
    const b = calculateTriqBill({ activeStudents: 35, orgState: SAME_STATE });
    expect(b.taxKind).toBe("CGST_SGST");
    expect(b.cgstMinor).toBe(47_250);
    expect(b.sgstMinor).toBe(47_250);
    expect(b.igstMinor).toBe(0);
    expect(b.taxMinor).toBe(94_500);
  });
  it("other state -> IGST", () => {
    const b = calculateTriqBill({ activeStudents: 35, orgState: OTHER_STATE });
    expect(b.taxKind).toBe("IGST");
    expect(b.igstMinor).toBe(94_500);
    expect(b.cgstMinor + b.sgstMinor).toBe(0);
  });
  it("accepts state names, codes and aliases", () => {
    expect(stateCodeOf("haryana")).toBe("06");
    expect(stateCodeOf("06")).toBe("06");
    expect(stateCodeOf("New Delhi")).toBe("07");
    expect(stateCodeOf("Atlantis")).toBeNull();
  });
  it("unknown state -> IGST", () => {
    expect(calculateTriqBill({ activeStudents: 100, orgState: null }).taxKind).toBe("IGST");
  });
  it("taxBreakup splits stored gst for display", () => {
    expect(taxBreakup(525_000, 94_500, "INR", SAME_STATE)).toEqual({ kind: "CGST_SGST", cgst: 47_250, sgst: 47_250, igst: 0 });
    expect(taxBreakup(525_000, 94_500, "INR", OTHER_STATE).igst).toBe(94_500);
    expect(taxBreakup(4_900, 0, "USD", null).kind).toBe("NONE");
  });
});

describe("founding offer", () => {
  it("halves the monthly bill", () => {
    const b = calculateTriqBill({ activeStudents: 100, orgState: OTHER_STATE, founding: true });
    expect(b.grossMinor).toBe(1_500_000);
    expect(b.discountMinor).toBe(750_000);
    expect(b.taxableMinor).toBe(750_000);
    expect(b.taxMinor).toBe(135_000);
  });
  it("does nothing on the free tier", () => {
    expect(calculateTriqBill({ activeStudents: 20, founding: true }).discountMinor).toBe(0);
  });
});

describe("annual", () => {
  it("pay 10 months, get 12", () => {
    const b = calculateTriqBill({ activeStudents: 100, orgState: OTHER_STATE, cycle: "ANNUAL" });
    expect(b.monthsCovered).toBe(12);
    expect(b.monthsCharged).toBe(10);
    expect(b.taxableMinor).toBe(15_000_000);
    expect(b.taxMinor).toBe(2_700_000);
  });
  it("founding discount applies to the months left in the offer", () => {
    const b = calculateTriqBill({ activeStudents: 100, cycle: "ANNUAL", founding: true, foundingMonthsRemaining: 6 });
    expect(b.discountMinor).toBe(3_750_000); // 15,000,000 × 6/12 × 50%
  });
});

describe("international", () => {
  it("US$1 per student, min US$49, no Indian GST", () => {
    expect(calculateTriqBill({ activeStudents: 30, country: "US" }).totalMinor).toBe(0);
    const small = calculateTriqBill({ activeStudents: 31, country: "US" });
    expect(small.currency).toBe("USD");
    expect(small.taxableMinor).toBe(4_900);
    expect(small.taxKind).toBe("NONE");
    expect(calculateTriqBill({ activeStudents: 100, country: "AE" }).taxableMinor).toBe(10_000);
    expect(calculateTriqBill({ activeStudents: 500, country: "GB" }).totalMinor).toBe(50_000);
  });
});
