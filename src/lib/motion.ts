import { useEffect, useState, type CSSProperties } from "react";

/**
 * Triq motion system.
 *
 * - Durations / easings mirror the CSS custom properties in globals.css (--dur-*, --ease-*),
 *   so JS-driven motion (count-up) and CSS keyframes feel the same.
 * - Everyday motion (stagger-in, press, pop, stamp, shimmer, sport motifs) is plain CSS:
 *   zero JS, works before hydration, and one `prefers-reduced-motion` block in globals.css
 *   turns it off.
 * - Celebrations (src/components/sport/Celebrate.tsx) are CSS too; only canvas-confetti is
 *   loaded on demand, for true milestones. framer-motion is deliberately not used: CSS covers
 *   every effect here and keeps ~30 KB of JS off cheap phones.
 */

/** Seconds; same values as --dur-tap / --dur-quick / --dur-base / --dur-slow. */
export const DURATION = { tap: 0.12, quick: 0.2, base: 0.32, slow: 0.56 } as const;
/** Same curves as --ease-out / --ease-in-out / --ease-spring. */
export const EASE = {
  out: "cubic-bezier(0.22, 1, 0.36, 1)",
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

/** Lists animate only their first few items; the rest render instantly (performance budget). */
export const STAGGER_LIMIT = 10;

/**
 * Stagger-in props for list item `i`. Returns nothing past STAGGER_LIMIT, so long lists cost
 * nothing. Usage: <li {...stagger(i)} className={cx(stagger(i).className, "…")}>, or the helper below.
 */
export function stagger(i: number, offset = 0): { className: string; style?: CSSProperties } {
  if (i >= STAGGER_LIMIT) return { className: "" };
  return { className: "rise-in", style: { ["--i" as string]: i + offset } as CSSProperties };
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

/**
 * Has the app finished hydrating? Count-ups only animate for components that mount after
 * hydration (tab switches, refreshed data), never over server-rendered numbers, so the first
 * paint on a slow phone never flashes 0.
 */
let hydrated = false;
export function markHydrated() {
  hydrated = true;
}
export function isHydrated() {
  return hydrated;
}
