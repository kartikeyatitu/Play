import Link from "next/link";
import {
  ArrowRight,
  BadgeIndianRupee,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardPaste,
  Download,
  Globe,
  GraduationCap,
  HeartPulse,
  History,
  Megaphone,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Swords,
  Trophy,
  Users,
  Briefcase,
  Building2,
  ShoppingBag,
  LineChart,
  Wallet,
  MapPin,
  Video,
  Receipt,
  Repeat,
  Sparkles,
  HandHeart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FEATURES } from "@/lib/features";
import { FOUNDING_OFFER, FREE_PLAN, GROWTH_PLAN, formatINR } from "@/lib/pricing";
import { SectionHeading, WhatsAppButton, primaryCta, secondaryCta } from "./shell";

/* ------------------------------------------------------------------ */
/* Shared bits */
/* ------------------------------------------------------------------ */

type Status = "live" | "soon" | "partial";

/** Status pill. Text is always shown, so status never depends on colour alone. */
export function StatusPill({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    live: { label: "Live", cls: "border-volt/40 bg-volt/10 text-volt-ink" },
    soon: { label: "Coming soon", cls: "border-line bg-surface-2/70 text-ink-muted" },
    partial: { label: "Partly live", cls: "border-amber-400/40 bg-amber-400/10 text-amber-200" },
  };
  const s = map[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", s.cls)}>
      {s.label}
    </span>
  );
}

function flagStatus(on: boolean): Status {
  return on ? "live" : "soon";
}

/** AI features only count as live once the provider key is configured for this deployment. */
const AI_LIVE = FEATURES.aiAssist && !!process.env.ANTHROPIC_API_KEY;

