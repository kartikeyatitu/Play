import type { Metadata } from "next";
import { ANNUAL_FREE_MONTHS, FOUNDING_OFFER, FREE_PLAN, GROWTH_PLAN, INTERNATIONAL_GROWTH, formatINR } from "@/lib/pricing";
import { MarketingShell, SectionHeading } from "@/components/marketing/shell";
import { FoundingOfferBanner, PlanCards } from "@/components/marketing/pricing-section";
import { PricingCalculator } from "@/components/marketing/pricing-calculator";
import { Faq } from "@/components/marketing/sections";
import { DemoSection, buildUtm } from "@/components/marketing/demo-section";

const title = `Pricing — Triq | Free up to ${FREE_PLAN.maxStudents} students`;
const description = `Free up to ${FREE_PLAN.maxStudents} students. Growth from ${formatINR(GROWTH_PLAN.perStudentMonthly)} per active student per month, lower above 100 students (minimum ${formatINR(GROWTH_PLAN.minMonthly)}, plus GST). 0% commission on fees and bookings. Founding academies get ${FOUNDING_OFFER.discountPercent}% off for ${FOUNDING_OFFER.months} months.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/pricing" },
  openGraph: { title, description, url: "/pricing", siteName: "Triq", type: "website", locale: "en_IN" },
  twitter: { card: "summary_large_image", title, description },
};

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <MarketingShell>
      <section className="px-4 pb-12 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-volt">Pricing</p>
            <h1 className="text-balance text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
              Simple pricing that grows with your academy
            </h1>
            <p className="mt-5 text-pretty text-lg text-ink-muted">
              Free up to {FREE_PLAN.maxStudents} students. After that, {formatINR(GROWTH_PLAN.perStudentMonthly)} per active student
              per month, and less for every student above 100. No setup charges, no lock-in, and 0% commission on your fees and bookings.
            </p>
          </div>
          <PlanCards />
          <p className="mt-6 text-center text-sm text-ink-muted">
            Prices are before 18% GST. Pay yearly and get {ANNUAL_FREE_MONTHS} months free. Outside India: US$
            {INTERNATIONAL_GROWTH.perStudentMonthly} per active student per month, minimum US${INTERNATIONAL_GROWTH.minMonthly}.
          </p>
          <FoundingOfferBanner className="mt-10" />
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <SectionHeading title="What would I pay?" description="Drag the slider to your number of active students." />
          <PricingCalculator />
        </div>
      </section>

      <Faq />
      <DemoSection utm={buildUtm(params, "/pricing")} />
    </MarketingShell>
  );
}
