"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * A number that shows its value immediately and only animates when the value changes
 * while on screen (e.g. after marking a fee paid), so the change itself is visible.
 * Never counts up from 0 on mount. Reduced motion: jumps straight to the value.
 */
export function CountUp({
  value,
  // Caller-supplied formatter wins. Default: round and let the browser pick a thousands separator
  // from the user's own locale instead of forcing en-IN grouping on everyone.
  format = (n) => Math.round(n).toLocaleString(),
  duration = 400,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const [shown, setShown] = useState<number>(value);
  const from = useRef(value);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    const start = from.current;
    if (start === value || prefersReducedMotion() || !Number.isFinite(value) || !Number.isFinite(start)) {
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
