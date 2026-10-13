import Link from "next/link";
import {
  ArrowRight,
  BadgeIndianRupee,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardPaste,
  Globe,
  HeartPulse,
  LineChart,
  Plus,
  ShieldAlert,
  Smartphone,
  Swords,
  Timer,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOUNDING_OFFER, FREE_PLAN, GROWTH_PLAN, formatINR } from "@/lib/pricing";
import { SectionHeading, WhatsAppButton, primaryCta, secondaryCta } from "./shell";

/* ------------------------------------------------------------------ */
/* Sports marquee — honest "built for any sport" strip instead of fake logos */
/* ------------------------------------------------------------------ */

const SPORTS = [
  "🏏 Cricket",
  "⚽ Football",
  "🏸 Badminton",
  "🎾 Tennis",
  "🏊 Swimming",
  "🏀 Basketball",
  "🏓 Table tennis",
  "⛸️ Skating",
  "🥋 Martial arts",
  "🏃 Athletics",
  "🏑 Hockey",
  "♟️ Chess",
];

export function Marquee({ items, label }: { items: string[]; label: string }) {
  const row = (dup: boolean) => (
    <ul className={cn("flex shrink-0 items-center gap-3 pr-3", dup && "mk-marquee-dup")} aria-hidden={dup || undefined}>
      {items.map((s) => (
        <li key={s} className="whitespace-nowrap rounded-full border border-zinc-800 bg-zinc-900/60 px-4 py-2 text-sm text-zinc-300">
          {s}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="mk-marquee overflow-hidden" role="region" aria-label={label}>
      <div className="mk-marquee-track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

export function SportsStrip() {
  return (
    <section className="border-y border-white/5 bg-zinc-950 py-8">
      <p className="mb-5 px-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
        Built for coaches of every sport
      </p>
      <Marquee items={SPORTS} label="Sports supported" />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Problem → 3 outcomes (goals, not stats) */
/* ------------------------------------------------------------------ */

const PAINS = [
  "Attendance in a register that gets wet at the ground",
  "Chasing fees on the 10th of every month",
  "Five WhatsApp groups and a hundred “sir, is there class today?”",
  "An Excel sheet only one person understands",
];

const OUTCOMES = [
  {
    icon: BadgeIndianRupee,
    title: "Fees collected on time",
    body: "One-tap WhatsApp reminders with UPI / online payment links, and a live list of who has paid — so you stop being the debt collector.",
    accent: "text-lime-400 bg-lime-400/10",
  },
  {
    icon: Bell,
    title: "Parents informed automatically",
    body: "Attendance, coach notes, schedule changes and progress reports reach parents without you typing a single broadcast.",
    accent: "text-emerald-400 bg-emerald-400/10",
  },
  {
    icon: Timer,
    title: "30 minutes back, every coach, every day",
    body: "That's our design goal: attendance in seconds, no manual follow-ups, and one app instead of registers, Excel and groups.",
    accent: "text-amber-300 bg-amber-300/10",
  },
];

export function ProblemOutcomes() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mk-reveal mx-auto mb-14 max-w-3xl rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Sound familiar?</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {PAINS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm text-zinc-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <SectionHeading
          eyebrow="What Triq is for"
          title="You coach. Triq handles the admin."
          description="Three outcomes we build every feature around."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {OUTCOMES.map((o) => (
            <div key={o.title} className="mk-reveal rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-7">
              <span className={cn("mb-5 flex h-11 w-11 items-center justify-center rounded-2xl", o.accent)}>
                <o.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="text-lg font-semibold text-zinc-50">{o.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{o.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Bento feature grid — each tile has a tiny live-looking vignette */
/* ------------------------------------------------------------------ */

function Tile({
  className,
  icon: Icon,
  title,
  body,
  children,
}: {
  className?: string;
  icon: LucideIcon;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mk-reveal group relative flex flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 transition-colors hover:border-zinc-700",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-lime-400">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <h3 className="font-semibold text-zinc-50">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">{body}</p>
      {children && <div className="mt-5 flex-1">{children}</div>}
    </div>
  );
}

export function BentoFeatures() {
  return (
    <section id="features" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Everything in one app"
          title="Built for the ground, not the office."
          description="Every screen is designed for a coach standing on a field with one hand free."
        />
        <div className="grid auto-rows-auto gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Coach app — big */}
          <Tile
            className="lg:col-span-2 lg:row-span-2"
            icon={Smartphone}
            title="Coach app"
            body="Today's batches, one-tap attendance, session notes and your full roster — on any phone."
          >
            <div className="mk-grid rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
              <div className="mb-3 flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-300">U-14 Football · 6:00 AM</span>
                <span className="rounded-full bg-lime-400/10 px-2 py-0.5 font-semibold text-lime-400">16 / 18</span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {["AK", "RS", "PM", "TJ", "NV", "SB", "DG", "YK", "HM", "AR", "KP", "VN"].map((n, i) => (
                  <span
                    key={n}
                    className={cn(
                      "flex h-10 items-center justify-center rounded-xl text-xs font-semibold",
                      i === 4 || i === 9 ? "bg-zinc-800 text-zinc-400" : "bg-lime-400/15 text-lime-300",
                    )}
                  >
                    {n}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-zinc-400">Tap to toggle · sample data</p>
            </div>
          </Tile>

          {/* Parent app */}
          <Tile
            icon={Users}
            title="Parent app"
            body="Attendance, fees, schedule and coach notes for every child — opened from a link, no app-store hunt."
          />

          {/* Fees */}
          <Tile
            icon={BadgeIndianRupee}
            title="Fees & UPI / online payments"
            body="Fee plans, due dates, one-tap reminders and UPI or online checkout. See who's pending at a glance."
          >
            <div className="flex items-center justify-between rounded-xl bg-zinc-950/80 px-3 py-2 text-xs">
              <span className="text-zinc-400">Pending this month</span>
              <span className="font-semibold text-amber-300">7 parents</span>
            </div>
          </Tile>

          {/* WhatsApp import */}
          <Tile
            className="lg:col-span-2"
            icon={ClipboardPaste}
            title="WhatsApp roster import"
            body="Paste your batch's WhatsApp group members or upload an Excel sheet — Triq turns it into students and parents in one go."
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex-1 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/80 p-3 font-mono text-[11px] leading-relaxed text-zinc-400">
                +91 98xxx xxx12 Riya&apos;s mom
                <br />
                +91 97xxx xxx40 Kabir papa
              </div>
              <ArrowRight className="mx-auto h-4 w-4 rotate-90 text-lime-400 sm:rotate-0" aria-hidden />
              <div className="flex-1 space-y-1.5">
                {["Riya · parent linked", "Kabir · parent linked"].map((r) => (
                  <div key={r} className="flex items-center gap-2 rounded-lg bg-lime-400/10 px-3 py-1.5 text-[11px] text-lime-300">
                    <CheckCircle2 className="h-3 w-3" aria-hidden /> {r}
                  </div>
                ))}
              </div>
            </div>
          </Tile>

          {/* Safety */}
          <Tile
            icon={ShieldAlert}
            title="Safety: SOS & medical info"
            body="Allergies, emergency contacts and an SOS flow your coaches can reach in two taps during a session."
          >
            <div className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300">
              <HeartPulse className="h-3.5 w-3.5" aria-hidden /> Asthma · inhaler in kit bag
            </div>
          </Tile>

          {/* Evaluations */}
          <Tile
            icon={LineChart}
            title="Evaluations & progress reports"
            body="Rate skills each term and share a clean progress card parents actually read."
          >
            <div className="space-y-2">
              {[
                ["Batting", "w-4/5"],
                ["Fielding", "w-3/5"],
                ["Fitness", "w-2/3"],
              ].map(([k, w]) => (
                <div key={k} className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <span className="w-14 shrink-0">{k}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                    <span className={cn("mk-bar block h-full rounded-full bg-emerald-400", w)} />
                  </span>
                </div>
              ))}
            </div>
          </Tile>

          {/* Matches & RSVP */}
          <Tile
            icon={Swords}
            title="Matches & RSVP"
            body="Announce a match or event, collect yes/no from parents and know your playing XI before the bus leaves."
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-full bg-lime-400/10 px-2.5 py-1 font-medium text-lime-300">11 going</span>
              <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-zinc-400">2 maybe</span>
              <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-zinc-400">1 no</span>
            </div>
          </Tile>

          {/* Public profile & trials */}
          <Tile
            className="md:col-span-2"
            icon={Globe}
            title="Public profile & free trials"
            body="A shareable academy page with batches, timings and a 'Book a free trial' button — new enquiries land straight in Triq."
          >
            <div className="flex items-center gap-2 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-[11px]">
              <span className="flex gap-1" aria-hidden>
                <span className="h-2 w-2 rounded-full bg-zinc-700" />
                <span className="h-2 w-2 rounded-full bg-zinc-700" />
                <span className="h-2 w-2 rounded-full bg-zinc-700" />
              </span>
              <span className="truncate text-zinc-400">triq · your-academy</span>
              <span className="ml-auto shrink-0 rounded-full bg-[var(--brand)] px-2.5 py-1 font-semibold text-zinc-950">Book free trial</span>
            </div>
          </Tile>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Switch in 24 hours — sticky scroll story */
/* ------------------------------------------------------------------ */

const STEPS = [
  {
    title: "Send us what you have",
    body: "Photos of your register, an Excel sheet, or just add us to your batch WhatsApp group for an hour. Whatever's easiest.",
    icon: ClipboardPaste,
  },
  {
    title: "We set up your academy",
    body: "Batches, timings, fee plans, students and parents — entered and checked by a real person, not a bot.",
    icon: CalendarClock,
  },
  {
    title: "Coaches get their app",
    body: "Each coach gets a one-tap login link. A 10-minute walkthrough and they're marking attendance the same evening.",
    icon: Smartphone,
  },
  {
    title: "Parents get their link",
    body: "Parents receive their child's page on WhatsApp — attendance, fees and updates from day one. No training needed.",
    icon: Users,
  },
];

export function MigrationSteps() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            align="left"
            eyebrow="Switch in 24 hours"
            title={<>From registers to Triq by tomorrow evening.</>}
            description={`We do the migration for you — free for ${FOUNDING_OFFER.city} founding academies. You keep coaching; nothing stops.`}
          />
          <Link href="#demo" className={primaryCta}>
            Start my migration <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <ol className="relative space-y-6 border-l border-zinc-800 pl-6 sm:pl-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className="mk-reveal relative rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6">
              <span className="absolute -left-[37px] top-7 flex h-6 w-6 items-center justify-center rounded-full border border-lime-400/40 bg-zinc-950 text-[11px] font-bold text-lime-400 sm:-left-[45px]">
                {i + 1}
              </span>
              <div className="flex items-center gap-3">
                <s.icon className="h-5 w-5 text-lime-400" aria-hidden />
                <h3 className="font-semibold text-zinc-50">{s.title}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.body}</p>
              <p className="mt-3 text-xs font-medium text-zinc-400">
                {["Hour 0", "Hours 1–12", "Hours 12–20", "By hour 24"][i]}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Works alongside Hudle & Playo */
/* ------------------------------------------------------------------ */

const SPLIT = [
  { job: "Court / turf bookings by the hour", booking: true, triq: false },
  { job: "Discovery for casual players", booking: true, triq: false },
  { job: "Your enrolled students & batches", booking: false, triq: true },
  { job: "Monthly fees, reminders & receipts", booking: false, triq: true },
  { job: "Attendance & coach notes", booking: false, triq: true },
  { job: "Parent updates & progress reports", booking: false, triq: true },
];

export function AlongsideBooking() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <SectionHeading
          eyebrow="Works alongside Hudle & Playo"
          title="Keep your booking apps. Add the academy layer."
          description="Booking apps fill your courts. Triq runs everything that happens after a child joins your academy — and never takes a cut of your fees."
        />
        <div className="overflow-hidden rounded-3xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">What booking apps do versus what Triq does</caption>
            <thead className="bg-zinc-900/80 text-xs uppercase tracking-wider text-zinc-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium sm:px-6">Job</th>
                <th scope="col" className="px-3 py-3 text-center font-medium">Hudle / Playo</th>
                <th scope="col" className="px-3 py-3 text-center font-medium text-lime-400">Triq</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950">
              {SPLIT.map((r) => (
                <tr key={r.job}>
                  <th scope="row" className="px-4 py-3 font-normal text-zinc-300 sm:px-6">{r.job}</th>
                  <td className="px-3 py-3 text-center">
                    {r.booking ? <><CheckCircle2 className="mx-auto h-4 w-4 text-zinc-300" aria-hidden /><span className="sr-only">Yes</span></> : <><span className="text-zinc-400" aria-hidden>—</span><span className="sr-only">No</span></>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {r.triq ? <><CheckCircle2 className="mx-auto h-4 w-4 text-lime-400" aria-hidden /><span className="sr-only">Yes</span></> : <><span className="text-zinc-400" aria-hidden>—</span><span className="sr-only">No</span></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-center text-xs text-zinc-400">
          Hudle and Playo are trademarks of their respective owners. Triq is independent and not affiliated with them.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Founding academies (instead of fake testimonials/logos) */
/* ------------------------------------------------------------------ */

export function FoundingAcademies() {
  const perks = [
    `${FOUNDING_OFFER.discountPercent}% off for ${FOUNDING_OFFER.months} months`,
    `Free migration in ${FOUNDING_OFFER.migrationHours} hours`,
    "Direct WhatsApp line to the founding team",
    "Your feature requests go to the top of the list",
  ];
  return (
    <section className="px-4 py-20 sm:px-6">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-lime-400/20 bg-zinc-900/60 p-6 sm:p-12">
        <div className="mk-glow pointer-events-none absolute inset-0 opacity-70" aria-hidden />
        <div className="relative grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-lime-400">
              Founding academies · {FOUNDING_OFFER.city}
            </p>
            <h2 className="text-balance text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
              We&apos;re choosing our first {FOUNDING_OFFER.slots} academies in {FOUNDING_OFFER.city}. Apply now.
            </h2>
            <p className="mt-4 max-w-xl text-zinc-400">
              No logo wall here yet — we&apos;d rather earn it. Founding academies get the best price we&apos;ll ever offer and shape
              what Triq becomes.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/gurgaon" className={primaryCta}>
                Apply as a founding academy <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <WhatsAppButton message={`Hi! I'd like to apply as a founding academy in ${FOUNDING_OFFER.city}.`} />
            </div>
          </div>
          <ul className="space-y-3">
            {perks.map((p) => (
              <li key={p} className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-200">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-lime-400" aria-hidden /> {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ — native <details>, zero JS */
/* ------------------------------------------------------------------ */

export const FAQS: { q: string; a: string }[] = [
  {
    q: "Is Triq really free?",
    a: `Yes. Up to ${FREE_PLAN.maxStudents} active students is free forever — no credit card, no trial timer. Most independent coaches never need to pay.`,
  },
  {
    q: "How does Growth pricing work?",
    a: `${formatINR(GROWTH_PLAN.perStudentMonthly)} per active student per month, with a minimum of ${formatINR(GROWTH_PLAN.minMonthly)}/month. An active student is one enrolled in at least one batch that month — students who have left or paused aren't billed.`,
  },
  {
    q: "What is the Gurgaon founding offer?",
    a: `The first ${FOUNDING_OFFER.slots} academies in ${FOUNDING_OFFER.city} get ${FOUNDING_OFFER.discountPercent}% off for ${FOUNDING_OFFER.months} months, plus we migrate your data for free within ${FOUNDING_OFFER.migrationHours} hours.`,
  },
  {
    q: "Do parents need to download an app?",
    a: "No. Parents open their child's page from a WhatsApp link in any phone browser, and can add it to their home screen if they like.",
  },
  {
    q: "Can you move my data from registers, Excel or WhatsApp groups?",
    a: "Yes — send photos, a spreadsheet, or let us import your WhatsApp group members. We set up batches, students and parents for you.",
  },
  {
    q: "Do you take a commission on my fees?",
    a: "No. Triq doesn't take a cut of your fees. If you enable online card/net-banking payments, the payment gateway's standard charges apply.",
  },
  {
    q: "I already use Hudle or Playo. Do I need to stop?",
    a: "Not at all. Keep using them for court and turf bookings. Triq handles your enrolled students, fees, attendance and parents.",
  },
  {
    q: "Which sports does Triq support?",
    a: "Any sport that runs in batches — cricket, football, badminton, tennis, swimming, skating, martial arts, chess and more.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <SectionHeading eyebrow="FAQ" title="Questions coaches ask us" />
        <div className="space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="mk-faq group rounded-2xl border border-zinc-800 bg-zinc-900/40 open:bg-zinc-900/70">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-medium text-zinc-100">
                {f.q}
                <Plus className="mk-chevron h-4 w-4 shrink-0 text-zinc-400 transition-transform" aria-hidden />
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-zinc-400">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Final CTA */
/* ------------------------------------------------------------------ */

export function FinalCta() {
  return (
    <section className="px-4 pb-24 pt-8 sm:px-6">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 px-6 py-16 text-center sm:px-12">
        <div className="mk-glow pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative">
          <h2 className="mx-auto max-w-2xl text-balance text-3xl font-bold tracking-tight text-zinc-50 sm:text-5xl">
            Your academy, running from your phone — tonight.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-400">
            Free up to {FREE_PLAN.maxStudents} students. Set up in minutes, or let us do it for you.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register" className={primaryCta}>
              Start free <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="#demo" className={secondaryCta}>
              Book a 15-min demo
            </Link>
            <WhatsAppButton />
          </div>
        </div>
      </div>
    </section>
  );
}
