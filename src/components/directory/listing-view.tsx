import Link from "next/link";
import { ArrowRight, Building2, Sparkles } from "lucide-react";
import { CITIES, SPORTS, type DirectoryCity, type DirectoryItem, type DirectorySport, listingHeading } from "@/lib/directory";
import { Breadcrumbs } from "./directory-shell";
import { DirectoryGrid } from "./directory-grid";

/** Shared body for /academies/[city] and /academies/[city]/[sport]. Renders only DB data. */
export function ListingView({
  city,
  sport,
  items,
  counts,
}: {
  city: DirectoryCity;
  sport: DirectorySport | null;
  items: DirectoryItem[];
  /** sport slug → number of entries in this city (for chips). */
  counts: Record<string, number>;
}) {
  const heading = listingHeading(city, sport);
  const onTriq = items.filter((i) => i.kind === "org").length;
  const noun = sport ? `${sport.name.toLowerCase()} academ${items.length === 1 ? "y" : "ies"}` : `academ${items.length === 1 ? "y" : "ies"}`;
  const sportsWithData = SPORTS.filter((s) => (counts[s.slug] ?? 0) > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-4 pt-6 sm:px-6 sm:pt-10">
      <Breadcrumbs
        items={[
          { label: "Academies", href: "/academies" },
          sport ? { label: city.name, href: `/academies/${city.slug}` } : { label: city.name },
          ...(sport ? [{ label: sport.name }] : []),
        ]}
      />

      <header className="mt-4 max-w-3xl">
        <h1 className="text-balance text-[28px] font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
          {sport && <span className="mr-2 inline-block">{sport.emoji}</span>}
          {heading}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-zinc-400 sm:text-base">
          {items.length > 0 ? (
            <>
              {items.length} {noun} in {city.name}
              {onTriq > 0 && (
                <>
                  {" "}· <span className="text-lime-300">{onTriq} on Triq</span> with live batches &amp; fees
                </>
              )}
              . Compare by area and Google rating, then book a free trial in under a minute.
            </>
          ) : (
            <>Compare {sport ? `${sport.name.toLowerCase()} ` : ""}academies in {city.name} by area, rating and fees, and book a free trial.</>
          )}
        </p>
      </header>

      {/* Sport filter (real routes, crawlable) */}
      <nav aria-label="Filter by sport" className="mt-6">
        <ul className="flex min-w-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <li className="shrink-0">
            <SportChip href={`/academies/${city.slug}`} active={!sport}>
              All sports
            </SportChip>
          </li>
          {(sportsWithData.length ? sportsWithData : SPORTS).map((s) => (
            <li key={s.slug} className="shrink-0">
              <SportChip href={`/academies/${city.slug}/${s.slug}`} active={sport?.slug === s.slug}>
                <span aria-hidden>{s.emoji}</span> {s.name}
                {(counts[s.slug] ?? 0) > 0 && <span className="text-zinc-500">{counts[s.slug]}</span>}
              </SportChip>
            </li>
          ))}
        </ul>
      </nav>

      <section className="mt-6" aria-label="Academies">
        {items.length > 0 ? (
          <DirectoryGrid items={items} />
        ) : (
          <DirectoryEmptyState city={city} sport={sport} />
        )}
      </section>

      {items.length > 0 && <ListYourAcademyBand city={city} />}

      {/* Internal links for discovery/SEO */}
      <section className="mt-14 grid gap-8 border-t border-white/5 pt-10 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300">Popular in {city.name}</h2>
          <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm min-[420px]:grid-cols-2">
            {SPORTS.filter((s) => s.slug !== sport?.slug).map((s) => (
              <li key={s.slug} className="min-w-0">
                <Link href={`/academies/${city.slug}/${s.slug}`} className="block truncate text-zinc-500 hover:text-lime-300">
                  {s.name} academies in {city.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-300">Other cities</h2>
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {CITIES.filter((c) => c.slug !== city.slug).map((c) => (
              <li key={c.slug}>
                <Link
                  href={sport ? `/academies/${c.slug}/${sport.slug}` : `/academies/${c.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-zinc-400 hover:border-white/20 hover:text-white"
                >
                  {c.name}
                  {!c.live && <span className="text-[10px] uppercase tracking-wide text-zinc-600">soon</span>}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs leading-relaxed text-zinc-600">
            Academies marked &ldquo;On Triq&rdquo; publish their own batches, timings and fees. Other listings come from
            public sources; ratings shown are Google ratings where available.
          </p>
        </div>
      </section>
    </div>
  );
}

function SportChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition ${
        active
          ? "border-white bg-white text-zinc-950"
          : "border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/25 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}

export function DirectoryEmptyState({ city, sport }: { city: DirectoryCity; sport: DirectorySport | null }) {
  const what = sport ? `${sport.name.toLowerCase()} academies` : "academies";
  return (
    <div className="relative overflow-hidden rounded-3xl border border-dashed border-white/10 bg-zinc-900/40 px-5 py-12 text-center sm:px-10 sm:py-16">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/[0.04] text-3xl">
        {sport?.emoji ?? <Building2 className="size-6 text-zinc-400" />}
      </div>
      <h2 className="mx-auto mt-5 max-w-md text-balance text-xl font-semibold tracking-tight text-white">
        {city.live
          ? `We haven't listed any ${what} in ${city.name} yet`
          : `Triq is coming to ${city.name} soon`}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
        {city.live
          ? "We only show academies we can verify — no placeholder listings. New academies are being added every week."
          : `We're launching in Gurgaon first. ${city.name} listings will appear here as soon as academies join.`}
      </p>
      <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/register?ref=directory"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-lime-400 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-lime-300"
        >
          <Sparkles className="size-4" />
          Own an academy? List it free
        </Link>
        {sport ? (
          <Link href={`/academies/${city.slug}`} className="inline-flex h-11 items-center gap-1.5 px-3 text-sm font-medium text-zinc-300 hover:text-white">
            See all sports in {city.name} <ArrowRight className="size-4" />
          </Link>
        ) : !city.live ? (
          <Link href="/academies/gurgaon" className="inline-flex h-11 items-center gap-1.5 px-3 text-sm font-medium text-zinc-300 hover:text-white">
            Browse Gurgaon academies <ArrowRight className="size-4" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function ListYourAcademyBand({ city }: { city: DirectoryCity }) {
  return (
    <aside className="mt-12 flex flex-col gap-4 overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-r from-zinc-900 via-zinc-900/80 to-lime-400/[0.08] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div className="min-w-0">
        <p className="text-lg font-semibold tracking-tight text-white">Run an academy in {city.name}?</p>
        <p className="mt-1 text-sm text-zinc-400">
          Claim or add your free listing. Get trial requests on WhatsApp and show live batches &amp; fees.
        </p>
      </div>
      <Link
        href="/register?ref=directory"
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
      >
        List it free <ArrowRight className="size-4" />
      </Link>
    </aside>
  );
}
