// TRIQ Spaces public venue discovery: pure filtering/shaping, client-safe (no DB).
// Visibility rule (spec §11): an active org with at least one active court that has a price. Only
// public business facts leave the server — never customers, staff or students.
import { CITIES, SPORTS, getCity, getSport, type DirectoryCity, type DirectorySport } from "@/lib/directory";

export const VENUES_PER_PAGE = 24;

export type VenueOrg = { id: string; slug: string; name: string; city: string; sport: string | null; photos: string[] };
export type VenueFacility = { orgId: string; type: string; hourlyRate: number };

export type VenueCard = {
  slug: string;
  name: string;
  city: string;
  sport: string | null;
  courts: number;
  courtTypes: string[];
  fromPrice: number;
  photo: string | null;
};

export type DiscoveryFilters = { city: DirectoryCity | null; sport: DirectorySport | null; page: number };

export function parseDiscoveryQuery(q: { city?: string | string[]; sport?: string | string[]; page?: string | string[] }): DiscoveryFilters {
  const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v)?.slice(0, 40);
  const page = Math.max(1, Math.min(500, Math.floor(Number(one(q.page)) || 1)));
  return { city: getCity(one(q.city)), sport: getSport(one(q.sport)), page };
}

const norm = (s: string) => s.toLowerCase().replace(/[\s_]+/g, "-");

export function cityMatches(city: DirectoryCity | null, orgCity: string): boolean {
  if (!city) return true;
  const c = orgCity.toLowerCase();
  return city.aliases.some((a) => c.includes(a));
}

export function sportMatches(sport: DirectorySport | null, orgSport: string | null, courtTypes: string[]): boolean {
  if (!sport) return true;
  const needles = [sport.slug, ...sport.aliases];
  const hay = [orgSport ?? "", ...courtTypes].map(norm).join(" ");
  return needles.some((n) => hay.includes(n));
}

/** Builds cards for publicly bookable venues matching the filters, sorted by name, paginated. */
export function buildVenueCards(
  orgs: VenueOrg[],
  facilities: VenueFacility[],
  f: DiscoveryFilters
): { cards: VenueCard[]; total: number; page: number; totalPages: number } {
  const byOrg = new Map<string, VenueFacility[]>();
  for (const fac of facilities) {
    if (!(fac.hourlyRate > 0)) continue;
    byOrg.set(fac.orgId, [...(byOrg.get(fac.orgId) ?? []), fac]);
  }
  const all: VenueCard[] = [];
  for (const o of orgs) {
    const courts = byOrg.get(o.id);
    if (!courts?.length) continue;
    const courtTypes = [...new Set(courts.map((c) => c.type.toUpperCase()))].sort();
    if (!cityMatches(f.city, o.city) || !sportMatches(f.sport, o.sport, courtTypes)) continue;
    all.push({
      slug: o.slug,
      name: o.name,
      city: o.city,
      sport: o.sport,
      courts: courts.length,
      courtTypes,
      fromPrice: Math.min(...courts.map((c) => c.hourlyRate)),
      photo: o.photos.find((p) => /^https:\/\//.test(p)) ?? null,
    });
  }
  all.sort((a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug));
  const totalPages = Math.max(1, Math.ceil(all.length / VENUES_PER_PAGE));
  const page = Math.min(f.page, totalPages);
  return { cards: all.slice((page - 1) * VENUES_PER_PAGE, page * VENUES_PER_PAGE), total: all.length, page, totalPages };
}

export const DISCOVERY_CITIES = CITIES;
export const DISCOVERY_SPORTS = SPORTS;
