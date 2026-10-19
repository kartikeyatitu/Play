/**
 * Globalisation helpers.
 *
 * Every function takes an org-shaped object with the five locale fields
 * (country, currency, timezone, locale, phoneCountry) so callers can pass
 * the session org directly. All fields have safe defaults matching the
 * current India-first deployment.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OrgLocale {
  country?: string | null;   // ISO 3166-1 alpha-2, e.g. "IN", "US", "AE"
  currency?: string | null;  // ISO 4217, e.g. "INR", "USD", "AED"
  timezone?: string | null;  // IANA, e.g. "Asia/Kolkata", "America/New_York"
  locale?: string | null;    // BCP-47, e.g. "en-IN", "en-US", "ar-AE"
  phoneCountry?: string | null; // calling code without +, e.g. "91", "1", "971"
}

// ─── Defaults ───────────────────────────────────────────────────────────────

const DEFAULTS = {
  country: "IN",
  currency: "INR",
  timezone: "Asia/Kolkata",
  locale: "en-IN",
  phoneCountry: "91",
} as const;

function val<K extends keyof typeof DEFAULTS>(org: OrgLocale | null | undefined, key: K): string {
  return (org as Record<string, unknown> | null)?.[key] as string || DEFAULTS[key];
}

// ─── Currency ───────────────────────────────────────────────────────────────

/** Currency symbol lookup (common cases; Intl.NumberFormat handles the rest). */
const SYMBOLS: Record<string, string> = {
  INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ", SGD: "S$",
  AUD: "A$", CAD: "C$", MYR: "RM", THB: "฿", JPY: "¥", CNY: "¥",
  KRW: "₩", ZAR: "R", BRL: "R$", SAR: "﷼", QAR: "﷼", KWD: "د.ك",
  BHD: "BD", OMR: "﷼", NGN: "₦", KES: "KSh", GHS: "GH₵",
};

/** Quick currency symbol (e.g. "₹"). Use formatMoney for full formatting. */
export function currencySymbol(org?: OrgLocale | null): string {
  const code = val(org, "currency");
  return SYMBOLS[code] || code;
}

/**
 * Format a monetary amount using the org's locale and currency.
 * @param amount  Amount in major units (e.g. 1500, not 150000 paise).
 * @param org     Org locale config. Defaults to INR / en-IN.
 * @param opts    Extra Intl.NumberFormat options (e.g. { notation: "compact" }).
 */
export function formatMoney(
  amount: number,
  org?: OrgLocale | null,
  opts?: Intl.NumberFormatOptions
): string {
  const locale = val(org, "locale");
  const currency = val(org, "currency");
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      ...opts,
    }).format(amount);
  } catch {
    // Fallback if the runtime doesn't know the locale
    return `${currencySymbol(org)}${amount.toLocaleString()}`;
  }
}

/**
 * Compact money format for dashboard cards (e.g. "₹1.5L", "$15K").
 */
