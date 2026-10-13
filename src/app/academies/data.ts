// Server-side data loaders for the public directory. PUBLIC data only:
// never select org phone/email/UPI, student, parent or lead data here.
import { cache } from "react";
import { db } from "@/lib/db";
import {
  type DirectoryCity,
  type DirectoryItem,
  getCity,
  listingPath,
  listingScore,
  normalizeSport,
  parseSports,
  slugify,
  isSafeHexColor,
} from "@/lib/directory";

const MAX_LISTINGS_PER_CITY = 1000;

async function loadOrgItems(city: DirectoryCity): Promise<DirectoryItem[]> {
  const orgs = await db.organization.findMany({
    where: {
      isActive: true,
      OR: city.aliases.map((a) => ({ city: { contains: a, mode: "insensitive" as const } })),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      sport: true,
      logo: true,
      brandColor: true,
      batches: { select: { sport: true, monthlyFee: true } },
    },
    take: 200,
  });

  return orgs
    .map((o) => {
      const sports: string[] = [];
      for (const raw of [o.sport, ...o.batches.map((b) => b.sport)]) {
        for (const part of String(raw ?? "").split(",")) {
          const s = normalizeSport(part);
          if (s && !sports.includes(s)) sports.push(s);
        }
      }
      const fees = o.batches.map((b) => b.monthlyFee).filter((f): f is number => typeof f === "number" && f > 0);
      const item: DirectoryItem = {
        kind: "org",
        id: o.id,
        slug: o.slug,
        name: o.name,
        area: null,
        areaSlug: null,
        cityName: city.name,
        sports,
        rating: null,
        ratingCount: null,
        href: `/academy/${o.slug}`,
        trialHref: `/trial?academy=${encodeURIComponent(o.slug)}`,
        logo: o.logo && /^(https?:\/\/|\/)/.test(o.logo) ? o.logo : null,
        brandColor: isSafeHexColor(o.brandColor) ? o.brandColor : null,
        minFee: fees.length ? Math.min(...fees) : null,
        batchCount: o.batches.length,
        claimStatus: null,
      };
      return item;
    })
    .sort((a, b) => b.batchCount - a.batchCount);
}

async function loadListedItems(city: DirectoryCity, hideClaimedFor: Set<string>): Promise<DirectoryItem[]> {
  const rows = await db.listedAcademy.findMany({
    where: { city: city.slug },
    select: {
      id: true,
      slug: true,
      name: true,
      area: true,
      sports: true,
      rating: true,
      ratingCount: true,
      claimStatus: true,
      claimedOrgId: true,
    },
    take: MAX_LISTINGS_PER_CITY,
  });

  return rows
    // A listing claimed by a Triq org that's already shown (as an "On Triq" card) shouldn't appear twice.
    .filter((r) => !(r.claimedOrgId && hideClaimedFor.has(r.claimedOrgId)))
    .map((r) => {
      const sports = parseSports(r.sports);
      const href = listingPath(city.slug, sports, r.slug);
      const area = r.area?.trim() || null;
      const item: DirectoryItem = {
        kind: "listed",
        id: r.id,
        slug: r.slug,
        name: r.name,
        area,
        areaSlug: area ? slugify(area) : null,
        cityName: city.name,
        sports,
        rating: typeof r.rating === "number" ? r.rating : null,
        ratingCount: typeof r.ratingCount === "number" ? r.ratingCount : null,
        href,
        trialHref: `${href}#trial`,
        logo: null,
        brandColor: null,
        minFee: null,
        batchCount: 0,
        claimStatus: r.claimStatus,
      };
      return item;
    })
    .sort((a, b) => listingScore(b.rating, b.ratingCount) - listingScore(a.rating, a.ratingCount) || a.name.localeCompare(b.name));
}

/** All directory entries for a city: Triq academies first, then public listings (ranked). */
export const getCityDirectory = cache(async (citySlug: string): Promise<DirectoryItem[]> => {
  const city = getCity(citySlug);
  if (!city) return [];
  const orgs = await loadOrgItems(city);
  const listed = await loadListedItems(city, new Set(orgs.map((o) => o.id)));
  return [...orgs, ...listed];
});

export function filterBySport(items: DirectoryItem[], sportSlug: string): DirectoryItem[] {
  return items.filter((i) => i.sports.includes(sportSlug));
}

/** Count of entries per sport slug for a set of items. */
export function sportCounts(items: DirectoryItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const i of items) for (const s of i.sports) counts[s] = (counts[s] ?? 0) + 1;
  return counts;
}

export const getListedAcademy = cache(async (slug: string) => {
  if (!slug || slug.length > 160 || !/^[a-z0-9-]+$/i.test(slug)) return null;
  return db.listedAcademy.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      city: true,
      area: true,
      sports: true,
      address: true,
      lat: true,
      lng: true,
      website: true,
      instagram: true,
      rating: true,
      ratingCount: true,
      googlePlaceId: true,
      claimStatus: true,
      claimedOrgId: true,
      updatedAt: true,
    },
  });
});
