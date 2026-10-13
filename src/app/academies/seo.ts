import type { Metadata } from "next";
import {
  SITE_URL,
  type DirectoryCity,
  type DirectoryItem,
  type DirectorySport,
  listingHeading,
} from "@/lib/directory";

export function listingCanonical(city: DirectoryCity, sport: DirectorySport | null): string {
  return sport ? `/academies/${city.slug}/${sport.slug}` : `/academies/${city.slug}`;
}

export function listingMetadata(city: DirectoryCity, sport: DirectorySport | null, items: DirectoryItem[]): Metadata {
  const heading = listingHeading(city, sport);
  const what = sport ? `${sport.name.toLowerCase()} academies` : "sports academies";
  const title = `${heading} · Fees, Ratings & Free Trials | Triq`;
  const description =
    items.length > 0
      ? `Compare ${items.length} ${what} in ${city.name} by area and Google rating. See live batches & fees on Triq academies and book a free trial in under a minute.`
      : `Find ${what} in ${city.name}. Compare by area, rating and fees and book a free trial on Triq.`;
  const canonical = listingCanonical(city, sport);
  return {
    title,
    description,
    alternates: { canonical },
    // Thin pages (no data yet) shouldn't be indexed; they're still linkable.
    robots: items.length > 0 ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { title: heading, description, url: canonical, siteName: "Triq", type: "website", locale: "en_IN" },
    twitter: { card: "summary", title: heading, description },
  };
}

export function listingJsonLd(city: DirectoryCity, sport: DirectorySport | null, items: DirectoryItem[]) {
  const url = `${SITE_URL}${listingCanonical(city, sport)}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: listingHeading(city, sport),
      url,
      numberOfItems: items.length,
      itemListElement: items.slice(0, 100).map((i, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: `${SITE_URL}${i.href}`,
        name: i.name,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Academies", item: `${SITE_URL}/academies` },
        { "@type": "ListItem", position: 2, name: city.name, item: `${SITE_URL}/academies/${city.slug}` },
        ...(sport ? [{ "@type": "ListItem", position: 3, name: sport.name, item: url }] : []),
      ],
    },
  ];
}
