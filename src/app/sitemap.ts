import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { CITIES, SITE_URL, SPORTS, cityMatches, getCity, listingPath, normalizeSport, parseSports } from "@/lib/directory";

export const revalidate = 3600;

// Static marketing pages + public directory (city, city×sport with data, listing profiles)
// + Triq academy pages + verified coach profiles. Only pages with real data are included.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    /* /gurgaon and /noida now redirect to /academies */
    { url: `${SITE_URL}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/academies`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
  ];

  try {
    const [listings, orgs, coaches] = await Promise.all([
      db.listedAcademy.findMany({
        where: { claimStatus: { in: ["UNCLAIMED", "PENDING"] } },
        select: { slug: true, city: true, sports: true, updatedAt: true },
        take: 45000,
      }),
      db.organization.findMany({
        where: { isActive: true },
        select: { slug: true, city: true, sport: true, updatedAt: true, batches: { select: { sport: true } } },
        take: 5000,
      }),
      // Coach pages are only listed when Coach OS is on (they are noindex otherwise).
      !FEATURES.coachOS ? Promise.resolve([] as { id: string; updatedAt: Date }[]) : db.user.findMany({
        where: { verified: true, role: { in: ["COACH", "ADMIN"] }, orgId: { not: null }, org: { isActive: true } },
        select: { id: true, updatedAt: true },
        take: 5000,
      }),
    ]);

    // city → sport set (only combinations that actually have academies)
    const citySports = new Map<string, Set<string>>();
    const add = (city: string, sport: string) => {
      if (!citySports.has(city)) citySports.set(city, new Set());
      citySports.get(city)!.add(sport);
    };

    for (const l of listings) {
      if (!getCity(l.city)) continue;
      const sports = parseSports(l.sports);
      sports.forEach((s) => add(l.city, s));
      if (!citySports.has(l.city)) citySports.set(l.city, new Set());
      entries.push({
        url: `${SITE_URL}${listingPath(l.city, sports, l.slug)}`,
        lastModified: l.updatedAt,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }

    for (const o of orgs) {
      entries.push({ url: `${SITE_URL}/academy/${o.slug}`, lastModified: o.updatedAt, changeFrequency: "weekly", priority: 0.7 });
      const city = CITIES.find((c) => cityMatches(o.city, c));
      if (!city) continue;
      if (!citySports.has(city.slug)) citySports.set(city.slug, new Set());
      for (const raw of [o.sport, ...o.batches.map((b) => b.sport)]) {
        for (const part of String(raw ?? "").split(",")) {
          const s = normalizeSport(part);
          if (s) add(city.slug, s);
        }
      }
    }

    for (const c of CITIES) {
      const sports = citySports.get(c.slug);
      if (!sports) continue; // no data → page is noindex, keep it out of the sitemap
      entries.push({ url: `${SITE_URL}/academies/${c.slug}`, lastModified: now, changeFrequency: "daily", priority: 0.8 });
      for (const s of SPORTS) {
        if (sports.has(s.slug)) {
          entries.push({ url: `${SITE_URL}/academies/${c.slug}/${s.slug}`, lastModified: now, changeFrequency: "daily", priority: 0.8 });
        }
      }
    }

    for (const u of coaches) {
      entries.push({ url: `${SITE_URL}/c/${u.id}`, lastModified: u.updatedAt, changeFrequency: "weekly", priority: 0.5 });
    }
  } catch (e) {
    // Never break the sitemap: fall back to static + live city pages.
    console.error("[sitemap] dynamic entries failed", e);
    for (const c of CITIES.filter((c) => c.live)) {
      entries.push({ url: `${SITE_URL}/academies/${c.slug}`, lastModified: now, changeFrequency: "daily", priority: 0.8 });
    }
  }

  return entries;
}
