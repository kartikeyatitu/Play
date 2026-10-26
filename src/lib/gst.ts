/**
 * V1 Business — GST tax invoices (flag `gstInvoices`). Pure, client-safe, no DB.
 *
 * Money is handled in integer minor units (paise) throughout. Rates are integer basis points
 * (1800 = 18%) and are configured per academy — nothing here assumes a particular rate or SAC code.
 *
 * Rules implemented (see docs/specs/01-triq-business.md §GST):
 *  - GSTIN: 15 chars = 2-digit state code + PAN (10) + entity number + "Z" + check character (mod-36 checksum).
 *  - Place of supply: the recipient's state when known, else the supplier's state. Same state → CGST + SGST
 *    (half the rate each); different state → IGST (full rate).
 *  - Tax-exclusive: tax is added on top of the taxable value; the invoice total is rounded to the nearest rupee and
 *    the difference shown as "Round off".
 *  - Tax-inclusive: the amount received is the gross; the taxable value is backed out so taxable + tax == gross to
 *    the paisa. No round-off line (the gross is what was actually paid).
 *  - CGST and SGST are always equal (each is computed as one half-rate amount).
 *  - Invoice numbers: "<PREFIX>/<YY-YY>/<NNNNN>", at most 16 characters, only A–Z 0–9 "/" "-" (GST rule 46),
 *    one sequential series per academy, document kind and financial year (April–March).
 */

export const GST_INVOICES_DISABLED_ERROR = "GST invoices are not enabled for this academy yet.";

export const PRICE_MODES = ["INCLUSIVE", "EXCLUSIVE"] as const;
export type PriceMode = (typeof PRICE_MODES)[number];

export const TAX_DOC_KINDS = ["INVOICE", "CREDIT_NOTE"] as const;
export type TaxDocKind = (typeof TAX_DOC_KINDS)[number];

/** Highest rate accepted (40%, the top slab after the 2025 rate rationalisation). */
export const MAX_RATE_BPS = 4000;
export const MAX_DOC_NUMBER_LENGTH = 16;

/** SAC codes academies commonly use; shown as hints only, never applied automatically. */
export const SAC_HINTS: { code: string; label: string }[] = [
  { code: "999291", label: "Commercial training and coaching services" },
  { code: "999723", label: "Physical well-being services (fitness / health club)" },
];

/** GST state / UT codes (first two digits of a GSTIN). */
export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
  "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya",
  "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "25": "Daman and Diu", "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra",
  "28": "Andhra Pradesh (old)", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
  "34": "Puducherry", "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
  "97": "Other Territory",
};

// ─── GSTIN ──────────────────────────────────────────────────────────────────

const GSTIN_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GSTIN_SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function normalizeGstin(raw: unknown): string {
  return String(raw ?? "").replace(/\s+/g, "").toUpperCase();
}

/** Check character for the first 14 characters of a GSTIN (mod-36, alternating weights 1 and 2). */
export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = GSTIN_CHARSET.indexOf(first14[i]);
    if (v < 0) return "";
    const product = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARSET[(36 - (sum % 36)) % 36];
}

export type GstinCheck = { ok: true; gstin: string; stateCode: string } | { ok: false; error: string };

export function validateGstin(raw: unknown): GstinCheck {
  const g = normalizeGstin(raw);
  if (g.length !== 15) return { ok: false, error: "GSTIN must be 15 characters." };
  if (!GSTIN_SHAPE.test(g)) return { ok: false, error: "GSTIN format looks wrong (e.g. 27AAPFU0939F1ZV)." };
  const state = g.slice(0, 2);
  if (!GST_STATE_CODES[state]) return { ok: false, error: `Unknown state code ${state} in GSTIN.` };
  if (gstinCheckChar(g.slice(0, 14)) !== g[14]) return { ok: false, error: "GSTIN check digit doesn't match — please re-check it." };
  return { ok: true, gstin: g, stateCode: state };
}

export function isValidStateCode(code: unknown): code is string {
  return typeof code === "string" && Object.prototype.hasOwnProperty.call(GST_STATE_CODES, code);
}

// ─── Tax profile input ─────────────────────────────────────────────────────

export type TaxProfileInput = {
  legalName: string;
  gstin: string;
  address: string;
  sacCode: string;
  rateBps: number;
  priceMode: PriceMode;
  invoicePrefix: string;
  creditNotePrefix: string;
};

export type TaxProfile = TaxProfileInput & { stateCode: string };

const PREFIX_RE = /^[A-Z0-9-]{1,4}$/;

