"use client";

/**
 * React context + hooks for propagating the current org's locale (country,
 * currency, timezone, locale, phoneCountry) through the component tree.
 *
 * Why this exists: before this file, deep components had to either (a) accept
 * org as a prop (viral refactor), or (b) hard-code "en-IN" / "Asia/Kolkata" /
 * "₹" — which is what most of them did. With `OrgLocaleProvider` wrapping
 * each role-specific layout, any component can call `useOrgLocale()`,
 * `useFormatMoney()`, or `useFormatDate()` without plumbing.
 *
 * Server pages fetch the org locale once and pass it in; client interactions
 * then use the hooks for every date / money / phone format.
 *
 * Public pages (/, /academies, /academy/[slug]) have no logged-in org — in
 * that case the provider is omitted and the hooks fall back to safe defaults
 * (India).
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  formatMoney as rawFormatMoney,
  formatMoneyCompact as rawFormatMoneyCompact,
  formatDate as rawFormatDate,
  formatTime as rawFormatTime,
  currencySymbol as rawCurrencySymbol,
  normalizePhoneForOrg as rawNormalizePhone,
  waLink as rawWaLink,
  orgToday as rawOrgToday,
  orgCurrentMonth as rawOrgCurrentMonth,
  type OrgLocale,
} from "@/lib/i18n";

const OrgLocaleContext = createContext<OrgLocale | null>(null);

export function OrgLocaleProvider({
  value,
  children,
}: {
  value: OrgLocale | null | undefined;
  children: ReactNode;
}) {
  // Freeze the value identity per render so hook consumers don't re-render
  // every time the parent passes a fresh literal.
  const stable = useMemo<OrgLocale | null>(() => value ?? null, [
    value?.country,
    value?.currency,
    value?.timezone,
    value?.locale,
    value?.phoneCountry,
  ]);
  return <OrgLocaleContext.Provider value={stable}>{children}</OrgLocaleContext.Provider>;
}

/** Returns the current org locale, or null outside a provider. */
export function useOrgLocale(): OrgLocale | null {
  return useContext(OrgLocaleContext);
}

/** Pre-bound formatter: amount → "₹1,500" / "$1,500" / "AED 1,500". */
export function useFormatMoney() {
  const org = useOrgLocale();
  return (amount: number, opts?: Intl.NumberFormatOptions) =>
    rawFormatMoney(amount, org, opts);
}

/** Pre-bound compact formatter: amount → "₹1.5L" / "$1.5K". */
export function useFormatMoneyCompact() {
  const org = useOrgLocale();
  return (amount: number) => rawFormatMoneyCompact(amount, org);
}

/** Pre-bound date formatter in the org's timezone and locale. */
export function useFormatDate() {
  const org = useOrgLocale();
  return (date: Date | string, opts?: Intl.DateTimeFormatOptions) =>
    rawFormatDate(date, org, opts);
}

/** Pre-bound time formatter. */
export function useFormatTime() {
  const org = useOrgLocale();
  return (date: Date | string, opts?: Intl.DateTimeFormatOptions) =>
    rawFormatTime(date, org, opts);
}

/** Just the symbol: "₹" / "$" / "AED". */
export function useCurrencySymbol() {
  const org = useOrgLocale();
  return rawCurrencySymbol(org);
}

/** Normalize a phone number using the org's country code. */
export function useNormalizePhone() {
  const org = useOrgLocale();
  return (phone: string) => rawNormalizePhone(phone, org);
}

/** Build a wa.me link using the org's country code. */
export function useWaLink() {
  const org = useOrgLocale();
  return (phone: string, text: string) => rawWaLink(phone, text, org);
}

/** YYYY-MM-DD "today" in the org's timezone. */
export function useOrgToday() {
  const org = useOrgLocale();
  return () => rawOrgToday(org);
}

/** YYYY-MM "current month" in the org's timezone. */
export function useOrgCurrentMonth() {
  const org = useOrgLocale();
  return () => rawOrgCurrentMonth(org);
}
