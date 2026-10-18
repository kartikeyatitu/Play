import type { Config } from "tailwindcss";

/** rgb(var(--x) / alpha) so opacity modifiers (bg-zinc-900/40) keep working with themed colours. */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
const ramp = (prefix: string, shades: (number | string)[]) =>
  Object.fromEntries(shades.map((s) => [s, v(`${prefix}-${s}`)]));

const NEUTRAL = [50, 100, 200, 300, 400, 500, 600, 700, 750, 800, 850, 900, 950];
const ACCENT = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const STATUS = [100, 200, 300, 400];

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // next/font sets --font-sans (Geist) on <html>. One family for everything: `font-heading`
      // is kept as an alias so older screens pick up Geist instead of a condensed display face.
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        heading: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",

        // Themed ramps (see src/app/themes.css). Existing zinc-/lime-/white/black classes follow the theme.
        white: v("n-0"),
        black: v("n-1000"),
        zinc: ramp("n", NEUTRAL),
        lime: ramp("a", ACCENT),
        emerald: ramp("em", STATUS),
        amber: ramp("am", STATUS),
        rose: ramp("ro", STATUS),
        sky: ramp("sk", STATUS),

        // Semantic tokens: prefer these in new code
        canvas: v("c-bg"),
        surface: { DEFAULT: v("c-surface"), 2: v("c-surface-2") },
        line: v("c-line"),
        ink: { DEFAULT: v("c-text"), muted: v("c-text-muted"), subtle: v("c-text-subtle") },
        volt: { DEFAULT: v("c-accent"), ink: v("c-accent-ink"), fg: v("c-accent-fg"), 2: v("c-accent-2") },
        success: v("c-success"),
        warn: v("c-warn"),
        danger: v("c-danger"),
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
    },
  },
  plugins: [],
};

export default config;