export function formatMoneyCompact(amount: number, org?: OrgLocale | null): string {
  const currency = val(org, "currency");
  const locale = val(org, "locale");
  // Indian numbering system: use lakhs/crores for INR
  if (currency === "INR") {
    if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`;
    if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`;
    if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`;
    return `₹${amount}`;
  }
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: "compact",
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(amount);
  } catch {
    return `${currencySymbol(org)}${amount.toLocaleString()}`;
  }
}

// ─── Phone ──────────────────────────────────────────────────────────────────

/**
 * Normalize a phone number to E.164-ish digits using the org's country code.
 * 10-digit numbers get the org's phoneCountry prefix; numbers already
 * prefixed or international are left as-is.
 */
export function normalizePhoneForOrg(phone: string, org?: OrgLocale | null): string {
  const clean = phone.replace(/\D/g, "");
  const cc = val(org, "phoneCountry");
  // Already has a country code (>10 digits or starts with the org's code)
  if (clean.length > 10) return clean;
  if (clean.length === 10) return `${cc}${clean}`;
  return clean; // short number — return as-is
}

/** wa.me link using the org's country code. */
export function waLink(phone: string, text: string, org?: OrgLocale | null): string {
  const num = normalizePhoneForOrg(phone, org);
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

// ─── Date / Time ────────────────────────────────────────────────────────────

/**
 * Format a date in the org's timezone and locale.
 */
export function formatDate(
  date: Date | string,
  org?: OrgLocale | null,
  opts?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const tz = val(org, "timezone");
  const locale = val(org, "locale");
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      dateStyle: "medium",
      ...opts,
    }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

/**
 * Format a time in the org's timezone and locale.
 */
export function formatTime(
  date: Date | string,
  org?: OrgLocale | null,
  opts?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const tz = val(org, "timezone");
  const locale = val(org, "locale");
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      timeStyle: "short",
      ...opts,
    }).format(d);
  } catch {
    return d.toLocaleTimeString();
  }
}

/**
 * Get "today" in the org's timezone as YYYY-MM-DD.
 */
export function orgToday(org?: OrgLocale | null): string {
  const tz = val(org, "timezone");
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).formatToParts(new Date());
    const y = parts.find(p => p.type === "year")!.value;
    const m = parts.find(p => p.type === "month")!.value;
    const d = parts.find(p => p.type === "day")!.value;
    return `${y}-${m}-${d}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Current YYYY-MM in the org's timezone.
 */
export function orgCurrentMonth(org?: OrgLocale | null): string {
  return orgToday(org).slice(0, 7);
}

// ─── Locale metadata for settings UI ────────────────────────────────────────

export interface CountryOption {
  code: string;
  name: string;
  currency: string;
  phoneCountry: string;
  timezone: string;
  locale: string;
}

/** Common countries for the academy settings dropdown. */
export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: "IN", name: "India", currency: "INR", phoneCountry: "91", timezone: "Asia/Kolkata", locale: "en-IN" },
  { code: "AE", name: "UAE", currency: "AED", phoneCountry: "971", timezone: "Asia/Dubai", locale: "en-AE" },
  { code: "US", name: "United States", currency: "USD", phoneCountry: "1", timezone: "America/New_York", locale: "en-US" },
  { code: "GB", name: "United Kingdom", currency: "GBP", phoneCountry: "44", timezone: "Europe/London", locale: "en-GB" },
  { code: "AU", name: "Australia", currency: "AUD", phoneCountry: "61", timezone: "Australia/Sydney", locale: "en-AU" },
  { code: "SG", name: "Singapore", currency: "SGD", phoneCountry: "65", timezone: "Asia/Singapore", locale: "en-SG" },
  { code: "CA", name: "Canada", currency: "CAD", phoneCountry: "1", timezone: "America/Toronto", locale: "en-CA" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", phoneCountry: "966", timezone: "Asia/Riyadh", locale: "ar-SA" },
  { code: "QA", name: "Qatar", currency: "QAR", phoneCountry: "974", timezone: "Asia/Qatar", locale: "ar-QA" },
  { code: "KW", name: "Kuwait", currency: "KWD", phoneCountry: "965", timezone: "Asia/Kuwait", locale: "ar-KW" },
  { code: "BH", name: "Bahrain", currency: "BHD", phoneCountry: "973", timezone: "Asia/Bahrain", locale: "ar-BH" },
  { code: "OM", name: "Oman", currency: "OMR", phoneCountry: "968", timezone: "Asia/Muscat", locale: "ar-OM" },
  { code: "MY", name: "Malaysia", currency: "MYR", phoneCountry: "60", timezone: "Asia/Kuala_Lumpur", locale: "ms-MY" },
  { code: "NG", name: "Nigeria", currency: "NGN", phoneCountry: "234", timezone: "Africa/Lagos", locale: "en-NG" },
  { code: "KE", name: "Kenya", currency: "KES", phoneCountry: "254", timezone: "Africa/Nairobi", locale: "en-KE" },
  { code: "ZA", name: "South Africa", currency: "ZAR", phoneCountry: "27", timezone: "Africa/Johannesburg", locale: "en-ZA" },
  { code: "GH", name: "Ghana", currency: "GHS", phoneCountry: "233", timezone: "Africa/Accra", locale: "en-GH" },
];
