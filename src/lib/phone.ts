// Phone number helpers (pure: no DB / server-only imports, safe for client components and scripts).
//
// Storage convention today (unchanged, no migration): Indian users are stored and looked up by their
// 10-digit national number ("9876543210", see cleanIndianPhone in import-utils.ts). Anyone else is
// stored as the digits of their international number without "+" ("447700900123").
//
// Sending needs a different shape: E.164 ("+919876543210") for Twilio / WhatsApp, and
// "91XXXXXXXXXX" (country code, no "+") for MSG91.

export type PhoneCountry = "IN";

export interface ParsedPhone {
  /** "+919876543210" / "+447700900123" */
  e164: string;
  /** True for +91 numbers (or bare 10-digit numbers with the default country IN). */
  isIndian: boolean;
  /** 10-digit national number for Indian numbers, otherwise null. */
  nationalIndian: string | null;
}

const MIN_E164_DIGITS = 8;
const MAX_E164_DIGITS = 15;

/**
 * Parse free-text phone input.
 * - "+<cc>…" or "00<cc>…" is taken as an explicit international number and kept as given
 *   (so "+44 7700 900123" never turns into "9144…").
 * - Without a "+", with defaultCountry "IN": 10 digits, "0" + 10 digits and "91" + 10 digits are Indian.
 *   Any other 8–15 digit string is assumed to already carry its country code (what the app did before).
 */
export function parsePhone(input: unknown, defaultCountry: PhoneCountry = "IN"): ParsedPhone | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  const explicitIntl = raw.startsWith("+") || /^00[1-9]/.test(digits);
  if (explicitIntl) {
    if (!raw.startsWith("+")) digits = digits.slice(2); // "0044…" → "44…"
    if (digits.startsWith("91")) {
      const national = digits.slice(2);
      return /^\d{10}$/.test(national) ? indian(national) : null;
    }
    return intl(digits);
  }

  if (defaultCountry === "IN") {
    if (digits.length === 10) return indian(digits);
    if (digits.length === 11 && digits.startsWith("0")) return indian(digits.slice(1));
    if (digits.length === 12 && digits.startsWith("91")) return indian(digits.slice(2));
  }
  return intl(digits);
}

function indian(national: string): ParsedPhone {
  return { e164: `+91${national}`, isIndian: true, nationalIndian: national };
}

function intl(digits: string): ParsedPhone | null {
  if (digits.length < MIN_E164_DIGITS || digits.length > MAX_E164_DIGITS || digits.startsWith("0")) return null;
  return { e164: `+${digits}`, isIndian: false, nationalIndian: null };
}

/** E.164 ("+919876543210"), or null when the input can't be a phone number. */
export function normalizePhone(input: unknown, defaultCountry: PhoneCountry = "IN"): string | null {
  return parsePhone(input, defaultCountry)?.e164 ?? null;
}

/** True for a "+91…" E.164 number. */
export function isIndianE164(e164: string): boolean {
  return /^\+91\d{10}$/.test(e164);
}

/**
 * The key users are stored/looked up by today: 10 digits for Indian numbers, otherwise the
 * international digits without "+". Never use this for sending.
 */
export function phoneStorageKey(input: unknown, defaultCountry: PhoneCountry = "IN"): string | null {
  const p = parsePhone(input, defaultCountry);
  if (!p) return null;
  return p.nationalIndian ?? p.e164.slice(1);
}

/**
 * Keys to try, in order, when matching an existing user. The first is the canonical storage key;
 * the second is the old "all digits of whatever was typed" key, so accounts saved that way
 * (e.g. "919876543210" from email sign-up) still match exactly as before.
 */
export function phoneLookupKeys(input: unknown, defaultCountry: PhoneCountry = "IN"): string[] {
  const keys: string[] = [];
  const primary = phoneStorageKey(input, defaultCountry);
  if (primary) keys.push(primary);
  const legacy = String(input ?? "").replace(/\D/g, "");
  if (legacy && !keys.includes(legacy)) keys.push(legacy);
  return keys;
}

/** MSG91 "mobile" parameter: country code + number, no "+" ("919876543210"). */
export function toMsg91Mobile(e164: string): string {
  return e164.replace(/^\+/, "");
}

/** Digits for a wa.me link ("919876543210"). */
export function toWaMeNumber(input: unknown, defaultCountry: PhoneCountry = "IN"): string | null {
  const e164 = normalizePhone(input, defaultCountry);
  return e164 ? e164.slice(1) : null;
}
