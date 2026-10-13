import { FOUNDING_OFFER, FREE_PLAN } from "@/lib/pricing";
import { HeroCopy, type HeroCopyStrings, type HeroLang } from "./hero-copy";
import { ProductMock } from "./product-mock";
import { MarketingShell, primaryCta, secondaryCta } from "./shell";
import {
  AlongsideBooking,
  BentoFeatures,
  Faq,
  FAQS,
  FinalCta,
  FoundingAcademies,
  MigrationSteps,
  ProblemOutcomes,
  SportsStrip,
} from "./sections";
import { PricingSection } from "./pricing-section";
import { DemoSection, buildUtm, type MarketingSearchParams } from "./demo-section";

const HERO_COPY: Record<HeroLang, HeroCopyStrings> = {
  en: {
    eyebrow: `${FOUNDING_OFFER.city} founding offer — ${FOUNDING_OFFER.discountPercent}% off for ${FOUNDING_OFFER.months} months`,
    titleA: "Run your academy",
    titleB: "from your phone.",
    sub: `Attendance in seconds, fees collected on time, and parents updated automatically — without the WhatsApp chaos. Built for Indian sports coaches. Free up to ${FREE_PLAN.maxStudents} students.`,
    startFree: "Start free",
    bookDemo: "Book a 15-min demo",
    micro: ["No credit card", `Free up to ${FREE_PLAN.maxStudents} students`, `We migrate your data in ${FOUNDING_OFFER.migrationHours}h`],
  },
  hi: {
    eyebrow: `गुड़गांव फाउंडिंग ऑफ़र — ${FOUNDING_OFFER.months} महीने ${FOUNDING_OFFER.discountPercent}% छूट`,
    titleA: "अपनी अकादमी",
    titleB: "अब फ़ोन से चलाइए।",
    sub: `सेकंडों में हाज़िरी, समय पर फ़ीस, और पेरेंट्स को अपने-आप अपडेट — बिना WhatsApp की भागदौड़ के। भारतीय स्पोर्ट्स कोचों के लिए बना। ${FREE_PLAN.maxStudents} स्टूडेंट्स तक मुफ़्त।`,
    startFree: "मुफ़्त शुरू करें",
    bookDemo: "15 मिनट का डेमो बुक करें",
    micro: ["कोई क्रेडिट कार्ड नहीं", `${FREE_PLAN.maxStudents} स्टूडेंट्स तक मुफ़्त`, `${FOUNDING_OFFER.migrationHours} घंटे में डेटा माइग्रेशन`],
  },
};

function FaqJsonLd() {
  const json = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}

/** Owner-facing landing page. Server component; only the language toggle, pricing slider and demo form hydrate. */
export function LandingPage({ searchParams, page = "/" }: { searchParams?: MarketingSearchParams; page?: string }) {
  const utm = buildUtm(searchParams, page);
  return (
    <MarketingShell>
      {/* Hero */}
      <section className="relative isolate px-4 pb-16 pt-12 sm:px-6 sm:pt-20 lg:pb-24">
        <div className="mk-grid pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <HeroCopy copy={HERO_COPY} primaryClass={primaryCta} secondaryClass={secondaryCta} />
          <ProductMock />
        </div>
      </section>

      <SportsStrip />
      <ProblemOutcomes />
      <BentoFeatures />
      <MigrationSteps />
      <AlongsideBooking />
      <PricingSection />
      <FoundingAcademies />
      <DemoSection utm={utm} />
      <Faq />
      <FinalCta />
      <FaqJsonLd />
    </MarketingShell>
  );
}
