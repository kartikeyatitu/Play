import { describe, expect, it } from "vitest";
import {
  amountInWords,
  computeTax,
  creditNoteBreakup,
  creditNoteSourceKey,
  divRound,
  financialYear,
  formatDocNumber,
  formatMinorINR,
  formatRate,
  gstinCheckChar,
  invoiceSourceKey,
  isGapFree,
  numberToIndianWords,
  parseTaxProfile,
  placeOfSupply,
  toMinor,
  validateGstin,
} from "@/lib/gst";

describe("GSTIN validation", () => {
  it("accepts published sample GSTINs (checksum matches)", () => {
    for (const g of ["27AAPFU0939F1ZV", "29AAGCB7383J1Z4", "33AAACH7409R1Z8", "24AAACC1206D1ZM"]) {
      const r = validateGstin(g);
      expect(r).toMatchObject({ ok: true, gstin: g, stateCode: g.slice(0, 2) });
    }
  });

  it("normalises spaces and lower case", () => {
    expect(validateGstin(" 27aapfu0939f1zv ")).toMatchObject({ ok: true, gstin: "27AAPFU0939F1ZV" });
  });

  it("rejects a wrong check character", () => {
    const r = validateGstin("27AAPFU0939F1ZW");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/check digit/);
  });

  it("rejects bad length, bad shape and unknown state codes", () => {
    expect(validateGstin("27AAPFU0939F1Z").ok).toBe(false);
    expect(validateGstin("27AAPFU0939F1XV").ok).toBe(false); // 14th char must be Z
    expect(validateGstin("2XAAPFU0939F1ZV").ok).toBe(false);
    const body = "99AAPFU0939F1Z";
    expect(validateGstin(body + gstinCheckChar(body)).ok).toBe(false); // 99 is not a state code
  });

  it("check character is computed for every valid body", () => {
    const body = "06ABCDE1234F1Z";
    const full = body + gstinCheckChar(body);
    expect(validateGstin(full).ok).toBe(true);
  });
});

describe("tax profile parsing", () => {
  const base = {
    legalName: "Smash Sports Pvt Ltd",
    gstin: "27AAPFU0939F1ZV",
    address: "Plot 4, Andheri East, Mumbai",
    sacCode: "999291",
    rateBps: 1800,
    priceMode: "INCLUSIVE",
    invoicePrefix: "inv",
    creditNotePrefix: "CN",
  };
  it("derives the state code from the GSTIN and upper-cases prefixes", () => {
    const r = parseTaxProfile(base);
    expect(r).toMatchObject({ ok: true, profile: { stateCode: "27", invoicePrefix: "INV", rateBps: 1800 } });
  });
  it("does not assume a rate: any even bps from 0 to 40% is allowed", () => {
    expect(parseTaxProfile({ ...base, rateBps: 500 }).ok).toBe(true);
    expect(parseTaxProfile({ ...base, rateBps: 0 }).ok).toBe(true);
    expect(parseTaxProfile({ ...base, rateBps: 4002 }).ok).toBe(false);
    expect(parseTaxProfile({ ...base, rateBps: 1801 }).ok).toBe(false);
    expect(parseTaxProfile({ ...base, rateBps: "abc" }).ok).toBe(false);
  });
  it("validates SAC, price mode and prefixes", () => {
    expect(parseTaxProfile({ ...base, sacCode: "99A" }).ok).toBe(false);
    expect(parseTaxProfile({ ...base, priceMode: "SOMETIMES" }).ok).toBe(false);
    expect(parseTaxProfile({ ...base, invoicePrefix: "INVOICE" }).ok).toBe(false);
    expect(parseTaxProfile({ ...base, invoicePrefix: "CN" }).ok).toBe(false);
  });
});

