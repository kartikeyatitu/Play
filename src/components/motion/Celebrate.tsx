"use client";
// One small burst for a real milestone (personal best, badge, every session this week). Plays once.
import { motion, useReducedMotion } from "framer-motion";

const COLORS = ["#22c55e", "#f59e0b", "#3b82f6", "#ef4444", "#a855f7", "#14b8a6"];

export function Celebrate({ size = 120 }: { size?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  const bits = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2;
    const r = size / 2 + (i % 3) * 10;
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r, c: COLORS[i % COLORS.length], s: 5 + (i % 3) * 2, d: (i % 4) * 0.03 };
  });
  return (
    <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{ width: b.s, height: b.s, background: b.c }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
          animate={{ x: b.x, y: b.y, opacity: 0, scale: 1 }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 + b.d }}
        />
      ))}
    </span>
  );
}
