import type { SportKind } from "@/components/sport/sport-kind";

/** Static 24px line icon per sport (original artwork, currentColor). For rows, chips and tiles. */
export function SportGlyph({ sport = "multi", className = "w-4 h-4" }: { sport?: SportKind; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      {GLYPHS[sport]}
    </svg>
  );
}

const GLYPHS: Record<SportKind, React.ReactNode> = {
  badminton: (
    <>
      <circle cx="17.5" cy="6.5" r="2.6" fill="currentColor" stroke="none" />
      <path d="M15.6 8.4 L6 13 L11 18 L15.6 8.4" />
      <path d="M15.6 8.4 L8.5 15.5" />
    </>
  ),
  cricket: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 5 C11.5 9 11.5 15 8.5 19" />
      <path d="M11 4.4 C13.6 8.6 13.6 15.4 11 19.6" strokeDasharray="1.2 2" />
    </>
  ),
  football: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8.6 L15.2 10.9 L14 14.6 L10 14.6 L8.8 10.9 Z" fill="currentColor" stroke="none" />
      <path d="M12 8.6 V4 M15.2 10.9 L19.6 9.6 M14 14.6 L16.7 18.3 M10 14.6 L7.3 18.3 M8.8 10.9 L4.4 9.6" />
    </>
  ),
  tennis: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M5.2 7.8 C9 10 9 14 5.2 16.2 M18.8 7.8 C15 10 15 14 18.8 16.2" />
    </>
  ),
  swimming: (
    <>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M10.5 11 L16 7.5" />
      <path d="M3 15.5 q2.25 -2 4.5 0 t4.5 0 t4.5 0 t4.5 0" />
      <path d="M3 19.5 q2.25 -2 4.5 0 t4.5 0 t4.5 0 t4.5 0" />
    </>
  ),
  basketball: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12 H20 M12 4 V20 M6.3 6.4 C9 9 9 15 6.3 17.6 M17.7 6.4 C15 9 15 15 17.7 17.6" />
    </>
  ),
  multi: (
    <>
      <circle cx="12" cy="13" r="7" />
      <path d="M12 6 V3.5 M9.5 3.5 H14.5 M12 13 L15 10" />
      <path d="M18.5 6.5 L19.8 5.2" />
    </>
  ),
};
