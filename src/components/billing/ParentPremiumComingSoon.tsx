"use client";

import { useState, useTransition } from "react";
import { registerParentPremiumInterest, withdrawParentPremiumInterest } from "@/app/actions/parent-plan";

const FEATURES_LIST = [
  { title: "Live streaming", text: "Watch your child's matches live from anywhere." },
  { title: "Highlights", text: "Short clips of your child's best moments, ready to share." },
  { title: "Full stats history", text: "Every match, assessment and attendance record across seasons." },
];

/**
 * "Coming soon" card for the parent premium plan. No price and no payment: the button only records
 * interest (ParentPlan status INTERESTED). Render it only when FEATURES.parentPremium is on.
 */
export function ParentPremiumComingSoon({ interested: initial = false }: { interested?: boolean }) {
  const [interested, setInterested] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = () =>
    start(async () => {
      setError(null);
      const r = interested ? await withdrawParentPremiumInterest() : await registerParentPremiumInterest();
      if (r.ok) setInterested(!interested);
      else setError(r.error);
    });

  return (
    <section className="rounded-2xl border border-lime-400/20 bg-lime-400/5 p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-zinc-100">TRIQ Premium for parents</h2>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-300">Coming soon</span>
      </div>
      <ul className="mt-3 space-y-2">
        {FEATURES_LIST.map((f) => (
          <li key={f.title} className="text-sm">
            <span className="font-medium text-zinc-100">{f.title}</span>
            <span className="text-zinc-400"> — {f.text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-zinc-500">Not available yet. Nothing is charged.</p>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="mt-3 inline-flex items-center rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5 disabled:opacity-50"
      >
        {interested ? "You'll be notified — undo" : "Notify me when it launches"}
      </button>
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </section>
  );
}
