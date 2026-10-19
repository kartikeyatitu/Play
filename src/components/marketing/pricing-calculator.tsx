"use client";

import { useId, useState } from "react";
import { FOUNDING_OFFER, FREE_PLAN, GROWTH_PLAN, formatINR, foundingMonthlyPrice, growthMonthlyPrice } from "@/lib/pricing";

/** Tiny slider that shows what an academy of N active students would pay. All maths lives in src/lib/pricing.ts. */
export function PricingCalculator({ initial = 60 }: { initial?: number }) {
  const [students, setStudents] = useState(initial);
  const id = useId();
  const monthly = growthMonthlyPrice(students);
  const founding = foundingMonthlyPrice(students);
  const isFree = students <= FREE_PLAN.maxStudents;
  const minApplies = !isFree && students * GROWTH_PLAN.perStudentMonthly < GROWTH_PLAN.minMonthly;

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <label htmlFor={id} className="text-sm font-medium text-zinc-300">
            Active students
          </label>
          <p className="text-4xl font-bold tabular-nums text-zinc-50" aria-live="polite">
            {students}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-zinc-400">You&apos;d pay</p>
          <p className="text-4xl font-bold tabular-nums text-lime-400">
            {isFree ? "Free" : formatINR(monthly)}
            {!isFree && <span className="text-base font-medium text-zinc-400">/mo</span>}
          </p>
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={5}
        max={400}
        step={5}
        value={students}
        onChange={(e) => setStudents(Number(e.target.value))}
        className="mt-6 w-full accent-lime-400"
      />
      <div className="mt-1 flex justify-between text-xs text-zinc-400" aria-hidden>
        <span>5</span>
        <span>400+</span>
      </div>
      <p className="mt-5 text-sm text-zinc-400">
        {isFree
          ? `Up to ${FREE_PLAN.maxStudents} active students is free, forever.`
          : minApplies
            ? `${students} × ${formatINR(GROWTH_PLAN.perStudentMonthly)} is under the ${formatINR(GROWTH_PLAN.minMonthly)} monthly minimum.`
            : `${students} × ${formatINR(GROWTH_PLAN.perStudentMonthly)} per active student.`}
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
