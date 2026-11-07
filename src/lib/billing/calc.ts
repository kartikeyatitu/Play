// TRIQ's own subscription bill per academy. Pure and client-safe. All money in integer minor units
// (paise for INR, cents for USD). Prices come from src/lib/pricing.ts only.

import {
  ANNUAL_FREE_MONTHS,
  FOUNDING_OFFER,
  FREE_PLAN,
  GST_RATE,
  growthMonthlyPrice,
  internationalMonthlyPrice,
} from "@/lib/pricing";
import { GST_STATE_CODES } from "@/lib/gst";

/**
 * TRIQ's GST registration state (place of supplier). CONFIRM with the founder / CA before any invoice
 * is issued: it decides CGST+SGST (same state) vs IGST (other state).
 */
export const TRIQ_GST_STATE_CODE = "09"; // Uttar Pradesh — CONFIRM

/** SAC for SaaS (pricing.ts comment). */
export const TRIQ_SAC = "9983";

export type BillingCycle = "MONTHLY" | "ANNUAL";
export type TaxKind = "CGST_SGST" | "IGST" | "NONE";

export interface TriqBillInput {
  activeStudents: number;
  /** ISO 3166-1 alpha-2; anything other than "IN" is billed in USD with no Indian GST. */
  country?: string | null;
  /** Organization.state: a state name ("Haryana") or 2-digit GST code ("06"). */
  orgState?: string | null;
  /** Founding-academy discount applies (monthly). */
  founding?: boolean;
  /** For ANNUAL: how many of the 12 months still carry the founding discount (0–12). */
  foundingMonthsRemaining?: number;
  cycle?: BillingCycle;
}

export interface TriqBill {
  currency: "INR" | "USD";
  cycle: BillingCycle;
  activeStudents: number;
  /** False at or below the Free tier (≤ 30 students): nothing to bill. */
  billable: boolean;
  /** Months covered and months charged (annual: 12 covered, 10 charged). */
  monthsCovered: number;
  monthsCharged: number;
  /** One month's price before any discount (after the minimum). */
  monthlyMinor: number;
  grossMinor: number;
  discountMinor: number;
  /** Taxable value (= SubscriptionInvoice.amountPaise). */
  taxableMinor: number;
  taxKind: TaxKind;
  cgstMinor: number;
  sgstMinor: number;
  igstMinor: number;
  /** = SubscriptionInvoice.gstPaise. */
  taxMinor: number;
  totalMinor: number;
  /** Org state resolved to a GST code (null if unknown → IGST assumed). */
  orgStateCode: string | null;
}

const NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(GST_STATE_CODES).map(([code, name]) => [name.toLowerCase(), code]),
);
const ALIASES: Record<string, string> = {
  "new delhi": "07",
  "delhi ncr": "07",
  "nct of delhi": "07",
  up: "09",
  "j&k": "01",
  "jammu & kashmir": "01",
  "andhra pradesh": "37",
  orissa: "21",
  pondicherry: "34",
};

/** "Haryana" / "haryana" / "06" -> "06"; unknown -> null. */
export function stateCodeOf(state: string | null | undefined): string | null {
  const s = String(state ?? "").trim().toLowerCase();
  if (!s) return null;
  if (/^\d{2}$/.test(s)) return GST_STATE_CODES[s] ? s : null;
  return ALIASES[s] ?? NAME_TO_CODE[s] ?? null;
}

const GST_BPS = Math.round(GST_RATE * 10_000); // 1800
const pct = (minor: number, bps: number) => Math.round((minor * bps) / 10_000);

export function calculateTriqBill(input: TriqBillInput): TriqBill {
  const n = Math.max(0, Math.floor(Number(input.activeStudents) || 0));
  const cycle: BillingCycle = input.cycle === "ANNUAL" ? "ANNUAL" : "MONTHLY";
  const international = !!input.country && input.country.toUpperCase() !== "IN";
  const currency = international ? "USD" : "INR";
  const monthsCovered = cycle === "ANNUAL" ? 12 : 1;
  const monthsCharged = cycle === "ANNUAL" ? 12 - ANNUAL_FREE_MONTHS : 1;
  const orgStateCode = stateCodeOf(input.orgState);

  const monthlyMinor = (international ? internationalMonthlyPrice(n) : growthMonthlyPrice(n)) * 100;
  const billable = n > FREE_PLAN.maxStudents && monthlyMinor > 0;
  const grossMinor = billable ? monthlyMinor * monthsCharged : 0;

  // Founding offer: 50% off for 12 months. Annual: the share of the 12 months still discounted.
  let discountMinor = 0;
  if (billable && input.founding) {
    const share =
      cycle === "ANNUAL" ? Math.min(12, Math.max(0, Math.floor(input.foundingMonthsRemaining ?? FOUNDING_OFFER.months))) / 12 : 1;
    discountMinor = Math.round(grossMinor * share * (FOUNDING_OFFER.discountPercent / 100));
  }
  const taxableMinor = grossMinor - discountMinor;

  let taxKind: TaxKind = "NONE";
  let cgstMinor = 0;
  let sgstMinor = 0;
  let igstMinor = 0;
  if (!international && taxableMinor > 0) {
    if (orgStateCode && orgStateCode === TRIQ_GST_STATE_CODE) {
      taxKind = "CGST_SGST";
      cgstMinor = pct(taxableMinor, GST_BPS / 2);
      sgstMinor = cgstMinor; // always equal halves
    } else {
      taxKind = "IGST";
      igstMinor = pct(taxableMinor, GST_BPS);
    }
  }
  const taxMinor = cgstMinor + sgstMinor + igstMinor;

  return {
    currency,
    cycle,
    activeStudents: n,
    billable,
    monthsCovered,
    monthsCharged,
    monthlyMinor: billable ? monthlyMinor : 0,
    grossMinor,
    discountMinor,
    taxableMinor,
    taxKind,
    cgstMinor,
    sgstMinor,
    igstMinor,
    taxMinor,
    totalMinor: taxableMinor + taxMinor,
    orgStateCode,
  };
}

/** Split a stored invoice's gstPaise back into CGST/SGST or IGST for display. */
export function taxBreakup(taxableMinor: number, gstMinor: number, currency: string, orgState: string | null | undefined) {
  if (currency !== "INR" || gstMinor <= 0) return { kind: "NONE" as TaxKind, cgst: 0, sgst: 0, igst: 0 };
  const code = stateCodeOf(orgState);
  if (code && code === TRIQ_GST_STATE_CODE) {
    const half = Math.floor(gstMinor / 2);
    return { kind: "CGST_SGST" as TaxKind, cgst: half, sgst: gstMinor - half, igst: 0 };
  }
  return { kind: "IGST" as TaxKind, cgst: 0, sgst: 0, igst: gstMinor };
}

/** "₹4,650.00" / "US$49.00" from minor units. */
export function formatMinor(minor: number, currency: string): string {
  const v = (Math.round(minor) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === "USD" ? `US$${v}` : `₹${v}`;
}
