import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, MapPin, School, Trees, Trophy } from "lucide-react";
import { FOUNDING_OFFER, FREE_PLAN, GROWTH_PLAN, formatINR } from "@/lib/pricing";
import { MarketingShell, SectionHeading, WhatsAppButton, primaryCta, secondaryCta } from "@/components/marketing/shell";
import { Marquee, MigrationSteps } from "@/components/marketing/sections";
import { DemoSection, buildUtm } from "@/components/marketing/demo-section";
import { ProductMock } from "@/components/marketing/product-mock";

const city = FOUNDING_OFFER.city;
const title = `Sports academy software for ${city} — Triq founding offer`;
const description = `Built for ${city} academies: attendance, fees, parent updates and free trials from your phone. First ${FOUNDING_OFFER.slots} academies get ${FOUNDING_OFFER.discountPercent}% off for ${FOUNDING_OFFER.months} months + free migration in ${FOUNDING_OFFER.migrationHours} hours.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/gurgaon" },
  keywords: ["sports academy software Gurgaon", "academy management app Gurugram", "cricket academy Gurgaon", "fee reminder app coaches", "Triq"],
  openGraph: { title, description, url: "/gurgaon", siteName: "Triq", type: "website", locale: "en_IN" },
  twitter: { card: "summary_large_image", title, description },
};

const AREAS = [
  "Golf Course Road",
  "Golf Course Extension Road",
  "Sectors 48–74",
  "Sohna Road",
  "DLF Phases 1–5",
  "Sushant Lok",
  "South City",
  "Nirvana Country",
  "Palam Vihar",
  "New Gurgaon (Sectors 76–95)",
  "Dwarka Expressway",
  "MG Road",
];

const VENUES = [
  { icon: Building2, title: "Society & RWA batches", body: "Coaching inside gated societies, with parents who expect app-level updates." },
  { icon: School, title: "School grounds", body: "After-school batches across multiple schools, each with its own timings." },
  { icon: Trees, title: "Turfs & open grounds", body: "Booked slots on Hudle/Playo turfs — Triq runs the academy on top." },
  { icon: Trophy, title: "Clubs & full academies", body: "Multiple coaches, sports and centres, with fees and reports for every child." },
];

export default async function GurgaonPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <MarketingShell>
      {/* Hero */}
      <section className="relative isolate px-4 pb-16 pt-12 sm:px-6 sm:pt-20">
        <div className="mk-grid pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div className="text-center lg:text-left">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-200">
              <MapPin className="h-3.5 w-3.5" aria-hidden /> Launching in {city} / Gurugram
            </p>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-zinc-50 sm:text-5xl lg:text-6xl">
              Built for{" "}
              <span className="bg-gradient-to-r from-lime-300 via-lime-400 to-emerald-400 bg-clip-text text-transparent">{city} academies.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg lg:mx-0">
              Whether you coach in a society, a school ground or a turf on Golf Course Extension, Triq puts attendance, fees and parent
              updates on your phone. We&apos;re onboarding our first {FOUNDING_OFFER.slots} {city} academies personally.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <a href="#demo" className={primaryCta}>
                Apply as a founding academy <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
              <Link href="/register" className={secondaryCta}>
                Start free
              </Link>
            </div>
            <WhatsAppButton message={`Hi! I run an academy in ${city} and want to know about the founding offer.`} className="mt-3" />
          </div>
          <ProductMock />
        </div>
      </section>

      {/* Areas */}
      <section className="border-y border-white/5 py-8" aria-labelledby="areas-heading">
        <h2 id="areas-heading" className="mb-5 px-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
          Areas we&apos;re visiting in person
        </h2>
        <Marquee items={AREAS.map((a) => `📍 ${a}`)} label={`Areas of ${city} we serve`} />
      </section>

      {/* Founding offer */}
      <section className="px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow="Founding offer"
            title={`First ${FOUNDING_OFFER.slots} ${city} academies get our best price, ever.`}
            description={`No fake countdown timers. When the ${FOUNDING_OFFER.slots} slots are filled, the offer closes.`}
          />
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                k: `${FOUNDING_OFFER.discountPercent}% off`,
                v: `for ${FOUNDING_OFFER.months} months on Growth — that's ${formatINR(GROWTH_PLAN.perStudentMonthly * (1 - FOUNDING_OFFER.discountPercent / 100))} per active student.`,
              },
              { k: `${FOUNDING_OFFER.migrationHours}h migration`, v: "We move your registers, Excel and WhatsApp groups into Triq for free." },
              { k: "Free forever", v: `if you have up to ${FREE_PLAN.maxStudents} active students. Founding perks still apply as you grow.` },
            ].map((x) => (
              <div key={x.k} className="mk-reveal rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6">
                <p className="text-3xl font-bold tracking-tight text-lime-400">{x.k}</p>
                <p className="mt-2 text-sm text-zinc-400">{x.v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Venues */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow="How Gurgaon coaches work" title="However you coach, it fits." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VENUES.map((v) => (
              <div key={v.title} className="mk-reveal rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6">
                <v.icon className="h-5 w-5 text-lime-400" aria-hidden />
                <h3 className="mt-4 font-semibold text-zinc-50">{v.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MigrationSteps />

      {/* Directory link */}
      <section className="px-4 pb-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="text-lg font-semibold text-zinc-50">Looking for an academy in {city}?</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Browse sports academies across {city} — and if you run one, check your listing.
            </p>
          </div>
          <Link href="/academies/gurgaon" className={secondaryCta + " shrink-0"}>
            Find academies in {city} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <ul className="mx-auto mt-6 flex max-w-6xl flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-400">
          {["Hindi & English support from our team", "In-person setup visit available", "Works with your existing UPI"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-lime-400" aria-hidden /> {t}
            </li>
          ))}
        </ul>
      </section>

      <DemoSection
        utm={buildUtm(params, "/gurgaon")}
        title={`Apply as a ${city} founding academy`}
        description="Tell us a little about your academy. We'll WhatsApp you within one working day and, if you like, visit you at the ground."
        defaultCity={city}
      />
    </MarketingShell>
  );
}
