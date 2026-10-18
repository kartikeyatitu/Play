import type { SportKind } from "@/components/sport/sport-kind";

/**
 * Small monochrome sport identifier (e.g. 16px next to a batch name). Drawn on lucide's
 * 24px grid with a 1.5px round stroke and no fills, so it sits with lucide-react icons.
 * Colour comes from currentColor; never use it as illustration.
 */
export function SportGlyph({ sport = "multi", className = "w-4 h-4" }: { sport?: SportKind; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {GLYPHS[sport]}
    </svg>
  );
}

const GLYPHS: Record<SportKind, React.ReactNode> = {
  // Shuttlecock: cork at the bottom, feathered skirt opening upwards
  badminton: (
    <>
      <circle cx="12" cy="18.5" r="2.5" />
      <path d="M9.6 17.6 6.5 4h11l-3.1 13.6" />
      <path d="M12 16V4M7.5 9h9" />
    </>
  ),
  // Bat and ball
  cricket: (
    <>
      <path d="m14.3 4.3 5.4 5.4a1 1 0 0 1 0 1.4l-7.8 7.8-6.8-6.8 7.8-7.8a1 1 0 0 1 1.4 0Z" />
      <path d="M8.5 15.5 4 20" />
      <circle cx="6" cy="6" r="2" />
    </>
  ),
  // Football: centre panel and seams to the rim
  football: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m12 8.2 3.6 2.6-1.4 4.2H9.8l-1.4-4.2Z" />
      <path d="M12 8.2V3M15.6 10.8l4.9-1.6M14.2 15l3 4.1M9.8 15l-3 4.1M8.4 10.8 3.5 9.2" />
    </>
  ),
  // Tennis ball
  tennis: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6a9 9 0 0 1 0 12.8M18.4 5.6a9 9 0 0 0 0 12.8" />
    </>
  ),
  // Swimmer over two waves
  swimming: (
    <>
      <circle cx="16.5" cy="6.5" r="1.75" />
      <path d="m4.5 12 4-3.5 3.5 2.5 3-2" />
      <path d="M3 16c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1" />
      <path d="M3 20c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1" />
    </>
  ),
  // Basketball
  basketball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3v18" />
      <path d="M5.6 5.6a9 9 0 0 1 2.6 6.4 9 9 0 0 1-2.6 6.4M18.4 5.6a9 9 0 0 0-2.6 6.4 9 9 0 0 0 2.6 6.4" />
    </>
  ),
  // Multi-sport: stopwatch
  multi: (
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M10 2.5h4M12 2.5V6M12 13.5l3-3M18.5 6.5l1.5-1.5" />
    </>
  ),
};
