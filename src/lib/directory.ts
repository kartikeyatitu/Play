// Public academy directory: city/sport config, display names and pure helpers.
// IMPORTANT: no DB / server-only imports here — this module is shared with client components.
// (Tailwind does not scan src/lib, so no class names live here either.)

import { getAppUrl } from "@/lib/app-url";

export const SITE_URL = getAppUrl();

export type DirectoryCity = {
  slug: string;
  name: string;
  /** Lowercase substrings used to match free-text Organization.city values. */
  aliases: string[];
  region: string;
  country: "IN" | "AE";
  live: boolean;
};

export const CITIES: DirectoryCity[] = [
  { slug: "gurgaon", name: "Gurgaon", aliases: ["gurgaon", "gurugram"], region: "Haryana", country: "IN", live: true },
  { slug: "delhi", name: "Delhi", aliases: ["delhi"], region: "Delhi", country: "IN", live: false },
  { slug: "noida", name: "Noida", aliases: ["noida"], region: "Uttar Pradesh", country: "IN", live: false },
  { slug: "bangalore", name: "Bangalore", aliases: ["bangalore", "bengaluru"], region: "Karnataka", country: "IN", live: false },
  { slug: "mumbai", name: "Mumbai", aliases: ["mumbai", "bombay"], region: "Maharashtra", country: "IN", live: false },
  { slug: "dubai", name: "Dubai", aliases: ["dubai"], region: "Dubai", country: "AE", live: false },
];

export type DirectorySport = {
  slug: string;
  name: string;
  emoji: string;
  /** Alternative spellings, already in slug form (lowercase, dashes). */
  aliases: string[];
};

export const SPORTS: DirectorySport[] = [
  { slug: "cricket", name: "Cricket", emoji: "🏏", aliases: [] },
  { slug: "football", name: "Football", emoji: "⚽", aliases: ["soccer", "futsal"] },
  { slug: "badminton", name: "Badminton", emoji: "🏸", aliases: ["shuttle"] },
  { slug: "tennis", name: "Tennis", emoji: "🎾", aliases: ["lawn-tennis"] },
  { slug: "swimming", name: "Swimming", emoji: "🏊", aliases: ["swim", "aquatics"] },
  { slug: "basketball", name: "Basketball", emoji: "🏀", aliases: [] },
  { slug: "skating", name: "Skating", emoji: "🛼", aliases: ["roller-skating", "ice-skating", "skateboarding"] },
  { slug: "table-tennis", name: "Table Tennis", emoji: "🏓", aliases: ["tt", "tabletennis", "ping-pong"] },
  {
    slug: "martial-arts",
    name: "Martial Arts",
    emoji: "🥋",
    aliases: ["karate", "taekwondo", "judo", "mma", "boxing", "kickboxing", "kung-fu", "wushu", "jiu-jitsu", "bjj"],
  },
  { slug: "chess", name: "Chess", emoji: "♟️", aliases: [] },
  { slug: "athletics", name: "Athletics", emoji: "🏃", aliases: ["running", "track-and-field", "track-field"] },
  {
    slug: "multi-sport",
    name: "Multi-sport",
    emoji: "🏅",
    aliases: ["multisport", "multi-sports", "multiple", "all-sports", "sports", "general"],
  },
];

export function getCity(slug: string | undefined | null): DirectoryCity | null {
  if (!slug) return null;
  return CITIES.find((c) => c.slug === slug.toLowerCase()) ?? null;
}

export function getSport(slug: string | undefined | null): DirectorySport | null {
  if (!slug) return null;
  return SPORTS.find((s) => s.slug === slug.toLowerCase()) ?? null;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Maps free-text sport names ("Table Tennis", "Karate", "Soccer") to a directory sport slug. */
export function normalizeSport(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = slugify(raw);
  if (!s) return null;
  const hit = SPORTS.find((sp) => sp.slug === s || sp.aliases.includes(s));
  return hit ? hit.slug : null;
}

/** Parses a comma-separated sports list into unique, known sport slugs (config order preserved per input). */
export function parseSports(list: string | null | undefined): string[] {
  if (!list) return [];
  const out: string[] = [];
  for (const part of list.split(",")) {
    const slug = normalizeSport(part);
    if (slug && !out.includes(slug)) out.push(slug);
  }
  return out;
}

export function sportName(slug: string): string {
  return getSport(slug)?.name ?? slug;
}

/** "Best cricket academies in Gurgaon" */
export function listingHeading(city: DirectoryCity, sport?: DirectorySport | null): string {
  return sport ? `Best ${sport.name.toLowerCase()} academies in ${city.name}` : `Best sports academies in ${city.name}`;
}

export function cityMatches(orgCity: string | null | undefined, city: DirectoryCity): boolean {
  if (!orgCity) return false;
  const v = orgCity.toLowerCase();
  return city.aliases.some((a) => v.includes(a));
}

/** Cleans an Indian mobile number to 10 digits (strips spaces, +91, leading 0). */
export function cleanIndianPhone(raw: string | null | undefined): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

export const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;

/** wa.me link for a stored phone (10-digit Indian numbers get the 91 prefix). */
export function waLink(phone: string, text?: string): string {
  let d = String(phone).replace(/\D/g, "");
  if (d.length === 10) d = `91${d}`;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function mapsLink(opts: { name: string; address?: string | null; area?: string | null; cityName?: string; placeId?: string | null }): string {
  const q = [opts.name, opts.address || [opts.area, opts.cityName].filter(Boolean).join(", ")].filter(Boolean).join(", ");
  const params = new URLSearchParams({ api: "1", query: q });
  if (opts.placeId) params.set("query_place_id", opts.placeId);
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function externalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(v)) return `https://${v}`;
  return null;
}

export function instagramUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "").replace(/^(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "");
  return /^[\w.]{1,30}$/.test(handle) ? `https://www.instagram.com/${handle}/` : null;
}

export function isSafeHexColor(c: string | null | undefined): c is string {
  return !!c && /^#[0-9a-f]{3,8}$/i.test(c);
}

export function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}

/**
 * Honest ranking for public listings: Bayesian-weighted Google rating so a 5.0 with 2 reviews
 * doesn't outrank a 4.5 with 300. Listings without ratings sort last.
 */
export function listingScore(rating: number | null | undefined, count: number | null | undefined): number {
  if (rating == null) return -1;
  const n = Math.max(0, count ?? 0);
  const m = 25; // prior weight
  const C = 4.0; // prior mean
  return (C * m + rating * n) / (m + n);
}

/** Serializable card model shared by server pages and the client grid. */
export type DirectoryItem = {
  kind: "org" | "listed";
  id: string;
  slug: string;
  name: string;
  area: string | null;
  areaSlug: string | null;
  cityName: string;
  sports: string[];
  rating: number | null;
  ratingCount: number | null;
  href: string;
  trialHref: string;
  logo: string | null;
  brandColor: string | null;
  minFee: number | null;
  batchCount: number;
  claimStatus: string | null;
};

/** Canonical path of a listed academy profile (primary sport = first known sport). */
export function listingPath(citySlug: string, sports: string[], slug: string): string {
  return `/academies/${citySlug}/${sports[0] ?? "multi-sport"}/${slug}`;
}
