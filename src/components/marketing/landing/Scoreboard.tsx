"use client";

import { useEffect, useState } from "react";

/** One sample academy day, shown the way a ground's scoreboard shows a match. */
const ROWS = [
  { label: "Present today", value: 42, of: 48, kind: "count" as const },
  { label: "Fees received", value: 18500, kind: "rupees" as const },
  { label: "Parents updated", value: 36, kind: "count" as const },
];

const fmt = (n: number, kind: "count" | "rupees") => (kind === "rupees" ? `₹${Math.round(n).toLocaleString("en-IN")}` : String(Math.round(n)));

/** Numbers count up once when the page opens (skipped when the visitor prefers reduced motion). */
function useCountUp(duration = 1400) {
  const [t, setT] = useState(1);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    setT(0);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setT(1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration]);
  return t;
}

export function Scoreboard() {
  const t = useCountUp();
  return (
    <figure className="tq-board w-full max-w-md p-5 sm:p-6" aria-label="Sample academy day: 42 of 48 present, ₹18,500 fees received, 36 parents updated">
      <div className="flex items-baseline justify-between gap-3 pb-4">
        <div>
          <p className="tq-display text-2xl font-extrabold uppercase leading-none tracking-wide text-[#ffffff]">Ace Cricket Academy</p>
          <p className="mt-1 text-xs text-[#9fb5a9]">Tuesday, evening batches</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[#9fb5a9]">
          <span className="h-2 w-2 rounded-full bg-[#4ade80]" aria-hidden /> Live
        </span>
      </div>
      <dl aria-hidden>
        {ROWS.map((r) => (
          <div key={r.label} className="tq-board-row flex items-baseline justify-between gap-4 py-3">
            <dt className="text-sm text-[#c9d6ce]">{r.label}</dt>
            <dd className="tq-num tq-amber text-4xl font-extrabold leading-none sm:text-5xl">
              {fmt(r.value * t, r.kind)}
              {r.of ? <span className="text-2xl text-[#7f968a] sm:text-3xl">/{r.of}</span> : null}
            </dd>
          </div>
        ))}
        <div className="tq-board-row flex items-baseline justify-between gap-4 pt-3">
          <dt className="text-sm text-[#c9d6ce]">Next batch</dt>
          <dd className="tq-num text-2xl font-extrabold leading-none text-[#ffffff]">U-12 nets, 5:30</dd>
        </div>
      </dl>
      <figcaption className="mt-4 text-[11px] text-[#7f968a]">Sample academy. Your own numbers appear here once you start.</figcaption>
    </figure>
  );
}
