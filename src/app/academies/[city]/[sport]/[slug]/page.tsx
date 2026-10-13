import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowUpRight, Globe, Instagram, MapPin, Navigation, Info, Clock, ShieldCheck, Zap } from "lucide-react";
import { db } from "@/lib/db";
import {
  SITE_URL,
  externalUrl,
  getCity,
  getSport,
  instagramUrl,
  listingPath,
  mapsLink,
  parseSports,
  sportName,
} from "@/lib/directory";
import { Breadcrumbs, DirectoryShell, JsonLd } from "@/components/directory/directory-shell";
import { AcademyCard, RatingLine } from "@/components/directory/academy-card";
import { TrialRequestForm } from "@/components/directory/trial-request-form";
import { ClaimListing } from "@/components/directory/claim-listing";
import { filterBySport, getCityDirectory, getListedAcademy } from "../../../data";

export const revalidate = 3600;

export async function generateStaticParams() {
  return [];
}

type Params = Promise<{ city: string; sport: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { city: citySlug, slug } = await params;
  const city = getCity(citySlug);
  const listing = await getListedAcademy(slug);
  if (!city || !listing || listing.city !== city.slug) {
    return { title: "Academy | Triq", robots: { index: false, follow: true } };
  }
  const sports = parseSports(listing.sports);
  const primary = sports[0] ? sportName(sports[0]) : "Sports";
  const place = [listing.area, city.name].filter(Boolean).join(", ");
  const title = `${listing.name} · ${primary} academy in ${place} | Triq`;
  const ratingText =
    listing.rating != null
      ? ` Rated ${listing.rating.toFixed(1)}★ on Google${listing.ratingCount ? ` (${listing.ratingCount} reviews)` : ""}.`
      : "";
  const description = `${listing.name} in ${place}: ${
    sports.length ? sports.map(sportName).join(", ") : "sports"
  } coaching.${ratingText} See location and book a free trial on Triq.`;
  const canonical = listingPath(city.slug, sports, listing.slug);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title: `${listing.name} · ${place}`, description, url: canonical, siteName: "Triq", type: "website", locale: "en_IN" },
    twitter: { card: "summary", title: `${listing.name} · ${place}`, description },
  };
}

