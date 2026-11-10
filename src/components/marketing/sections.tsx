// FAQ content shared by the landing page (a subset) and the pricing page (all of it).
import { AI_MONTHLY_ACTIONS, ANNUAL_FREE_MONTHS, FOUNDING_OFFER, FREE_PLAN, GROWTH_PLAN, INTERNATIONAL_GROWTH, VENUE_COMMISSION_PERCENT, formatINR } from "@/lib/pricing";
import { Plus } from "lucide-react";
import { SectionHeading } from "./shell";

export const FAQS: { q: string; a: string }[] = [
  {
    q: "Is Triq really free?",
    a: `Yes. Up to ${FREE_PLAN.maxStudents} active students is free forever. No credit card, no trial timer.`,
  },
  {
    q: "How does Growth pricing work?",
    a: `${formatINR(GROWTH_PLAN.perStudentMonthly)} per active student per month, the same rate for every student, with a minimum of ${formatINR(GROWTH_PLAN.minMonthly)}/month. Prices are before 18% GST. Pay yearly and get ${ANNUAL_FREE_MONTHS} months free. An active student is one enrolled in at least one batch that month. Students who have left or paused aren't billed.`,
  },
  {
    q: "Do you take a cut of fees or court bookings?",
    a: `No. Fees and bookings are paid into your own Razorpay or UPI account. Triq takes ${VENUE_COMMISSION_PERCENT}% commission and adds no markup; you only pay your payment gateway's own charges.`,
  },
  {
    q: "What does the AI assistant cost?",
    a: `It's included. Free academies get ${AI_MONTHLY_ACTIONS.free} AI actions a month (drafting a note, explaining a report, scanning a register page); Growth and Academy get ${AI_MONTHLY_ACTIONS.growth.toLocaleString("en-IN")}.`,
  },
  {
    q: "Is Triq available outside India?",
    a: `Yes. Outside India, Growth is US$${INTERNATIONAL_GROWTH.perStudentMonthly} per active student per month (minimum US$${INTERNATIONAL_GROWTH.minMonthly}), with the same free tier up to ${FREE_PLAN.maxStudents} students. Local taxes may apply.`,
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