describe("tax math", () => {
  it("divRound rounds halves away from zero", () => {
    expect(divRound(5, 2)).toBe(3);
    expect(divRound(-5, 2)).toBe(-3);
    expect(divRound(4, 3)).toBe(1);
  });

  it("toMinor handles float rupees", () => {
    expect(toMinor(2500)).toBe(250000);
    expect(toMinor(1234.565)).toBe(123457);
  });

  it("place of supply falls back to the supplier state", () => {
    expect(placeOfSupply("27", null)).toBe("27");
    expect(placeOfSupply("27", "29")).toBe("29");
    expect(placeOfSupply("27", "XX")).toBe("27");
  });

  it("inclusive, intra-state: taxable + CGST + SGST equals the gross exactly", () => {
    const t = computeTax({ amountMinor: 250000, rateBps: 1800, priceMode: "INCLUSIVE", supplierState: "06", placeOfSupply: "06" });
    expect(t).toMatchObject({ intraState: true, taxableMinor: 211864, cgstMinor: 19068, sgstMinor: 19068, igstMinor: 0, roundOffMinor: 0, totalMinor: 250000 });
    expect(t.taxableMinor + t.cgstMinor + t.sgstMinor).toBe(250000);
  });

  it("inclusive, inter-state: IGST only", () => {
    const t = computeTax({ amountMinor: 250000, rateBps: 1800, priceMode: "INCLUSIVE", supplierState: "06", placeOfSupply: "07" });
    expect(t).toMatchObject({ intraState: false, cgstMinor: 0, sgstMinor: 0, taxableMinor: 211864, igstMinor: 38136, totalMinor: 250000 });
  });

  it("inclusive totals always reconcile across many amounts and rates", () => {
    for (const rate of [0, 500, 1200, 1800, 2800]) {
      for (let gross = 1; gross < 500000; gross += 997) {
        for (const pos of ["06", "07"]) {
          const t = computeTax({ amountMinor: gross, rateBps: rate, priceMode: "INCLUSIVE", supplierState: "06", placeOfSupply: pos });
          expect(t.taxableMinor + t.taxMinor).toBe(gross);
          expect(t.cgstMinor).toBe(t.sgstMinor);
          expect(t.taxableMinor).toBeGreaterThanOrEqual(0);
          // tax is within one paisa per component of the exact rate
          expect(Math.abs(t.taxMinor - (t.taxableMinor * rate) / 10000)).toBeLessThanOrEqual(1.5);
        }
      }
    }
  });

  it("exclusive, intra-state: tax added on top and total rounded to the rupee", () => {
    const t = computeTax({ amountMinor: 99999, rateBps: 1800, priceMode: "EXCLUSIVE", supplierState: "27", placeOfSupply: "27" });
    // 999.99 * 9% = 89.9991 → 90.00 each
    expect(t).toMatchObject({ taxableMinor: 99999, cgstMinor: 9000, sgstMinor: 9000, igstMinor: 0 });
    expect(t.totalMinor).toBe(118000); // 1179.99 → 1180.00
    expect(t.roundOffMinor).toBe(1);
  });

  it("exclusive, inter-state: IGST and round-off down", () => {
    const t = computeTax({ amountMinor: 100040, rateBps: 1800, priceMode: "EXCLUSIVE", supplierState: "27", placeOfSupply: "29" });
    // 1000.40 * 18% = 180.072 → 180.07; raw 1180.47 → 1180.00
    expect(t).toMatchObject({ igstMinor: 18007, cgstMinor: 0, totalMinor: 118000, roundOffMinor: -47 });
  });

  it("zero rate produces no tax", () => {
    const t = computeTax({ amountMinor: 150000, rateBps: 0, priceMode: "INCLUSIVE", supplierState: "27", placeOfSupply: "27" });
    expect(t).toMatchObject({ taxableMinor: 150000, taxMinor: 0, totalMinor: 150000 });
  });

  it("rejects non-integer amounts", () => {
    expect(() => computeTax({ amountMinor: 10.5, rateBps: 1800, priceMode: "INCLUSIVE", supplierState: "27", placeOfSupply: "27" })).toThrow();
  });

  it("credit note negates every component", () => {
    const t = computeTax({ amountMinor: 99999, rateBps: 1800, priceMode: "EXCLUSIVE", supplierState: "27", placeOfSupply: "27" });
    const cn = creditNoteBreakup(t);
    expect(cn).toMatchObject({ taxableMinor: -99999, cgstMinor: -9000, sgstMinor: -9000, igstMinor: 0, roundOffMinor: -1, totalMinor: -118000, intraState: true });
  });

  it("formats rates", () => {
    expect(formatRate(1800)).toBe("18%");
    expect(formatRate(250)).toBe("2.5%");
  });
});

describe("financial year numbering", () => {
  it("April–March boundaries", () => {
    expect(financialYear("2027-03-31")).toEqual({ startYear: 2026, label: "2026-27", short: "26-27" });
    expect(financialYear("2027-04-01")).toEqual({ startYear: 2027, label: "2027-28", short: "27-28" });
    expect(financialYear("2099-12-31").short).toBe("99-00");
  });

  it("formats numbers within the 16-character limit", () => {
    expect(formatDocNumber("INV", "26-27", 42)).toBe("INV/26-27/00042");
    expect(formatDocNumber("ABCD", "26-27", 99999)).toHaveLength(16);
    expect(() => formatDocNumber("ABCD", "26-27", 100000)).toThrow();
    expect(() => formatDocNumber("INV", "26-27", 0)).toThrow();
  });

  it("source keys separate re-payments after a reversal", () => {
    expect(invoiceSourceKey("f1", new Date(1000))).not.toBe(invoiceSourceKey("f1", new Date(2000)));
    expect(creditNoteSourceKey("i1")).toBe("cn:i1");
  });

  it("gap detection", () => {
    expect(isGapFree([3, 1, 2])).toBe(true);
    expect(isGapFree([1, 3])).toBe(false);
    expect(isGapFree([])).toBe(true);
  });
});

describe("amount in words", () => {
  it("uses lakh and crore grouping", () => {
    expect(numberToIndianWords(0)).toBe("Zero");
    expect(numberToIndianWords(105)).toBe("One Hundred Five");
    expect(numberToIndianWords(1234567)).toBe("Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven");
    expect(numberToIndianWords(250000000)).toBe("Twenty Five Crore");
  });
  it("adds paise and handles credit notes", () => {
    expect(amountInWords(250000)).toBe("Rupees Two Thousand Five Hundred Only");
    expect(amountInWords(118050)).toBe("Rupees One Thousand One Hundred Eighty and Fifty Paise Only");
    expect(amountInWords(-118000)).toBe("Minus Rupees One Thousand One Hundred Eighty Only");
  });
  it("formats paise as INR", () => {
    expect(formatMinorINR(123456789)).toBe("₹12,34,567.89");
    expect(formatMinorINR(-5)).toBe("-₹0.05");
  });
});
