import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck2, HeartPulse, LineChart, MessageCircle, Search, Wallet } from "lucide-react";
import { MarketingShell, SectionHeading, primaryCta, secondaryCta } from "@/components/marketing/shell";

const title = "Triq for parents — know how your child is really doing";
const description =
  "Attendance alerts, session recaps from the coach, progress reports and easy fee payments. Find a Gurgaon academy on Triq or ask yours to switch.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/parents" },
  openGraph: { title, description, url: "/parents", siteName: "Triq", type: "website", locale: "en_IN" },
  twitter: { card: "summary_large_image", title, description },
};

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://triqsports.vercel.app";

// Message a parent forwards to their academy owner / coach (parent-led acquisition loop).
const ASK_ACADEMY_TEXT = `Hi Coach, could our academy use Triq? Parents get attendance, session recaps and progress reports on WhatsApp, and fees can be paid online. It's free for up to 30 students: ${SITE}/?ref=parent`;

const BENEFITS = [
  { icon: CalendarCheck2, title: "Attendance, as it happens", body: "Know your child reached practice — and if they missed it." },
  { icon: MessageCircle, title: "Recaps from the coach", body: "What the batch worked on today, in the coach's own words." },
  { icon: LineChart, title: "Real progress reports", body: "Monthly skill ratings and notes — more than “he's doing fine”." },
  { icon: Wallet, title: "Fees without awkward reminders", body: "See what's due and pay by UPI or online in a tap." },
  { icon: HeartPulse, title: "Safety first", body: "Your child's medical notes and emergency contacts with the coach on the ground." },
];

export default function ParentsPage() {
  return (
    <MarketingShell>
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-14 pb-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-400">For parents</p>
        <h1 className="mt-3 text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.05]">
          Know how your child is <span className="text-lime-400">really</span> doing.
        </h1>
        <p className="mt-4 text-zinc-400 max-w-xl mx-auto">{description}</p>
        <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/academies/gurgaon" className={primaryCta}>
            <Search className="w-4 h-4" /> Find an academy in Gurgaon
          </Link>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(ASK_ACADEMY_TEXT)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={secondaryCta}
          >
            <MessageCircle className="w-4 h-4" /> Ask my academy to switch
          </a>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <SectionHeading eyebrow="What you get" title="Everything about practice, in one place" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, title: t, body }) => (
            <div key={t} className="rounded-3xl bg-zinc-900/60 p-5">
              <Icon className="w-5 h-5 text-lime-400" />
              <h3 className="mt-3 font-bold text-white">{t}</h3>
              <p className="mt-1 text-sm text-zinc-400">{body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 rounded-3xl bg-gradient-to-br from-lime-400/15 to-emerald-500/5 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white">Your academy isn&apos;t on Triq yet?</h2>
            <p className="text-sm text-zinc-400 mt-1">Send your coach one WhatsApp message — it&apos;s free for academies to start.</p>
          </div>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(ASK_ACADEMY_TEXT)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={primaryCta}
          >
            Send to my coach <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>
    </MarketingShell>
  );
}
