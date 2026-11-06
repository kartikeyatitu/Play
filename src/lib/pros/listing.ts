// TRIQ Connect directory: who is listed, how listings are filtered and ordered. Pure and client-safe.
// Registration numbers and evidence links never enter a listing.

import type { ProMeta } from "./meta";
import { isHealthType, isLanguage, isProType, type DeliveryMode, type ProType } from "./types";
import { isVerified, type ProVerificationState } from "./verification";

export interface ListingSource {
  profile: { isPublic: boolean };
  meta: ProMeta | null;
  /** The WellnessProvider row for health types (null when there is none). */
  provider: { isListed: boolean; acceptingRequests: boolean } | null;
}

/**
 * Listed only when the professional chose to be listed: a public profile with Connect metadata, and for
 * health types also WellnessProvider.isListed. Opt-in is per professional, never defaulted on.
 */
export function isListable(src: ListingSource): boolean {
  if (!src.profile.isPublic || !src.meta) return false;
  if (isHealthType(src.meta.type)) return !!src.provider?.isListed;
  return true;
}

/** Booking requests: listed health providers who accept requests and are ops-verified. */
export function canReceiveRequests(src: ListingSource, verification: ProVerificationState): boolean {
  if (!isListable(src) || !src.meta || !isHealthType(src.meta.type)) return false;
  return !!src.provider?.acceptingRequests && isVerified(verification);
}

export interface ProListing {
  profileId: string;
  userId: string;
  name: string;
  type: ProType;
  headline: string | null;
  bio: string;
  sports: string[];
  city: string | null;
  languages: string[];
  modes: DeliveryMode[];
  specialisations: string[];
  yearsExperience: number | null;
  verification: ProVerificationState;
  providerId: string | null;
  acceptsRequests: boolean;
}

export interface DirectoryFilters {
  type: ProType | null;
  sport: string | null;
  city: string | null;
  language: string | null;
  online: boolean;
}

export const EMPTY_FILTERS: DirectoryFilters = { type: null, sport: null, city: null, language: null, online: false };

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const text = (v: unknown, max = 60) => {
  const s = first(v);
  if (typeof s !== "string") return null;
  const t = s.trim().slice(0, max);
  return t || null;
};

export function parseDirectoryFilters(sp: Record<string, string | string[] | undefined>): DirectoryFilters {
  const type = first(sp.type);
  const language = first(sp.language);
  const online = first(sp.online);
  return {
    type: isProType(type) ? type : null,
    sport: text(sp.sport),
    city: text(sp.city),
    language: isLanguage(language) ? language : null,
    online: online === "1" || online === "on" || online === "true",
  };
}

export function matchesFilters(l: ProListing, f: DirectoryFilters): boolean {
  if (f.type && l.type !== f.type) return false;
  if (f.sport) {
    const want = norm(f.sport);
    if (!l.sports.some((s) => norm(s) === want)) return false;
  }
  if (f.city && (!l.city || norm(l.city) !== norm(f.city))) return false;
  if (f.language && !l.languages.includes(f.language)) return false;
  if (f.online && !l.modes.includes("ONLINE")) return false;
  return true;
}

/** Filters, then orders verified professionals first and by name. */
export function filterListings(listings: ProListing[], f: DirectoryFilters): ProListing[] {
  return listings
    .filter((l) => matchesFilters(l, f))
    .sort((a, b) => {
      const v = Number(isVerified(b.verification)) - Number(isVerified(a.verification));
      return v !== 0 ? v : a.name.localeCompare(b.name);
    });
}

/** Distinct sports and cities across listings, for filter dropdowns. */
export function facetValues(listings: ProListing[]): { sports: string[]; cities: string[] } {
  const pick = (xs: string[]) => {
    const byNorm = new Map<string, string>();
    for (const x of xs) if (x.trim() && !byNorm.has(norm(x))) byNorm.set(norm(x), x.trim());
    return Array.from(byNorm.values()).sort((a, b) => a.localeCompare(b));
  };
  return { sports: pick(listings.flatMap((l) => l.sports)), cities: pick(listings.flatMap((l) => (l.city ? [l.city] : []))) };
}
