import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOUNDING_OFFER, PLANS } from "@/lib/pricing";
import { PricingCalculator } from "./pricing-calculator";
import { SectionHeading, primaryCta, secondaryCta } from "./shell";

export function FoundingOfferBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-4 rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-400/10 via-zinc-900/40 to-lime-400/5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
          <Sparkles className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-300">Founding offer</p>
          <p className="mt-1 text-lg font-semibold text-zinc-50">
            First {FOUNDING_OFFER.slots} academies: {FOUNDING_OFFER.discountPercent}% off for {FOUNDING_OFFER.months} months + free
            migration in {FOUNDING_OFFER.migrationHours} hours.
          </p>
        </div>
      </div>
      <Link href="/register" className={cn(secondaryCta, "h-10 shrink-0 border-amber-400/40 px-5 text-amber-200 hover:bg-amber-400/10")}>
        Apply as founding academy
      </Link>
    </div>
  );
}

export function PlanCards() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {PLANS.map((plan) => (
        <div
          key={plan.id}
          className={cn(
            "relative flex flex-col rounded-3xl border p-6 sm:p-8",
            plan.highlighted
              ? "border-lime-400/50 bg-zinc-900/80 shadow-[0_0_60px_-15px_rgba(163,230,53,0.35)]"
              : "border-zinc-800 bg-zinc-900/40",
          )}
        >
          {plan.highlighted && (
            <span className="absolute -top-3 left-6 rounded-full bg-[var(--brand)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-zinc-950">
              Most academies
            </span>
          )}
          <h3 className={cn("text-lg font-semibold", plan.highlighted ? "text-lime-400" : "text-zinc-100")}>{plan.name}</h3>
          <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
            <span className="text-4xl font-bold tracking-tight text-zinc-50">{plan.price}</span>
            {plan.priceSuffix && <span className="text-sm text-zinc-400">{plan.priceSuffix}</span>}
          </p>
          <p className="mt-3 text-sm text-zinc-400">{plan.blurb}</p>
          <ul className="mt-6 flex-1 space-y-3">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-zinc-300">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" aria-hidden />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link href={plan.cta.href} className={cn("mt-8 w-full", plan.highlighted ? primaryCta : secondaryCta)}>
            {plan.cta.label}
          </Link>
        </div>
      ))}
    </div>
  );
}

/** Full pricing block used on the landing page (anchor: #pricing). */
export function PricingSection() {
  return (
    <section id="pricing" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Pricing"
          title="Free to start. Then pay per active student."
          description="No setup fees, no lock-in. You're billed per active student, so quiet months cost less."
        />
        <PlanCards />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <PricingCalculator />
          <FoundingOfferBanner className="h-full" />
        </div>
      </div>
    </section>
  );
}
