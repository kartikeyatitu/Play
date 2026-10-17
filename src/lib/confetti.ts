"use client";

import confetti from "canvas-confetti";

/** Theme-aware colours: accent, second accent, success and white. */
function themeColors() {
  try {
    const cs = getComputedStyle(document.documentElement);
    const rgb = (v: string) => {
      const t = cs.getPropertyValue(v).trim().split(/\s+/).map(Number);
      return t.length === 3 && t.every((n) => Number.isFinite(n)) ? `#${t.map((n) => n.toString(16).padStart(2, "0")).join("")}` : null;
    };
    const list = [rgb("--a-400"), rgb("--accent-2"), rgb("--em-400"), "#ffffff"].filter(Boolean) as string[];
    if (list.length >= 3) return list;
  } catch {
    /* fall through */
  }
  return ["#a3e635", "#22c55e", "#ffffff", "#38bdf8"];
}

/** Big-moment confetti (first fee of the day). Kept short: ~120 particles, skipped for reduced motion. */
export function fireAthleticConfetti() {
  const count = 120;
  const defaults: confetti.Options = { origin: { y: 0.7 }, colors: themeColors(), disableForReducedMotion: true, ticks: 160 };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) });
  }

  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.2, { spread: 120, startVelocity: 35, decay: 0.92, scalar: 1.1 });
}
