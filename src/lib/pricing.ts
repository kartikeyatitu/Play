// Single source of truth for Triq pricing (currently INR — multi-currency pricing TBD).
// Change numbers HERE ONLY — the landing page, /pricing and FAQ copy all read from this file.

/** @deprecated Use formatMoney from i18n.ts instead for org-aware formatting. */
export const CURRENCY = "₹";

export const FREE_PLAN = {
  id: "free",
  name: "Free",
  maxStudents: 30,
} as const;

export const GROWTH_PLAN = {
  id: "growth",
  name: "Growth",
  /** Price per active student per month (INR). */
  perStudentMonthly: 25,
  /** Minimum monthly bill (INR). */
  minMonthly: 749,
} as const;

export const ACADEMY_PLAN = {
  id: "academy",
  name: "Academy",
  label: "Custom",
} as const;

export const FOUNDING_OFFER = {
  slots: 50,
  discountPercent: 50,
  months: 12,
  migrationHours: 24,
} as const;

/** Format a rupee amount the Indian way: 1500 -> "₹1,500", 12.5 -> "₹12.50". */
export function formatINR(amount: number): string {
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  return `${CURRENCY}${amount.toLocaleString("en-IN", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}`;
}

/** Monthly Growth bill for a given number of active students (before any founding discount). */
export function growthMonthlyPrice(activeStudents: number): number {
  if (activeStudents <= FREE_PLAN.maxStudents) return 0;
  return Math.max(GROWTH_PLAN.minMonthly, activeStudents * GROWTH_PLAN.perStudentMonthly);
}

/** Monthly Growth bill with the founding-academy discount applied. */
export function foundingMonthlyPrice(activeStudents: number): number {
  return Math.round(growthMonthlyPrice(activeStudents) * (1 - FOUNDING_OFFER.discountPercent / 100));
}

export type PlanCard = {
  id: string;
  name: string;
  price: string;
  priceSuffix?: string;
  blurb: string;
  features: string[];
  cta: { label: string; href: string };
  highlighted?: boolean;
};

export const PLANS: PlanCard[] = [
  {
    id: FREE_PLAN.id,
    name: FREE_PLAN.name,
    price: formatINR(0),
    priceSuffix: "forever",
    blurb: `For independent coaches — up to ${FREE_PLAN.maxStudents} active students.`,
    features: [
      `Up to ${FREE_PLAN.maxStudents} active students`,
      "Coach app & parent app",
      "Attendance in a few taps",
      "Fee tracking with UPI details",
      "WhatsApp roster import",
    ],
    cta: { label: "Start free", href: "/register" },
  },
  {
    id: GROWTH_PLAN.id,
    name: GROWTH_PLAN.name,
    price: formatINR(GROWTH_PLAN.perStudentMonthly),
    priceSuffix: "per active student / month",
    blurb: `For growing academies. Minimum ${formatINR(GROWTH_PLAN.minMonthly)}/month.`,
    features: [
      "Everything in Free, plus:",
      "Unlimited coaches & batches",
      "Online payments & one-tap WhatsApp fee reminders",
      "Evaluations & progress reports",
      "Matches, events & RSVP",
      "Safety: SOS & medical info",
      "Public academy profile & free-trial bookings",
      "Priority WhatsApp support",
    ],
    cta: { label: "Start free, upgrade anytime", href: "/register" },
    highlighted: true,
  },
  {
    id: ACADEMY_PLAN.id,
    name: ACADEMY_PLAN.name,
    price: ACADEMY_PLAN.label,
    blurb: "For multi-centre academies, schools and federations.",
    features: [
      "Everything in Growth, plus:",
      "Multiple centres & branches",
      "Your brand colours",
      "Assisted data migration & coach training",
      "Annual invoicing",
      "Dedicated account manager",
    ],
    cta: { label: "Book a 15-min demo", href: "#demo" },
  },
];