export default async function ListedAcademyPage({ params }: { params: Params }) {
  const { city: citySlug, sport: sportSlug, slug } = await params;
  const city = getCity(citySlug);
  if (!city) notFound();

  // A Triq academy with this slug → its live public page (real batches, fees & trial booking).
  const org = await db.organization.findUnique({ where: { slug }, select: { slug: true, isActive: true } });
  if (org?.isActive) redirect(`/academy/${org.slug}`);

  const listing = await getListedAcademy(slug);
  if (!listing) notFound();

  const sports = parseSports(listing.sports);
  const canonical = listingPath(listing.city, sports, listing.slug);

  // Claimed by a live Triq academy → send parents to the managed page.
  if (listing.claimStatus === "CLAIMED" && listing.claimedOrgId) {
    const claimedOrg = await db.organization.findFirst({
      where: { id: listing.claimedOrgId, isActive: true },
      select: { slug: true },
    });
    if (claimedOrg) redirect(`/academy/${claimedOrg.slug}`);
  }

  // Wrong city or a sport this academy doesn't list → canonical URL.
  const sportOk = sports.length ? sports.includes(sportSlug) : sportSlug === "multi-sport";
  if (listing.city !== city.slug || !sportOk) {
    if (getCity(listing.city)) redirect(canonical);
    notFound();
  }

  const activeSport = getSport(sports.includes(sportSlug) ? sportSlug : sports[0]) ?? getSport("multi-sport")!;
  const website = externalUrl(listing.website);
  const insta = instagramUrl(listing.instagram);
  const mapUrl = mapsLink({
    name: listing.name,
    address: listing.address,
    area: listing.area,
    cityName: city.name,
    placeId: listing.googlePlaceId,
  });
  const place = [listing.area, city.name].filter(Boolean).join(", ");

  // Nearby / similar (real DB rows only), same sport, same area first.
  let similar: Awaited<ReturnType<typeof getCityDirectory>> = [];
  try {
    const pool = filterBySport(await getCityDirectory(city.slug), activeSport.slug).filter(
      (i) => !(i.kind === "listed" && i.id === listing.id),
    );
    const sameArea = listing.area ? pool.filter((i) => i.area && i.area === listing.area) : [];
    similar = [...sameArea, ...pool.filter((i) => !sameArea.includes(i))].slice(0, 3);
  } catch (e) {
    console.error("[directory] similar academies failed", e);
  }

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SportsActivityLocation",
      name: listing.name,
      url: `${SITE_URL}${canonical}`,
      ...(listing.address || listing.area
        ? {
            address: {
              "@type": "PostalAddress",
              streetAddress: listing.address ?? listing.area ?? undefined,
              addressLocality: city.name,
              addressRegion: city.region,
              addressCountry: city.country,
            },
          }
        : {}),
      ...(listing.lat != null && listing.lng != null
        ? { geo: { "@type": "GeoCoordinates", latitude: listing.lat, longitude: listing.lng } }
        : {}),
      hasMap: mapUrl,
      ...(website || insta ? { sameAs: [website, insta].filter(Boolean) } : {}),
      ...(sports.length ? { sport: sports.map(sportName) } : {}),
      // NOTE: no aggregateRating — Google ratings are third-party and not eligible for review markup.
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Academies", item: `${SITE_URL}/academies` },
        { "@type": "ListItem", position: 2, name: city.name, item: `${SITE_URL}/academies/${city.slug}` },
        { "@type": "ListItem", position: 3, name: activeSport.name, item: `${SITE_URL}/academies/${city.slug}/${activeSport.slug}` },
        { "@type": "ListItem", position: 4, name: listing.name, item: `${SITE_URL}${canonical}` },
      ],
    },
  ];

  return (
    <DirectoryShell>
      <JsonLd data={jsonLd} />
      <div className="mx-auto max-w-6xl px-4 pb-4 pt-6 sm:px-6 sm:pt-10">
        <Breadcrumbs
          items={[
            { label: "Academies", href: "/academies" },
            { label: city.name, href: `/academies/${city.slug}` },
            { label: activeSport.name, href: `/academies/${city.slug}/${activeSport.slug}` },
            { label: listing.name },
          ]}
        />

        {/* Header */}
        <header className="mt-5 flex min-w-0 items-start gap-4">
          <div className="grid size-16 shrink-0 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-lime-400/20 to-zinc-900 text-3xl sm:size-20 sm:text-4xl">
            <span aria-hidden>{activeSport.emoji}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-[26px] font-semibold leading-tight tracking-tight text-white sm:text-4xl">
              {listing.name}
            </h1>
            <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-sm text-zinc-400">
              <MapPin className="size-4 shrink-0 text-zinc-500" />
              <span className="truncate">{place}</span>
            </p>
            <RatingLine rating={listing.rating} count={listing.ratingCount} className="mt-1.5 text-sm" />
            {sports.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {sports.map((s) => (
                  <li key={s}>
                    <Link
                      href={`/academies/${city.slug}/${s}`}
                      className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-2 py-1 text-xs font-medium text-zinc-300 ring-1 ring-inset ring-white/[0.06] hover:text-white"
                    >
                      <span aria-hidden>{getSport(s)?.emoji}</span> {sportName(s)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
          {/* Trial card — first on mobile, sticky right column on desktop */}
          <aside id="trial" className="min-w-0 scroll-mt-20 lg:col-start-2 lg:row-start-1">
            <div className="rounded-3xl border border-white/[0.08] bg-zinc-900/70 p-5 shadow-2xl shadow-black/40 sm:p-6 lg:sticky lg:top-20">
              <div className="mb-4 flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-xl bg-lime-400/15 text-lime-300">
                  <Zap className="size-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold tracking-tight text-white">Book a free trial</h2>
                  <p className="text-xs text-zinc-500">Takes under a minute · no sign-up</p>
                </div>
              </div>
              <TrialRequestForm
                listedAcademyId={listing.id}
                academyName={listing.name}
                sports={sports.length ? sports : [activeSport.slug]}
                defaultSport={activeSport.slug}
              />
            </div>
          </aside>

          <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
            {/* Location */}
            <section className="rounded-3xl border border-white/[0.06] bg-zinc-900/60 p-5 sm:p-6">
              <h2 className="text-base font-semibold tracking-tight text-white">Location &amp; links</h2>
              {listing.address && <p className="mt-2 break-words text-sm leading-relaxed text-zinc-400">{listing.address}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
                >
                  <Navigation className="size-4" /> Open in Google Maps
                </a>
                {website && (
                  <a
                    href={website}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-medium text-zinc-200 transition hover:border-white/25"
                  >
                    <Globe className="size-4" /> Website <ArrowUpRight className="size-3.5 text-zinc-500" />
                  </a>
                )}
                {insta && (
                  <a
                    href={insta}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-medium text-zinc-200 transition hover:border-white/25"
                  >
                    <Instagram className="size-4" /> Instagram <ArrowUpRight className="size-3.5 text-zinc-500" />
                  </a>
                )}
              </div>
            </section>

            {/* Honest info */}
            <section className="rounded-3xl border border-white/[0.06] bg-zinc-900/60 p-5 sm:p-6">
              <h2 className="text-base font-semibold tracking-tight text-white">Batches, timings &amp; fees</h2>
              <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-zinc-400">
                <Info className="mt-0.5 size-4 shrink-0 text-zinc-500" />
                {listing.name} hasn&apos;t published batches or fees on Triq yet. Mention your preferred timings in the trial
                request and we&apos;ll get the details for you.
              </p>
              <dl className="mt-5 grid grid-cols-1 gap-3 text-sm min-[420px]:grid-cols-2">
                <div className="rounded-2xl bg-white/[0.03] p-3.5">
                  <dt className="text-xs text-zinc-500">Area</dt>
                  <dd className="mt-0.5 truncate font-medium text-zinc-200">{listing.area || city.name}</dd>
                </div>
                <div className="rounded-2xl bg-white/[0.03] p-3.5">
                  <dt className="text-xs text-zinc-500">Listing status</dt>
                  <dd className="mt-0.5 flex items-center gap-1.5 font-medium text-zinc-200">
                    {listing.claimStatus === "PENDING" ? (
                      <>
                        <Clock className="size-3.5 text-amber-400" /> Claim under review
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="size-3.5 text-zinc-500" /> Public listing · unclaimed
                      </>
                    )}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-[11px] leading-relaxed text-zinc-600">
                Compiled from public sources{listing.rating != null ? "; rating from Google" : ""}. Last updated{" "}
                {listing.updatedAt.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}.
              </p>
            </section>

            <ClaimListing listedAcademyId={listing.id} academyName={listing.name} claimStatus={listing.claimStatus} />
          </div>
        </div>

        {similar.length > 0 && (
          <section className="mt-14">
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-xl font-semibold tracking-tight text-white">
                More {activeSport.name.toLowerCase()} academies in {city.name}
              </h2>
              <Link
                href={`/academies/${city.slug}/${activeSport.slug}`}
                className="hidden shrink-0 text-sm text-zinc-400 hover:text-white sm:inline"
              >
                See all →
              </Link>
            </div>
            <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((item) => (
                <li key={`${item.kind}-${item.id}`} className="min-w-0">
                  <AcademyCard item={item} />
                </li>
              ))}
            </ul>
            <Link
              href={`/academies/${city.slug}/${activeSport.slug}`}
              className="mt-4 inline-flex text-sm text-zinc-400 hover:text-white sm:hidden"
            >
              See all {activeSport.name.toLowerCase()} academies →
            </Link>
          </section>
        )}
      </div>
    </DirectoryShell>
  );
}
