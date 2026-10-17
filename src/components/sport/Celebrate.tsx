"use client";

import type { CSSProperties } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Celebration moments. All CSS (globals.css: .draw, .burst-dot, .stamp-in, .pop-in), so they
 * cost no JS beyond this markup, play once, and collapse to the final frame under reduced motion.
 */

/** Ring + tick that draw themselves, with a small 8-dot burst. For check-in and "session done". */
export function SuccessMark({ size = 56, className = "", burst = true }: { size?: number; className?: string; burst?: boolean }) {
  const dots = burst ? Array.from({ length: 8 }, (_, i) => i * 45) : [];
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center ${className}`} style={{ width: size, height: size }} aria-hidden>
      {dots.map((a, i) => (
        <span
          key={a}
          className="burst-dot absolute left-1/2 top-1/2 -ml-[3px] -mt-[3px] h-1.5 w-1.5 rounded-full"
          style={{ "--a": `${a}deg`, "--r": `${size * 0.72}px`, background: i % 2 ? "rgb(var(--c-accent))" : "rgb(var(--c-success))" } as CSSProperties}
        />
      ))}
      <svg viewBox="0 0 52 52" width={size} height={size} className="pop-in" fill="none">
        <circle cx="26" cy="26" r="23" stroke="rgb(var(--c-success) / 0.25)" strokeWidth="3" />
        <circle
          cx="26"
          cy="26"
          r="23"
          className="draw"
          stroke="rgb(var(--c-success))"
          strokeWidth="3"
          strokeLinecap="round"
          transform="rotate(-90 26 26)"
          style={{ "--len": 145 } as CSSProperties}
        />
        <path
          d="M15.5 27 L22.5 34 L37 19"
          className="draw"
          stroke="rgb(var(--c-success))"
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ "--len": 34, "--delay": "260ms" } as CSSProperties}
        />
      </svg>
    </span>
  );
}

/** Rubber-stamp "Paid ✓" that lands when a payout is marked paid. */
export function PaidStamp({ className = "" }: { className?: string }) {
  return (
    <span
      className={`stamp-in inline-flex items-center gap-1 rounded-md border-2 border-success/80 px-1.5 py-0.5 font-heading text-[13px] font-extrabold uppercase tracking-wider text-success ${className}`}
      aria-hidden
    >
      Paid ✓
    </span>
  );
}

/** Once per day per device (e.g. confetti for the first fee of the day). */
export function oncePerDay(key: string, day: string) {
  try {
    const k = `triq_celebrated_${key}`;
    if (localStorage.getItem(k) === day) return false;
    localStorage.setItem(k, day);
    return true;
  } catch {
    return false;
  }
}

/** Confetti for true milestones only. canvas-confetti is loaded on demand. */
export function celebrateMilestone() {
  if (prefersReducedMotion()) return;
  import("@/lib/confetti").then((m) => m.fireAthleticConfetti()).catch(() => {});
}