/** Validate and normalise the academy's tax profile. The state code always comes from the GSTIN. */
export function parseTaxProfile(raw: Record<string, unknown>): { ok: true; profile: TaxProfile } | { ok: false; error: string } {
  const legalName = String(raw.legalName ?? "").trim();
  if (legalName.length < 2 || legalName.length > 160) return { ok: false, error: "Enter the legal name as registered for GST." };
  const g = validateGstin(raw.gstin);
  if (!g.ok) return g;
  const address = String(raw.address ?? "").trim();
  if (address.length < 5 || address.length > 400) return { ok: false, error: "Enter the registered business address." };
  const sacCode = String(raw.sacCode ?? "").replace(/\s+/g, "");
  if (!/^\d{4,8}$/.test(sacCode)) return { ok: false, error: "SAC/HSN code should be 4–8 digits (e.g. 999291)." };
  const rateBps = Number(raw.rateBps);
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > MAX_RATE_BPS || rateBps % 2 !== 0) {
    return { ok: false, error: "Enter a valid GST rate (for example 18)." };
  }
  const priceMode = String(raw.priceMode ?? "") as PriceMode;
  if (!PRICE_MODES.includes(priceMode)) return { ok: false, error: "Choose whether your fees include GST." };
  const invoicePrefix = String(raw.invoicePrefix ?? "INV").trim().toUpperCase() || "INV";
  const creditNotePrefix = String(raw.creditNotePrefix ?? "CN").trim().toUpperCase() || "CN";
  if (!PREFIX_RE.test(invoicePrefix) || !PREFIX_RE.test(creditNotePrefix)) {
    return { ok: false, error: "Number prefixes can use up to 4 letters, digits or '-'." };
  }
  if (invoicePrefix === creditNotePrefix) return { ok: false, error: "Invoice and credit note prefixes must differ." };
  return {
    ok: true,
    profile: { legalName, gstin: g.gstin, stateCode: g.stateCode, address, sacCode, rateBps, priceMode, invoicePrefix, creditNotePrefix },
  };
}

/** "18%" / "2.5%" from basis points. */
export function formatRate(bps: number): string {
  return `${Number((bps / 100).toFixed(2))}%`;
}

// ─── Tax math ───────────────────────────────────────────────────────────────

/** round(num / den) with halves rounded away from zero; integers only, den > 0. */
export function divRound(num: number, den: number): number {
  const sign = num < 0 ? -1 : 1;
  const n = Math.abs(num);
  return sign * Math.floor((2 * n + den) / (2 * den));
}

/** Rupee amount (may carry paise as a float, as FeeRecord.amount does) → integer paise. */
export function toMinor(amount: number): number {
  return Math.round(Number(amount) * 100);
}

export function placeOfSupply(supplierState: string, recipientState?: string | null): string {
  return recipientState && isValidStateCode(recipientState) ? recipientState : supplierState;
}

export type TaxBreakup = {
  intraState: boolean;
  taxableMinor: number;
  cgstMinor: number;
  sgstMinor: number;
  igstMinor: number;
  taxMinor: number;
  roundOffMinor: number;
  /** Invoice total after round-off. */
  totalMinor: number;
};

/**
 * Split an amount into taxable value and GST.
 * @param amountMinor  EXCLUSIVE: the taxable value. INCLUSIVE: the gross amount received.
 */
export function computeTax(a: {
  amountMinor: number;
  rateBps: number;
  priceMode: PriceMode;
  supplierState: string;
  placeOfSupply: string;
}): TaxBreakup {
  if (!Number.isInteger(a.amountMinor) || a.amountMinor < 0) throw new Error("amountMinor must be a non-negative integer");
  if (!Number.isInteger(a.rateBps) || a.rateBps < 0 || a.rateBps > MAX_RATE_BPS) throw new Error("invalid rate");
  const intraState = a.supplierState === a.placeOfSupply;
  const rate = a.rateBps;
  let taxableMinor: number;
  let half = 0;
  let igst = 0;

  if (a.priceMode === "EXCLUSIVE") {
    taxableMinor = a.amountMinor;
    if (intraState) half = divRound(taxableMinor * rate, 20000);
    else igst = divRound(taxableMinor * rate, 10000);
    const raw = taxableMinor + 2 * half + igst;
    const rounded = divRound(raw, 100) * 100;
    return {
      intraState,
      taxableMinor,
      cgstMinor: half,
      sgstMinor: half,
      igstMinor: igst,
      taxMinor: 2 * half + igst,
      roundOffMinor: rounded - raw,
      totalMinor: rounded,
    };
  }

  // INCLUSIVE: back the taxable value out of the gross, then make tax absorb the paisa difference.
  const gross = a.amountMinor;
  const estTaxable = divRound(gross * 10000, 10000 + rate);
  if (intraState) {
    half = divRound(estTaxable * rate, 20000);
    taxableMinor = gross - 2 * half;
  } else {
    taxableMinor = estTaxable;
    igst = gross - estTaxable;
  }
  return {
    intraState,
    taxableMinor,
    cgstMinor: half,
    sgstMinor: half,
    igstMinor: igst,
    taxMinor: 2 * half + igst,
    roundOffMinor: 0,
    totalMinor: gross,
  };
}

