import { FOUNDING_OFFER, FREE_PLAN } from "@/lib/pricing";
import { MarketingShell } from "./shell";
import { FAQS } from "./sections";
import { PricingSection } from "./pricing-section";
import { DemoSection, buildUtm, type MarketingSearchParams } from "./demo-section";
import { Hero, type HeroLang, type HeroStrings } from "./landing/Hero";
import { Scoreboard } from "./landing/Scoreboard";
import { ChildSafe, ClosingBoard, LandingFaq, OneSession, Pillars, SportsRow, SwitchOver } from "./landing/Sections";
import "@fontsource-variable/big-shoulders-display";
import "@fontsource-variable/hanken-grotesk";
import "@fontsource-variable/noto-sans-devanagari";
import "./landing/landing.css";

const HERO: Record<HeroLang, HeroStrings> = {
  en: {
    title: "The operating system for sports academies",
    sub: "Attendance, fees, coaches and parents in one app. Built for academies that still run on registers, Excel and WhatsApp groups.",
    start: "Start free",
    demo: "Book a 15-minute demo",
    note: `Free up to ${FREE_PLAN.maxStudents} students. No card needed. We move your data over in ${FOUNDING_OFFER.migrationHours} hours.`,
    offer: `Founding academies: ${FOUNDING_OFFER.discountPercent}% off for ${FOUNDING_OFFER.months} months`,
  },
  hi: {
    title: "स्पोर्ट्स अकादमी का पूरा सिस्टम, एक ऐप में",
    sub: "हाज़िरी, फ़ीस, कोच और पेरेंट, सब एक जगह। उन अकादमियों के लिए जो आज भी रजिस्टर, Excel और WhatsApp ग्रुप से चलती हैं।",
    start: "मुफ़्त शुरू करें",
    demo: "15 मिनट का डेमो बुक करें",
    note: `${FREE_PLAN.maxStudents} स्टूडेंट्स तक मुफ़्त। कोई कार्ड नहीं। ${FOUNDING_OFFER.migrationHours} घंटे में आपका डेटा हम लाएँगे।`,
    offer: `फाउंडिंग अकादमियाँ: ${FOUNDING_OFFER.months} महीने ${FOUNDING_OFFER.discountPercent}% छूट`,
  },
};

/** The questions owners ask first; the full list stays in sections.tsx for the pricing page. */
const SHOWN_FAQ = [
  "Is Triq really free?",
  "How does Growth pricing work?",
  "Do parents need to download an app?",
  "Can you move my data from registers, Excel or WhatsApp groups?",
  "Where do online payments go?",
  "Which sports does Triq support?",
];
const LANDING_FAQS = SHOWN_FAQ.map((q) => FAQS.find((f) => f.q === q)).filter((f): f is { q: string; a: string } => !!f);

function FaqJsonLd() {
  const json = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: LANDING_FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}

/** Owner-facing landing page. Server component; only the language toggle, scoreboard count-up, pricing slider and demo form hydrate. */
export function LandingPage({ searchParams, page = "/" }: { searchParams?: MarketingSearchParams; page?: string }) {
  const utm = buildUtm(searchParams, page);
  return (
    <MarketingShell>
      <div className="tq">
        <section className="px-4 pb-20 pt-12 sm:px-6 sm:pt-16 lg:pb-28">
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.25fr_1fr]">
            <Hero copy={HERO} />
            <div className="flex justify-center lg:justify-end">
              <Scoreboard />
            </div>
          </div>
        </section>
        <SportsRow />
        <OneSession />
        <Pillars />
        <ChildSafe />
        <SwitchOver />
        <PricingSection />
        <DemoSection utm={utm} />
        <LandingFaq faqs={LANDING_FAQS} />
        <ClosingBoard />
        <FaqJsonLd />
      </div>
    </MarketingShell>
  );
}