function Card({
  icon: Icon,
  title,
  body,
  status,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  status: Status;
  className?: string;
}) {
  return (
    <div className={cn("mk-reveal flex min-w-0 flex-col rounded-3xl border border-line bg-surface/40 p-6", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-line bg-canvas text-volt">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <StatusPill status={status} />
      </div>
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sports marquee */
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
        <li key={s} className="whitespace-nowrap rounded-full border border-line bg-surface/60 px-4 py-2 text-sm text-ink-muted">
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
    <section className="border-y border-white/5 bg-canvas py-8">
      <p className="mb-5 px-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">
        For batch-based sports coaching
      </p>
      <Marquee items={SPORTS} label="Sports supported" />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Problem statement (no numbers, no outcome promises) */
/* ------------------------------------------------------------------ */

const PAINS = [
  "Attendance in a register that gets wet at the ground",
  "Chasing fees on the 10th of every month",
  "Five WhatsApp groups and a hundred “sir, is there class today?”",
  "An Excel sheet only one person understands",
];

export function SoundFamiliar() {
  return (
    <section className="px-4 pt-20 sm:px-6 sm:pt-24">
      <div className="mx-auto max-w-3xl rounded-3xl border border-line bg-surface/40 p-6 sm:p-8">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Sound familiar?</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {PAINS.map((p) => (
            <li key={p} className="flex items-start gap-3 text-sm text-ink-muted">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden />
              {p}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Academy operations (live) */
/* ------------------------------------------------------------------ */

export function AcademyOperations() {
  return (
    <section id="features" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Academy operations"
          title="The daily work of running an academy, in one app."
          description="From enrolling a child to chasing the last fee, every step is connected to the same student record."
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card
            icon={Users}
            title="Students, batches & staff"
            body="Enrol students into batches with fee plans and schedules, assign coaches, and invite staff with role-based permissions. Import from Excel or a pasted WhatsApp roster."
            status="live"
          />
          <Card
            icon={Smartphone}
            title="Coach app"
            body="Today's batches, one-tap attendance, session notes and the full roster, on any phone. Built to be used on a ground."
            status="live"
          />
          <Card
            icon={CalendarClock}
            title="Sessions & attendance"
            body="Sessions are generated from each batch's schedule. Record attendance, mark holidays, and keep a history for every student."
            status="live"
          />
          <Card
            icon={BadgeIndianRupee}
            title="Fees & payments"
            body="Fee plans, fee records and receipts, a live list of pending payments, one-tap WhatsApp reminders, and UPI or online payment links."
            status="live"
          />
          <Card
            icon={Globe}
            title="Trials, waitlists & enquiries"
            body="Parents book a free trial from your academy page. Trials, waitlist entries and enquiries land in Triq, where you can follow them up and convert them."
            status="live"
          />
          <Card
            icon={ShieldAlert}
            title="Safety & medical records"
            body="Medical details and emergency contacts for each student, an incident log, and an SOS flow coaches can use during a session."
            status="live"
          />
          <Card
            icon={CalendarCheck}
            title="Calendar & court allocation"
            body="One calendar for batches, bookings and blocked slots, with a day view. Clashes between coaches or courts are highlighted."
            status={flagStatus(FEATURES.opsCalendar)}
          />
          <Card
            icon={Receipt}
            title="GST tax invoices"
            body="Numbered tax invoices and credit notes for fees, with CGST/SGST or IGST worked out from your GSTIN and the place of supply."
            status={flagStatus(FEATURES.gstInvoices)}
          />
          <Card
            icon={LineChart}
            title="Business report"
            body="One month on one page: billed, collected and outstanding fees, attendance, trial conversion, batch fill and court use, by batch and by court."
            status={flagStatus(FEATURES.businessReport)}
          />
          <Card
            icon={HandHeart}
            title="Scholarships & fee waivers"
            body="Run scholarship programmes and give concessions to individual students. Monthly fees apply them automatically, with every change recorded."
            status={flagStatus(FEATURES.inclusive)}
          />
          <Card
            icon={Repeat}
            title="UPI AutoPay"
            body="Parents approve a UPI mandate once and monthly fees are collected automatically on your own Razorpay account. Every charge is logged."
            status="soon"
          />
          <Card
            icon={Sparkles}
            title="AI assistant"
            body="Draft parent notes from a coach's scores, get a plain-English explanation of your monthly report, and turn a photo of a paper register into students. You review everything before it is saved or sent."
            status={AI_LIVE ? "live" : "soon"}
          />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Parents (live) */
/* ------------------------------------------------------------------ */

export function ParentsSection() {
  return (
    <section id="parents" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-14">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            align="left"
            eyebrow="For parents"
            title="Every parent sees their child's page. No group chat needed."
            description="Each parent gets a link to their child's page, sent on WhatsApp. It opens in any phone browser, so there is nothing to install."
          />
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-4 py-2 text-xs text-ink-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-volt" aria-hidden />
            Login links are single use and expire after 7 days.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card
            icon={CalendarCheck}
            title="Attendance & schedule"
            body="A calendar of the child's sessions, with attendance for each day."
            status="live"
            className="sm:col-span-2"
          />
          <Card
            icon={Wallet}
            title="Fees & online payment"
            body="See what is due this month and pay online through the payment link your academy has set up."
            status="live"
          />
          <Card
            icon={LineChart}
            title="Coach notes & skill ratings"
            body="Skill ratings and coach notes from each term, shown as a timeline the parent can read."
            status="live"
          />
          <Card
            icon={Swords}
            title="Matches & RSVP"
            body="Parents answer yes, no or maybe to matches and events, so you know who is coming before the bus leaves."
            status="live"
          />
          <Card
            icon={Megaphone}
            title="Academy announcements"
            body="Announcements and batch broadcasts from the academy reach parents in one place instead of a group chat."
            status="live"
          />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Athletes (flag-dependent) */
/* ------------------------------------------------------------------ */

export function AthletesSection() {
  return (
    <section id="athletes" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="For athletes"
          title="Development beyond attendance."
          description="Athlete profiles, progress reports and opportunities are built, but still behind feature flags. Each one shows its real status."
        />
        <div className="grid gap-4 md:grid-cols-3">
          <Card
            icon={Trophy}
            title="Athlete profiles & achievements"
            body="A sporting profile for each athlete with sport, position, achievements and development goals."
            status={flagStatus(FEATURES.athleteOS)}
          />
          <Card
            icon={History}
            title="Monthly progress report"
            body="A printable monthly report per athlete, combining attendance with coach skill reports."
            status={flagStatus(FEATURES.progressReport)}
          />
          <Card
            icon={Briefcase}
            title="Trials & scholarships board"
            body="Trials and scholarships that athletes can apply to. Applications need guardian consent."
            status={flagStatus(FEATURES.opportunities)}
          />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Venues & bookings (live) */
/* ------------------------------------------------------------------ */

export function VenuesSection() {
  return (
    <section id="venues" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-14">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading
              align="left"
              eyebrow="Venues & bookings"
              title="Court and turf bookings, built in."
              description="Run your courts or turfs from one board and let players book online. Overlapping slots are rejected before they are confirmed."
            />
          </div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <Card
              icon={MapPin}
              title="Facility board"
              body="See every court or turf and its bookings for the day. Cancel, mark no-show or complete a booking."
              status={flagStatus(FEATURES.bookings)}
            />
            <Card
              icon={CalendarCheck}
              title="Public booking page"
              body="Each venue gets a booking page with live slot availability, and players pay online or by UPI."
              status={flagStatus(FEATURES.bookings)}
            />
            <Card
              icon={ClipboardPaste}
              title="Counter bookings"
              body="Take walk-in and recurring bookings at the counter. Any date that clashes is reported back to you."
              status={flagStatus(FEATURES.bookings)}
            />
            <Card
              icon={ShieldCheck}
              title="Clash protection"
              body="A slot that is already held or booked cannot be booked again. The booking engine rejects the clash."
              status={flagStatus(FEATURES.bookings)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Coming band */
/* ------------------------------------------------------------------ */

export function ComingBand() {
  const items: { icon: LucideIcon; title: string; body: string; status: Status }[] = [
    {
      icon: Trophy,
      title: "Play",
      body: "Tournaments, fixtures, standings and results.",
      status: flagStatus(FEATURES.events),
    },
    {
      icon: Briefcase,
      title: "Careers",
      body: "Coach profiles with verified certifications, sports jobs and applications.",
      status: flagStatus(FEATURES.careers),
    },
    {
      icon: HeartPulse,
      title: "Wellness",
      body: "Physio, nutrition and recovery providers, appointments and protected health records.",
      status: flagStatus(FEATURES.wellness),
    },
    {
      icon: Video,
      title: "Creators",
      body: "Creator profiles and portfolios for athletes and coaches, with real (never inflated) stats.",
      status: flagStatus(FEATURES.creators),
    },
    {
      icon: ShoppingBag,
      title: "Commerce",
      body: "Academy kit store with stock control and a clear order lifecycle.",
      status: flagStatus(FEATURES.marketplace),
    },
    {
      icon: Megaphone,
      title: "Brand Studio",
      body: "Sponsors, campaigns, proposals, scholarships and fee waivers.",
      status: flagStatus(FEATURES.sponsorship),
    },
    {
      icon: GraduationCap,
      title: "Education",
      body: "Schools, colleges and universities, with their programmes and teams.",
      status: flagStatus(FEATURES.education),
    },
    {
      icon: Building2,
      title: "Enterprise",
      body: "Multi-branch academies, consolidated reports and a full audit trail.",
      status: flagStatus(FEATURES.enterprise),
    },
  ];
  return (
    <section id="roadmap" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="The wider ecosystem"
          title="Triq is built to connect the whole sports world."
          description="Academies are where we start. These areas are in the product plan. Their status is shown as it is today."
        />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <li key={it.title} className="flex min-w-0 items-start gap-4 rounded-2xl border border-line bg-surface/30 p-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-canvas text-ink-muted">
                <it.icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-ink">{it.title}</h3>
                  <StatusPill status={it.status} />
                </div>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{it.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 6. Trust (only claims verified in code) */
/* ------------------------------------------------------------------ */

export function TrustSection() {
  const points: { icon: LucideIcon; title: string; body: string }[] = [
    {
      icon: Download,
      title: "Export everything",
      body: "Student and record data can be exported to CSV whenever you need it.",
    },
    {
      icon: ShieldCheck,
      title: "Consent before medical details",
      body: "Medical information is saved only after a parent gives consent and signs digitally.",
    },
    {
      icon: History,
      title: "Audit trail",
      body: "Payments and changes to users and accounts are written to an audit log.",
    },
    {
      icon: Wallet,
      title: "Your gateway, your money",
      body: "Online payments go through the payment gateway your academy connects. Triq does not hold academy money by default.",
    },
  ];
  return (
    <section id="trust" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Trust"
          title="Your data stays yours."
          description="Many of your students are minors. These are the protections built into the product today."
        />
        <ul className="grid gap-4 sm:grid-cols-2">
          {points.map((p) => (
            <li key={p.title} className="flex min-w-0 gap-4 rounded-3xl border border-line bg-surface/40 p-6">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-volt/10 text-volt">
                <p.icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-semibold text-ink">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{p.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-center text-xs text-ink-muted">
          Read the full{" "}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-ink">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Switch in 24 hours (no invented timings) */
/* ------------------------------------------------------------------ */

const STEPS = [
  {
    title: "Send us what you have",
    body: "Photos of your register, an Excel sheet, or your batch's WhatsApp group members. Whatever is easiest.",
    icon: ClipboardPaste,
  },
  {
    title: "We set up your academy",
    body: "Batches, timings, fee plans, students and parents, entered and checked by a real person.",
    icon: CalendarClock,
  },
  {
    title: "Coaches get their app",
    body: "Coaches get a login link on WhatsApp and start marking attendance from the Coach app.",
    icon: Smartphone,
  },
  {
    title: "Parents get their link",
    body: "Parents receive their child's page on WhatsApp. No training needed.",
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
            eyebrow={`Founding academies: switch in ${FOUNDING_OFFER.migrationHours} hours`}
            title={<>We move your academy over for you.</>}
            description={`Founding academies get free data migration within ${FOUNDING_OFFER.migrationHours} hours. You keep coaching while we do it.`}
          />
          <Link href="#demo" className={primaryCta}>
            Start my migration <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <ol className="relative space-y-6 border-l border-line pl-6 sm:pl-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className="mk-reveal relative min-w-0 rounded-3xl border border-line bg-surface/40 p-6">
              <span className="absolute -left-[37px] top-7 flex h-6 w-6 items-center justify-center rounded-full border border-volt/40 bg-canvas text-[11px] font-bold text-volt sm:-left-[45px]">
                {i + 1}
              </span>
              <div className="flex items-center gap-3">
                <s.icon className="h-5 w-5 text-volt" aria-hidden />
                <h3 className="font-semibold text-ink">{s.title}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Founding academies (no logos or testimonials) */
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
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-volt/20 bg-surface/60 p-6 sm:p-12">
        <div className="mk-glow pointer-events-none absolute inset-0 opacity-70" aria-hidden />
        <div className="relative grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-volt">Founding academies</p>
            <h2 className="text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              We&apos;re choosing our first {FOUNDING_OFFER.slots} founding academies. Apply now.
            </h2>
            <p className="mt-4 max-w-xl text-ink-muted">
              No logo wall here yet. We&apos;d rather earn it. Founding academies get the best price we&apos;ll offer and help shape
              what Triq becomes.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className={primaryCta}>
                Apply as a founding academy <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <WhatsAppButton message="Hi! I'd like to apply as a founding academy." />
            </div>
          </div>
          <ul className="space-y-3">
            {perks.map((p) => (
              <li key={p} className="flex items-center gap-3 rounded-2xl border border-line bg-canvas/70 px-4 py-3 text-sm text-ink">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-volt" aria-hidden /> {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ: native <details>, zero JS. Also used by /pricing. */
/* ------------------------------------------------------------------ */

export const FAQS: { q: string; a: string }[] = [
  {
    q: "Is Triq really free?",
    a: `Yes. Up to ${FREE_PLAN.maxStudents} active students is free forever. No credit card, no trial timer.`,
  },
  {
    q: "How does Growth pricing work?",
    a: `${formatINR(GROWTH_PLAN.perStudentMonthly)} per active student per month, with a minimum of ${formatINR(GROWTH_PLAN.minMonthly)}/month. An active student is one enrolled in at least one batch that month. Students who have left or paused aren't billed.`,
  },
  {
    q: "What is the founding offer?",
    a: `The first ${FOUNDING_OFFER.slots} academies get ${FOUNDING_OFFER.discountPercent}% off for ${FOUNDING_OFFER.months} months, plus we migrate your data for free within ${FOUNDING_OFFER.migrationHours} hours.`,
  },
  {
    q: "Do parents need to download an app?",
    a: "No. Parents open their child's page from a link sent on WhatsApp, in any phone browser. Login links are single use and expire after 7 days.",
  },
  {
    q: "Can you move my data from registers, Excel or WhatsApp groups?",
    a: "Yes. Send photos, a spreadsheet, or your WhatsApp group members. We set up batches, students and parents for you.",
  },
  {
    q: "Where do online payments go?",
    a: "To the payment gateway your academy connects. Triq does not hold academy money by default. The gateway's standard charges apply.",
  },
  {
    q: "Do I need to replace my court or turf booking app?",
    a: "Not necessarily. Triq has built-in court and turf booking for venues you run. If you already use another booking app, you can keep it and still use Triq for students, fees, attendance and parents.",
  },
  {
    q: "Which sports does Triq support?",
    a: "Sports that run in batches, such as cricket, football, badminton, tennis, swimming, skating, martial arts and chess.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <SectionHeading eyebrow="FAQ" title="Questions coaches ask us" />
        <div className="space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="mk-faq group rounded-2xl border border-line bg-surface/40 open:bg-surface/70">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-medium text-ink">
                {f.q}
                <Plus className="mk-chevron h-4 w-4 shrink-0 text-ink-muted transition-transform" aria-hidden />
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-ink-muted">{f.a}</p>
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
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-line bg-gradient-to-br from-surface via-canvas to-surface px-6 py-16 text-center sm:px-12">
        <div className="mk-glow pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative">
          <h2 className="mx-auto max-w-2xl text-balance text-3xl font-bold tracking-tight text-ink sm:text-5xl">
            Your academy, running from your phone. Tonight.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-ink-muted">
            Free up to {FREE_PLAN.maxStudents} students. Set up in minutes, or let us do it for you.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register" className={primaryCta}>
              Start free <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="#demo" className={secondaryCta}>
              <CalendarCheck className="h-4 w-4" aria-hidden /> Book a 15-min demo
            </Link>
            <WhatsAppButton />
          </div>
        </div>
      </div>
    </section>
  );
}