/** A credit note reverses the original document in full: same breakup, every amount negated. */
export function creditNoteBreakup(original: Omit<TaxBreakup, "intraState"> & { intraState?: boolean }): TaxBreakup {
  const neg = (n: number) => (n === 0 ? 0 : -n);
  return {
    intraState: original.intraState ?? original.igstMinor === 0,
    taxableMinor: neg(original.taxableMinor),
    cgstMinor: neg(original.cgstMinor),
    sgstMinor: neg(original.sgstMinor),
    igstMinor: neg(original.igstMinor),
    taxMinor: neg(original.taxMinor),
    roundOffMinor: neg(original.roundOffMinor),
    totalMinor: neg(original.totalMinor),
  };
}

// ─── Financial year & numbering ────────────────────────────────────────────

/** Indian financial year (April–March) of a YYYY-MM-DD day. 2027-03-31 → 2026-27, 2027-04-01 → 2027-28. */
export function financialYear(day: string): { startYear: number; label: string; short: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) throw new Error("day must be YYYY-MM-DD");
  const y = Number(m[1]);
  const month = Number(m[2]);
  const startYear = month >= 4 ? y : y - 1;
  const endYY = String((startYear + 1) % 100).padStart(2, "0");
  return { startYear, label: `${startYear}-${endYY}`, short: `${String(startYear % 100).padStart(2, "0")}-${endYY}` };
}

/** "INV/26-27/00042". Throws if the result would break the 16-character limit. */
export function formatDocNumber(prefix: string, fyShort: string, seq: number): string {
  if (!Number.isInteger(seq) || seq < 1) throw new Error("sequence must be a positive integer");
  const n = `${prefix}/${fyShort}/${String(seq).padStart(5, "0")}`;
  if (n.length > MAX_DOC_NUMBER_LENGTH || !/^[A-Z0-9/-]+$/.test(n)) throw new Error(`Document number ${n} breaks the 16-character GST limit`);
  return n;
}

/** Idempotency key for an invoice: one per fee record per payment (a re-payment after a reversal gets a new one). */
export function invoiceSourceKey(feeRecordId: string, paidAt: Date | null): string {
  return `fee:${feeRecordId}:${paidAt ? paidAt.getTime() : "na"}`;
}

export function creditNoteSourceKey(invoiceId: string): string {
  return `cn:${invoiceId}`;
}

/** True when the gap-free series has no holes: seqs sorted must be exactly 1..n. */
export function isGapFree(seqs: number[]): boolean {
  const s = [...seqs].sort((a, b) => a - b);
  return s.every((v, i) => v === i + 1);
}

// ─── Amount in words (Indian numbering) ─────────────────────────────────────

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? belowHundred(r) : ""].filter(Boolean).join(" ");
}

/** Whole number in words with lakh/crore grouping: 1234567 → "Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven". */
export function numberToIndianWords(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new Error("non-negative integer required");
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  let rest = n % 10_000_000;
  if (crore) parts.push(`${numberToIndianWords(crore)} Crore`);
  const lakh = Math.floor(rest / 100_000);
  rest %= 100_000;
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  const thousand = Math.floor(rest / 1000);
  rest %= 1000;
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(" ");
}

/** "Rupees One Thousand Two Hundred and Fifty Paise Only". Negative amounts (credit notes) are prefixed "Minus". */
export function amountInWords(minor: number): string {
  if (!Number.isInteger(minor)) throw new Error("integer paise required");
  const neg = minor < 0;
  const abs = Math.abs(minor);
  const rupees = Math.floor(abs / 100);
  const paise = abs % 100;
  const words = `Rupees ${numberToIndianWords(rupees)}${paise ? ` and ${belowHundred(paise)} Paise` : ""} Only`;
  return neg ? `Minus ${words}` : words;
}

/** ₹1,234.50 style formatting of paise for the printable page. */
export function formatMinorINR(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const r = Math.floor(abs / 100).toLocaleString("en-IN");
  return `${sign}₹${r}.${String(abs % 100).padStart(2, "0")}`;
}
