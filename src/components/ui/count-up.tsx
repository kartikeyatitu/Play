"use client";

import { useEffect, useRef, useState } from "react";
import { isHydrated, markHydrated, prefersReducedMotion } from "@/lib/motion";

/**
 * Number that counts up to `value` (ease-out, ~0.7s, requestAnimationFrame).
 * - Server render and hydration show the final value (no flash of 0 on slow phones).
 * - Animates when mounted after hydration (tab switch) or when the value changes.
 * - Reduced motion: jumps straight to the value.
 */
export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString("en-IN"),
  duration = 700,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const [shown, setShown] = useState<number>(() => (typeof window !== "undefined" && isHydrated() ? 0 : value));
  const from = useRef(shown);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    markHydrated();
  }, []);

  useEffect(() => {
    const start = from.current;
    if (start === value || prefersReducedMotion() || !Number.isFinite(value)) {
      from.current = value;
      setShown(value);
      return;
    }
    let t0: number | null = null;
    const tick = (t: number) => {
      if (t0 == null) t0 = t;
      const p = Math.min((t - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const n = start + (value - start) * eased;
      setShown(n);
      from.current = n;
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, duration]);

  // One text node (keeps getByText / textContent stable); it settles on the exact value.
  return <span className={className}>{format(shown === value ? value : shown)}</span>;
}
