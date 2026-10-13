import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy | Triq",
  description: "Refund and cancellation policy for Triq subscriptions and payments made through Triq.",
};

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "kartikeya2998@gmail.com";

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-8 bg-zinc-900/60 p-6 sm:p-10 rounded-2xl border border-zinc-800">
        <header className="border-b border-zinc-800 pb-6">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-lime-400/20 text-lime-400 font-black flex items-center justify-center text-xs">T</span>
            <span className="text-xl font-bold tracking-tight text-zinc-100">Triq</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100 mt-4">Refund &amp; Cancellation Policy</h1>
          <p className="text-xs text-zinc-400 mt-1">Effective Date: October 2026</p>
        </header>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold text-zinc-100">1. Who this applies to</h2>
          <p>
            Triq is software used by sports academies, coaches and venues. There are two kinds of payments:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Triq subscriptions</strong> — paid by an academy or venue to Triq for using the software.</li>
            <li><strong>Academy fees and bookings</strong> — paid by parents, athletes or customers directly to the academy or venue. Triq does not receive or hold these funds.</li>
          </ul>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold text-zinc-100">2. Triq subscriptions</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You can cancel your subscription at any time from Settings or by emailing us. Cancellation stops the next renewal; you keep access until the end of the current billing period.</li>
            <li>Monthly plans are not refunded for partially used months.</li>
            <li>Annual plans cancelled within 14 days of the first payment are refunded in full. After 14 days, annual plans are not refunded for the remaining period.</li>
            <li>If you were charged in error (duplicate charge, wrong amount, or charged after cancelling), we refund the incorrect amount in full.</li>
          </ul>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold text-zinc-100">3. Academy fees and venue bookings</h2>
          <p>
            Fees and bookings are paid to the academy or venue, which sets its own refund and cancellation rules.
            Please contact the academy or venue directly for refunds. If a payment was made online through Triq and
            the academy approves a refund, it is returned to the original payment method.
          </p>
          <p>
            For turf / court bookings, unless the venue states otherwise: cancellations made at least 24 hours before
            the slot are eligible for a refund at the venue&apos;s discretion; no-shows are not refunded.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold text-zinc-100">4. Refund timelines</h2>
          <p>
            Approved refunds are initiated within 5–7 working days. Depending on your bank or payment method, it can
            take a further 5–10 working days for the amount to reflect in your account.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold text-zinc-100">5. Contact</h2>
          <p>
            For refund or cancellation requests, email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-lime-400 hover:underline">{CONTACT_EMAIL}</a>{" "}
            with your registered phone number, academy name and payment reference. We respond within 2 working days.
          </p>
        </section>
      </div>
    </div>
  );
}
