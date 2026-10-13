import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCity, getSport } from "@/lib/directory";
import { DirectoryShell, JsonLd } from "@/components/directory/directory-shell";
import { ListingView } from "@/components/directory/listing-view";
import { filterBySport, getCityDirectory, sportCounts } from "../../data";
import { listingJsonLd, listingMetadata } from "../../seo";

export const revalidate = 3600;

export async function generateStaticParams() {
  return [];
}

type Params = Promise<{ city: string; sport: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { city: citySlug, sport: sportSlug } = await params;
  const city = getCity(citySlug);
  const sport = getSport(sportSlug);
  if (!city || !sport) return { title: "Not found | Triq", robots: { index: false } };
  const items = filterBySport(await getCityDirectory(city.slug), sport.slug);
  return listingMetadata(city, sport, items);
}

export default async function CitySportDirectoryPage({ params }: { params: Params }) {
  const { city: citySlug, sport: sportSlug } = await params;
  const city = getCity(citySlug);
  const sport = getSport(sportSlug);
  if (!city || !sport) notFound();

  const all = await getCityDirectory(city.slug);
  const items = filterBySport(all, sport.slug);

  return (
    <DirectoryShell>
      {items.length > 0 && <JsonLd data={listingJsonLd(city, sport, items)} />}
      <ListingView city={city} sport={sport} items={items} counts={sportCounts(all)} />
    </DirectoryShell>
  );
}
