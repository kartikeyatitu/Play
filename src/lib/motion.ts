import { useEffect, useState, type CSSProperties } from "react";

/**
 * Triq motion system: functional, quiet, short.
 *
 * - Durations / easings mirror the CSS custom properties in globals.css (--dur-*, --ease-*).
 * - Motion only answers something that happened: a panel opening, a value changing, a payment
 *   being confirmed. No entrance choreography, no stagger, no bounce, no particles.
 * - One `prefers-reduced-motion` block in globals.css turns all CSS motion off; JS-driven
 *   motion (CountUp) checks prefersReducedMotion() itself.
 */

/** Seconds; same values as --dur-tap / --dur-quick / --dur-base. */
export const DURATION = { tap: 0.12, quick: 0.16, base: 0.2 } as const;
/** Same curves as --ease-out / --ease-in-out. */
export const EASE = {
  out: "cubic-bezier(0.22, 1, 0.36, 1)",
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
} as const;

/**
 * Kept for call sites written for the earlier staggered entrances. Lists now render at once
 * (the tab itself fades in), so this returns no class and no delay.
 */
export function stagger(_i: number, _offset = 0): { className: string; style?: CSSProperties } {
  return { className: "" };
}

const QUERY = "(prefers-reduced-motion: reduce)";

/** True when the OS asks for reduced motion. SSR-safe (false on the server). */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(QUERY);
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.(QUERY).matches;
}

/** Short haptic tick on supporting phones (no-op elsewhere, and skipped for reduced motion). */
export function haptic(pattern: number | number[] = 15) {
  if (prefersReducedMotion()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
