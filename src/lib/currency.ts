/**
 * Global multi-currency and internationalization utilities for Triq Sports OS.
 * Supports academies in India, UAE, UK, US, Europe, Singapore, Australia, etc.
 */

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  defaultTimezone: string;
  defaultCountry: string;
  phonePrefix: string;
  locale: string;
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
  INR: {
    code: "INR",
    symbol: "₹",
    name: "Indian Rupee",
    defaultTimezone: "Asia/Kolkata",
    defaultCountry: "IN",
    phonePrefix: "91",
    locale: "en-IN",
  },
  AED: {
    code: "AED",
    symbol: "AED",
    name: "UAE Dirham",
    defaultTimezone: "Asia/Dubai",
    defaultCountry: "AE",
    phonePrefix: "971",
    locale: "en-AE",
  },
  USD: {
    code: "USD",
    symbol: "$",
    name: "US Dollar",
    defaultTimezone: "America/New_York",
    defaultCountry: "US",
    phonePrefix: "1",
    locale: "en-US",
  },
  GBP: {
    code: "GBP",
    symbol: "£",
    name: "British Pound",
    defaultTimezone: "Europe/London",
    defaultCountry: "GB",
    phonePrefix: "44",
    locale: "en-GB",
  },
  EUR: {
    code: "EUR",
    symbol: "€",
    name: "Euro",
    defaultTimezone: "Europe/Paris",
    defaultCountry: "EU",
    phonePrefix: "33",
    locale: "en-IE",
  },
  SGD: {
    code: "SGD",
    symbol: "S$",
    name: "Singapore Dollar",
    defaultTimezone: "Asia/Singapore",
    defaultCountry: "SG",
    phonePrefix: "65",
    locale: "en-SG",
  },
  AUD: {
    code: "AUD",
    symbol: "A$",
    name: "Australian Dollar",
    defaultTimezone: "Australia/Sydney",
    defaultCountry: "AU",
    phonePrefix: "61",
    locale: "en-AU",
  },
  CAD: {
    code: "CAD",
    symbol: "C$",
    name: "Canadian Dollar",
    defaultTimezone: "America/Toronto",
    defaultCountry: "CA",
    phonePrefix: "1",
    locale: "en-CA",
  },
};

/**
 * Format any currency amount into human-readable representation.
 * E.g. 2500, "INR" -> "₹2,500"
 * E.g. 500, "AED" -> "AED 500"
 * E.g. 150, "USD" -> "$150"
 */
export function formatCurrency(amount: number | null | undefined, currency: string = "INR"): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `${getCurrencySymbol(currency)}0`;
  }

  const curr = (currency || "INR").toUpperCase();
  const config = SUPPORTED_CURRENCIES[curr];

  try {
    return new Intl.NumberFormat(config?.locale || "en-US", {
      style: "currency",
      currency: curr,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    const symbol = config?.symbol || curr;
    return `${symbol} ${amount.toLocaleString()}`;
  }
}

/**
 * Return only the currency symbol (e.g. "₹", "AED", "$", "£")
 */
export function getCurrencySymbol(currency: string = "INR"): string {
  const curr = (currency || "INR").toUpperCase();
  return SUPPORTED_CURRENCIES[curr]?.symbol || curr;
}

/**
 * Cleans and formats phone numbers for global WhatsApp integration.
 * If number starts with +, removes + and keeps full international number.
 * If 10 digits without country code, prepends the academy's country phone prefix (default 91 for India).
 */
export function cleanInternationalPhone(phone: string | null | undefined, defaultPrefix: string = "91"): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (!cleaned) return "";

  // If already contains country code (more than 10 digits or starts with 00)
  if (cleaned.startsWith("00")) {
    return cleaned.slice(2);
  }
  if (cleaned.length > 10) {
    return cleaned;
  }

  // 10-digit number without country code
  return `${defaultPrefix}${cleaned}`;
}

/**
 * Get date/month string localized to the academy's timezone
 */
export function getOrgDateString(d: Date = new Date(), timezone: string = "Asia/Kolkata"): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().split("T")[0];
  }
}

export function getOrgMonthString(d: Date = new Date(), timezone: string = "Asia/Kolkata"): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
    }).format(d);
    return parts.slice(0, 7);
  } catch {
    return d.toISOString().slice(0, 7);
  }
}
