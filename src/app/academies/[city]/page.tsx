import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCity } from "@/lib/directory";
import { DirectoryShell, JsonLd } from "@/components/directory/directory-shell";
import { ListingView } from "@/components/directory/listing-view";
import { getCityDirectory, sportCounts } from "../data";
import { listingJsonLd, listingMetadata } from "../seo";

export const revalidate = 3600;

// Render on first request, then cache (ISR) — no DB access at build time.
export async function generateStaticParams() {
  return [];
}

type Params = Promise<{ city: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { city: citySlug } = await params;
  const city = getCity(citySlug);
  if (!city) return { title: "Not found | Triq", robots: { index: false } };
  const items = await getCityDirectory(city.slug);
  return listingMetadata(city, null, items);
}

export default async function CityDirectoryPage({ params }: { params: Params }) {
  const { city: citySlug } = await params;
  const city = getCity(citySlug);
  if (!city) notFound();

  const items = await getCityDirectory(city.slug);

  return (
    <DirectoryShell>
      {items.length > 0 && <JsonLd data={listingJsonLd(city, null, items)} />}
      <ListingView city={city} sport={null} items={items} counts={sportCounts(items)} />
    </DirectoryShell>
  );
}
