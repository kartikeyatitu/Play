import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, MapPin, PlayCircle, School, Trees, Trophy } from "lucide-react";
import { FOUNDING_OFFER, FREE_PLAN } from "@/lib/pricing";
import { MarketingShell, SectionHeading, WhatsAppButton, primaryCta, secondaryCta } from "@/components/marketing/shell";
import { Marquee, MigrationSteps } from "@/components/marketing/sections";
import { DemoSection, buildUtm } from "@/components/marketing/demo-section";
import { ProductMock } from "@/components/marketing/product-mock";

const city = "Noida";
const title = `Sports academy & turf software for ${city} — Triq`;
const description = `Built for ${city} academy and turf owners: attendance, fees, parent updates, free trials and slot bookings from your phone. Free up to ${FREE_PLAN.maxStudents} students, and we import your data for free.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/noida" },
  keywords: [
    "sports academy software Noida",
    "academy management app Noida",
    "turf booking software Noida",
    "cricket academy Noida",
    "fee reminder app coaches",
    "Triq",
  ],
  openGraph: { title, description, url: "/noida", siteName: "Triq", type: "website", locale: "en_IN" },
  twitter: { card: "summary_large_image", title, description },
};

const AREAS = [
  "Sector 62",
  "Sector 137",
  "Greater Noida",
  "Noida Extension",
  "Sector 18",
  "Sector 50",
  "Sector 78",
  "Sector 150",
];

const VENUES = [
  { icon: Building2, title: "Society & RWA batches", body: "Coaching inside Noida societies, with parents who expect clear updates on fees and attendance." },
  { icon: School, title: "School grounds", body: "After-school batches across schools, each with its own timings and fees." },
  { icon: Trees, title: "Turfs & courts", body: "Run slot bookings next to your academy batches, so one phone shows the whole ground." },
  { icon: Trophy, title: "Clubs & full academies", body: "Multiple coaches and sports, with fees and attendance for every child in one place." },
];

export default async function NoidaPage({
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
              <MapPin className="h-3.5 w-3.5" aria-hidden /> Open to {city} &amp; Greater Noida owners
            </p>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-zinc-50 sm:text-5xl lg:text-6xl">
              Built for{" "}
              <span className="bg-gradient-to-r from-lime-300 via-lime-400 to-emerald-400 bg-clip-text text-transparent">{city} academies &amp; turfs.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg lg:mx-0">
              Whether you coach in a society in Sector 137, run a school batch in Sector 62 or manage a turf in Noida Extension, Triq puts attendance,
              fees, parent updates and slot bookings on your phone. Free up to {FREE_PLAN.maxStudents} students.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Link href="/login" className={primaryCta}>
                Start free <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <a href="#demo" className={secondaryCta}>
                <PlayCircle className="h-4 w-4" aria-hidden /> Book a free walkthrough
              </a>
            </div>
            <WhatsAppButton message={`Hi! I run an academy or turf in ${city} and want to know more about Triq.`} className="mt-3" />
          </div>
          <ProductMock />
        </div>
      </section>

      {/* Areas */}
      <section className="border-y border-white/5 py-8" aria-labelledby="areas-heading">
        <h2 id="areas-heading" className="mb-5 px-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
          Areas we&apos;re working in
        </h2>
        <Marquee items={AREAS.map((a) => `📍 ${a}`)} label={`Areas of ${city} we serve`} />
      </section>

      {/* What you get */}
      <section className="px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow={`For ${city} owners`}
            title="One app for the academy and the ground."
            description="No fake countdown timers, no hidden charges. Start free and pay only when you grow."
          />
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { k: `Free to ${FREE_PLAN.maxStudents}`, v: `Up to ${FREE_PLAN.maxStudents} active students are free. No credit card needed.` },
              { k: "Free data import", v: "Send us your register, Excel or WhatsApp list and we move it into Triq for you." },
              { k: "Academy + turf", v: "Batches and slot bookings in the same place, so a batch never clashes with a booking." },
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
          <SectionHeading eyebrow={`How ${city} coaches work`} title="However you coach, it fits." />
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

      {/* Gurgaon cross-link + trust list */}
      <section className="px-4 pb-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="text-lg font-semibold text-zinc-50">Ready to set up your academy?</h2>
            <p className="mt-1 text-sm text-zinc-400">Sign up free, add your batches and students — we&apos;ll help you import your existing list.</p>
          </div>
          <Link href="/login" className={secondaryCta + " shrink-0"}>
            Start free <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <ul className="mx-auto mt-6 flex max-w-6xl flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-400">
          {["Hindi & English support from our team", "Works with your existing UPI", `Also available in ${FOUNDING_OFFER.city}`].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-lime-400" aria-hidden /> {t}
            </li>
          ))}
        </ul>
      </section>

      <DemoSection
        utm={buildUtm(params, "/noida")}
        title={`Talk to us about ${city}`}
        description="Tell us a little about your academy or turf. We'll WhatsApp you within one working day and, if you like, help you set up."
        defaultCity={city}
      />
    </MarketingShell>
  );
}
