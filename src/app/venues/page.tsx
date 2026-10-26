import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { rupees } from "@/lib/turf";
import { DISCOVERY_CITIES, DISCOVERY_SPORTS, buildVenueCards, parseDiscoveryQuery } from "@/lib/venue-discovery";

/**
 * TRIQ Spaces public venue discovery (flag spacesDiscovery). Lists only venues that can actually be
 * booked on TRIQ (active org + active priced court) and links to their /book page. No sample data:
 * an empty result is shown as empty.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book a court or turf near you | Triq",
  description: "Find turfs and courts by city and sport, see prices and book a slot online.",
  robots: { index: false, follow: true }, // opt in to indexing once the listing has real coverage
};

type SP = Promise<{ city?: string | string[]; sport?: string | string[]; page?: string | string[] }>;

function href(city: string | null, sport: string | null, page = 1) {
  const p = new URLSearchParams();
  if (city) p.set("city", city);
  if (sport) p.set("sport", sport);
  if (page > 1) p.set("page", String(page));
  const q = p.toString();
  return q ? `/venues?${q}` : "/venues";
}

export default async function VenuesPage({ searchParams }: { searchParams: SP }) {
  if (!FEATURES.spacesDiscovery) notFound();
  const filters = parseDiscoveryQuery(await searchParams);

  let result: ReturnType<typeof buildVenueCards> | null = null;
  try {
    const facilities = await db.facility.findMany({
      where: { isActive: true, hourlyRate: { gt: 0 }, orgId: { not: null } },
      select: { orgId: true, type: true, hourlyRate: true },
      take: 5000,
    });
    const orgIds = [...new Set(facilities.map((f) => f.orgId as string))];
    const orgs = orgIds.length
      ? await db.organization.findMany({
          where: { id: { in: orgIds }, isActive: true },
          select: { id: true, slug: true, name: true, city: true, sport: true, photos: true },
        })
      : [];
    result = buildVenueCards(orgs, facilities.map((f) => ({ orgId: f.orgId as string, type: f.type, hourlyRate: f.hourlyRate })), filters);
  } catch (e) {
    console.error("[venues] listing failed", e instanceof Error ? e.message : e);
  }

  const citySlug = filters.city?.slug ?? null;
  const sportSlug = filters.sport?.slug ?? null;
  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-xs ${active ? "border-lime-400 bg-lime-400 text-zinc-950" : "border-zinc-800 text-zinc-300 hover:border-zinc-600"}`;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Book a court or turf</h1>
          <p className="text-sm text-zinc-400 mt-1">Venues that take bookings on Triq. Pick a city or sport, then choose a free slot.</p>
        </header>

        <nav aria-label="City" className="flex gap-2 overflow-x-auto pb-1">
          <Link className={chip(!citySlug)} href={href(null, sportSlug)}>All cities</Link>
          {DISCOVERY_CITIES.map((c) => (
            <Link key={c.slug} className={chip(citySlug === c.slug)} href={href(c.slug, sportSlug)}>
              {c.name}
            </Link>
          ))}
        </nav>
        <nav aria-label="Sport" className="flex gap-2 overflow-x-auto pb-1">
          <Link className={chip(!sportSlug)} href={href(citySlug, null)}>All sports</Link>
          {DISCOVERY_SPORTS.map((s) => (
            <Link key={s.slug} className={chip(sportSlug === s.slug)} href={href(citySlug, s.slug)}>
              {s.emoji} {s.name}
            </Link>
          ))}
        </nav>

        {!result ? (
          <p className="text-sm text-zinc-400">Couldn&apos;t load venues right now. Please try again.</p>
        ) : result.total === 0 ? (
          <p className="text-sm text-zinc-400">No bookable venues match yet{citySlug || sportSlug ? " — try removing a filter" : ""}.</p>
        ) : (
          <>
            <p className="text-xs text-zinc-500">
              {result.total} venue{result.total === 1 ? "" : "s"}
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {result.cards.map((v) => (
                <li key={v.slug}>
                  <Link href={`/book/${v.slug}`} className="block h-full rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden hover:border-lime-400/50">
                    {v.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.photo} alt="" className="h-36 w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="h-36 w-full bg-gradient-to-br from-zinc-800 to-zinc-900" aria-hidden />
                    )}
                    <div className="p-4 space-y-1">
                      <p className="font-semibold">{v.name}</p>
                      <p className="text-xs text-zinc-400 flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {v.city}
                        {v.sport ? ` · ${v.sport}` : ""}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {v.courts} court{v.courts === 1 ? "" : "s"} · from <span className="text-lime-300 font-medium">{rupees(v.fromPrice)}/hr</span>
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {result.totalPages > 1 && (
              <nav aria-label="Pages" className="flex justify-between text-sm">
                {result.page > 1 ? <Link className="text-lime-300" href={href(citySlug, sportSlug, result.page - 1)}>← Previous</Link> : <span />}
                <span className="text-zinc-500">
                  Page {result.page} of {result.totalPages}
                </span>
                {result.page < result.totalPages ? <Link className="text-lime-300" href={href(citySlug, sportSlug, result.page + 1)}>Next →</Link> : <span />}
              </nav>
            )}
          </>
        )}
      </div>
    </main>
  );
}
