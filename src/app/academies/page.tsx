import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin, Sparkles, Star, Zap, MessageCircle } from "lucide-react";
import { CITIES, SITE_URL, SPORTS, getCity } from "@/lib/directory";
import { DirectoryShell, JsonLd } from "@/components/directory/directory-shell";
import { getCityDirectory, sportCounts } from "./data";

export const revalidate = 3600;

const LAUNCH_CITY = getCity("gurgaon")!;

export const metadata: Metadata = {
  title: "Find Sports Academies Near You · Compare & Book Free Trials | Triq",
  description:
    "Discover cricket, football, badminton, swimming, tennis and more academies in Gurgaon. Compare by area and Google rating, see live batches & fees, and book a free trial.",
  alternates: { canonical: "/academies" },
  openGraph: {
    title: "Find the right sports academy for your child | Triq",
    description: "Compare academies in Gurgaon by area, rating and fees. Book a free trial in under a minute.",
    url: "/academies",
    siteName: "Triq",
    type: "website",
    locale: "en_IN",
  },
};

export default async function AcademiesHomePage() {
  let counts: Record<string, number> = {};
  let total = 0;
  try {
    const items = await getCityDirectory(LAUNCH_CITY.slug);
    counts = sportCounts(items);
    total = items.length;
  } catch (e) {
    // Never fail the landing page on a DB hiccup — tiles still work without counts.
    console.error("[directory] home counts failed", e);
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Sports academies directory",
    url: `${SITE_URL}/academies`,
    hasPart: SPORTS.map((s) => ({
      "@type": "WebPage",
      name: `${s.name} academies in ${LAUNCH_CITY.name}`,
      url: `${SITE_URL}/academies/${LAUNCH_CITY.slug}/${s.slug}`,
    })),
  };

  return (
    <DirectoryShell>
      <JsonLd data={jsonLd} />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Hero */}
        <section className="pb-10 pt-10 sm:pb-14 sm:pt-20">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/25 bg-lime-400/[0.06] px-3 py-1 text-xs font-medium text-lime-300">
            <MapPin className="size-3.5" /> Now live in {LAUNCH_CITY.name}
          </p>
          <h1 className="mt-5 max-w-3xl text-balance text-[34px] font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl">
            Find the right sports academy for your child
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-zinc-400 sm:text-lg">
            Compare academies by area and rating, see live batches &amp; fees where available, and book a free trial —
            no calls, no spam.
          </p>

          {/* City picker */}
          <div className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Choose your city</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {CITIES.map((c) =>
                c.live ? (
                  <li key={c.slug}>
                    <Link
                      href={`/academies/${c.slug}`}
                      className="group inline-flex h-11 items-center gap-2 rounded-full bg-white pl-4 pr-3 text-sm font-semibold text-zinc-950 transition hover:bg-lime-300"
                    >
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime-500 opacity-60" />
                        <span className="relative inline-flex size-2 rounded-full bg-lime-500" />
                      </span>
                      {c.name}
                      {total > 0 && <span className="font-normal text-zinc-500">{total}</span>}
                      <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ) : (
                  <li key={c.slug}>
                    <span
                      aria-disabled="true"
                      className="inline-flex h-11 cursor-default items-center gap-2 rounded-full border border-white/[0.07] px-4 text-sm text-zinc-500"
                    >
                      {c.name}
                      <span className="rounded-full bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                        Coming soon
                      </span>
                    </span>
                  </li>
                ),
              )}
            </ul>
          </div>
        </section>

        {/* Sport tiles */}
        <section aria-labelledby="sports-heading">
          <div className="flex items-end justify-between gap-4">
            <h2 id="sports-heading" className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Browse by sport in {LAUNCH_CITY.name}
            </h2>
            <Link href={`/academies/${LAUNCH_CITY.slug}`} className="hidden shrink-0 text-sm text-zinc-400 hover:text-white sm:inline">
              All academies →
            </Link>
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {SPORTS.map((s) => {
              const n = counts[s.slug] ?? 0;
              return (
                <li key={s.slug} className="min-w-0">
                  <Link
                    href={`/academies/${LAUNCH_CITY.slug}/${s.slug}`}
                    className="group relative flex h-full min-h-[112px] flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.06] bg-zinc-900/60 p-4 transition hover:-translate-y-0.5 hover:border-white/15 hover:bg-zinc-900"
                  >
                    <span className="text-3xl transition duration-300 group-hover:scale-110" aria-hidden>
                      {s.emoji}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold tracking-tight text-white">{s.name}</span>
                      <span className="block truncate text-xs text-zinc-500">
                        {n > 0 ? `${n} academ${n === 1 ? "y" : "ies"}` : "Explore"}
                      </span>
                    </span>
                    <ArrowRight className="absolute right-3 top-3 size-4 text-zinc-700 transition group-hover:text-lime-300" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* How it works */}
        <section className="mt-16 grid gap-3 sm:grid-cols-3">
          {[
            { icon: Star, title: "Compare honestly", text: "Real Google ratings and review counts — never invented. Academies on Triq show live batches & fees." },
            { icon: Zap, title: "Book a free trial", text: "Send one request in under a minute. No sign-up needed." },
            { icon: MessageCircle, title: "Hear back on WhatsApp", text: "The academy (or our team) confirms a slot with you on WhatsApp." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-white/[0.06] bg-zinc-900/40 p-5">
              <span className="grid size-9 place-items-center rounded-xl bg-lime-400/10 text-lime-300">
                <Icon className="size-4" />
              </span>
              <h3 className="mt-3 text-[15px] font-semibold text-white">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">{text}</p>
            </div>
          ))}
        </section>

        {/* Owner CTA */}
        <section className="mt-12 overflow-hidden rounded-3xl border border-lime-400/20 bg-gradient-to-br from-lime-400/[0.10] via-zinc-900/70 to-zinc-900/60 p-6 sm:p-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 max-w-xl">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-lime-300">
                <Sparkles className="size-3.5" /> For academy owners
              </p>
              <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Own an academy? List it free.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Already listed? Open your academy&apos;s page and tap &ldquo;Claim it free&rdquo;. Get trial requests on WhatsApp and run
                attendance &amp; fees on Triq.
              </p>
            </div>
            <Link
              href="/register?ref=directory"
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-lime-400 px-6 text-[15px] font-semibold text-zinc-950 transition hover:bg-lime-300"
            >
              List your academy <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </div>
    </DirectoryShell>
  );
}
