"use client";

import { useId, useState } from "react";
import { FOUNDING_OFFER, FREE_PLAN, GROWTH_PLAN, formatINR, foundingMonthlyPrice, graduatedStudentCharge, growthMonthlyPrice, withGst } from "@/lib/pricing";

/** Tiny slider that shows what an academy of N active students would pay. All maths lives in src/lib/pricing.ts. */
export function PricingCalculator({ initial = 60 }: { initial?: number }) {
  const [students, setStudents] = useState(initial);
  const id = useId();
  const monthly = growthMonthlyPrice(students);
  const founding = foundingMonthlyPrice(students);
  const isFree = students <= FREE_PLAN.maxStudents;
  const minApplies = !isFree && graduatedStudentCharge(students) < GROWTH_PLAN.minMonthly;
  // Plain-English breakdown of the bands this academy reaches, e.g. "100 × ₹15 + 50 × ₹10".
  const breakdown = (() => {
    const parts: string[] = [];
    let remaining = students;
    let prev = 0;
    for (const t of GROWTH_PLAN.tiers) {
      if (remaining <= 0) break;
      const n = t.upTo == null ? remaining : Math.min(remaining, t.upTo - prev);
      parts.push(`${n} × ${formatINR(t.perStudent)}`);
      remaining -= n;
      if (t.upTo != null) prev = t.upTo;
    }
    return parts.join(" + ");
  })();

  return (
    <div className="rounded-3xl border border-line bg-surface/50 p-5 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <label htmlFor={id} className="text-sm font-medium text-ink-muted">
            Active students
          </label>
          <p className="text-4xl font-bold tabular-nums text-ink" aria-live="polite">
            {students}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-ink-muted">You&apos;d pay</p>
          <p className="text-4xl font-bold tabular-nums text-volt">
            {isFree ? "Free" : formatINR(monthly)}
            {!isFree && <span className="text-base font-medium text-ink-muted">/mo</span>}
          </p>
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={5}
        max={1000}
        step={5}
        value={students}
        onChange={(e) => setStudents(Number(e.target.value))}
        className="mt-6 w-full accent-volt"
      />
      <div className="mt-1 flex justify-between text-xs text-ink-muted" aria-hidden>
        <span>5</span>
        <span>1,000</span>
      </div>
      <p className="mt-5 text-sm text-ink-muted">
        {isFree
          ? `Up to ${FREE_PLAN.maxStudents} active students is free, forever.`
          : minApplies
            ? `${breakdown} is under the ${formatINR(GROWTH_PLAN.minMonthly)} monthly minimum.`
            : `${breakdown}.`}
        {!isFree && ` ${formatINR(withGst(monthly))} including 18% GST.`}
        {!isFree && (
          <>
            {" "}
            <span className="font-medium text-amber-300">
              Founding price: {formatINR(founding)}/mo for {FOUNDING_OFFER.months} months.
            </span>
          </>
        )}
      </p>
    </div>
  );
}
