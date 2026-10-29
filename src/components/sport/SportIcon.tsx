import type { ReactNode } from "react";
import type { SportKey } from "@/lib/sports-visual";

/**
 * Triq sport icon set. Drawn in-house on a 24px grid: 2px stroke, round caps and joins,
 * no fills, colour from currentColor, so icons sit next to lucide-react icons.
 * Keys match LIVE_SPORTS in src/lib/live-match.ts; anything else draws the generic medal.
 *
 * Decorative by default (aria-hidden). Pass `title` to expose it as an image with that label.
 */
export function SportIcon({
  sport,
  className = "h-5 w-5",
  title,
}: {
  sport: SportKey | (string & {}) | null | undefined;
  className?: string;
  title?: string;
}) {
  const body = (sport && (ICONS as Record<string, ReactNode>)[sport]) || GENERIC;
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
    >
      {body}
    </svg>
  );
}

/** Generic fallback: a medal on a ribbon. */
const GENERIC = (
  <>
    <circle cx="12" cy="15.5" r="5" />
    <path d="M8.6 11.8 6 3h4l2 5.5L14 3h4l-2.6 8.8" />
  </>
);

export const ICONS: Record<SportKey, ReactNode> = {
  // Bat (blade + handle) and ball
  cricket: (
    <>
      <path d="M13.5 5 17 8.5 8 17.5 4.5 14Z" />
      <path d="m15.3 6.7 3.7-3.7" />
      <circle cx="18" cy="17.5" r="2.5" />
    </>
  ),
  // Ball: centre panel with seams to the rim
  football: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m12 8.3 3.5 2.5-1.3 4.1H9.8l-1.3-4.1Z" />
      <path d="M12 8.3V3.2M15.5 10.8l4.8-1.5M14.2 14.9l2.9 4M9.8 14.9l-2.9 4M8.5 10.8 3.7 9.3" />
    </>
  ),
  // Small-sided goal with net, ball in front
  futsal: (
    <>
      <path d="M3 13V4h18v9" />
      <path d="M3 8.5h18M9 4v9M15 4v9" />
      <circle cx="12" cy="17.5" r="3.5" />
    </>
  ),
  // Ball with vertical, horizontal and side seams
  basketball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18M3 12h18" />
      <path d="M5.6 5.7c3.4 3.5 3.4 9.1 0 12.6M18.4 5.7c-3.4 3.5-3.4 9.1 0 12.6" />
    </>
  ),
  // Stick with a hooked toe and a ball
  hockey: (
    <>
      <path d="M17.5 3 9.4 17.6A3 3 0 0 1 6.8 19H5a2 2 0 0 1 0-4h1.5" />
      <circle cx="16.5" cy="18" r="2" />
    </>
  ),
  // Raider reaching across to a defender
  kabaddi: (
    <>
      <circle cx="6.5" cy="5" r="1.6" />
      <path d="m6.5 8.2-.8 5.6L3 20M5.7 13.8 9 19M6.8 9.8l5.2 1.6" />
      <circle cx="17.5" cy="6.5" r="1.6" />
      <path d="M17.5 9.7v5.3L15.5 20M17.5 15l2.5 5M17.4 11.2l-3 -.9" />
    </>
  ),
  // Jumping player throwing the ball
  handball: (
    <>
      <circle cx="17.5" cy="4.8" r="2.3" />
      <circle cx="8.5" cy="6.2" r="1.6" />
      <path d="m9 9.4 1 5.6M9.4 10.5l4.6-3.4M9.2 11.2l-4 1.1M10 15l-3 5M10 15l4 4" />
    </>
  ),
  // Shuttlecock: cork below, feather skirt above
  badminton: (
    <>
      <circle cx="12" cy="18.5" r="2.5" />
      <path d="M9.8 16.7 6.5 4h11l-3.3 12.7" />
      <path d="M12 16V4M7.8 9.5h8.4" />
    </>
  ),
  // Round bat with handle, ball
  table_tennis: (
    <>
      <circle cx="10" cy="10" r="6.5" />
      <path d="m14.6 14.6 4.9 4.9" />
      <circle cx="19" cy="5" r="1.5" />
    </>
  ),
  // Ball with three curved panels meeting in the middle
  volleyball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 12C9.6 9.6 8.6 6.6 8.9 3.6M12 12c3.3-.6 6.4.2 8.8 2.2M12 12c-.6 3.3-2.5 6.2-5.3 8" />
    </>
  ),
  // Long-throat racket and small ball
  squash: (
    <>
      <ellipse cx="9.5" cy="8.5" rx="4.6" ry="5.8" transform="rotate(-40 9.5 8.5)" />
      <path d="m12.8 12.3 6.7 7.2" />
      <circle cx="18.5" cy="5.5" r="1.5" />
    </>
  ),
  // Solid paddle and perforated ball
  pickleball: (
    <>
      <rect x="3" y="3" width="11" height="12" rx="4" />
      <path d="M8.5 15v6" />
      <circle cx="18" cy="17" r="3.2" />
      <path d="M17 16h.01M19 16h.01M18 18.2h.01" />
    </>
  ),
  // Ball with its two seams
  tennis: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6a9 9 0 0 1 0 12.8M18.4 5.6a9 9 0 0 0 0 12.8" />
    </>
  ),
  // Belt: band, knot and two tails
  karate: (
    <>
      <path d="M3 8.5h6M15 8.5h6M3 11.5h6M15 11.5h6" />
      <rect x="9" y="7" width="6" height="6" rx="1.5" />
      <path d="m10.5 13-2.5 7M13.5 13l2.5 7" />
    </>
  ),
  // High side kick
  taekwondo: (
    <>
      <circle cx="6" cy="4.8" r="1.6" />
      <path d="m6.8 8 2.2 6M9 14l-2.2 6M9 14l11-6.5M7.4 9.6l-3 2.2M7.8 9.2l3.4-1.4" />
    </>
  ),
  // Mat: outer circle, centre circle and the two starting lines
  wrestling: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M10.2 10.5v3M13.8 10.5v3" />
    </>
  ),
  // Glove with thumb and cuff
  boxing: (
    <>
      <path d="M8 17c-2-1.2-3-3.2-3-5.5V8a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v4.5a5.6 5.6 0 0 1-2 4.5" />
      <path d="M5.2 10.6c1.9-.5 3.9.2 4.8 2" />
      <rect x="8" y="17" width="8" height="4" rx="1" />
    </>
  ),
  // Runner mid-stride
  athletics: (
    <>
      <circle cx="14.5" cy="4.5" r="1.7" />
      <path d="m13.5 8-2.3 5.2 3 2.8-1 4.5M11.2 13.2 8.6 16H5M13.3 8.6l3.4 2.4h2.3M13 8.4 9.5 9l-1.8 2.3" />
    </>
  ),
  // Swimmer's head and arm above two waves
  swimming: (
    <>
      <circle cx="16.5" cy="6.5" r="1.7" />
      <path d="m3.5 11.5 5-3.5 4 3.4" />
      <path d="M2 15.5c1.7-1.3 3.3-1.3 5 0s3.3 1.3 5 0 3.3-1.3 5 0 3.3 1.3 5 0M2 20c1.7-1.3 3.3-1.3 5 0s3.3 1.3 5 0 3.3-1.3 5 0 3.3 1.3 5 0" />
    </>
  ),
  // Boot on a blade
  skating: (
    <>
      <path d="M5 3h5.5v6.5l6.8 2.4a2.6 2.6 0 0 1 1.7 2.4V16H5Z" />
      <path d="M10.5 6H8" />
      <path d="M7 16v4M16 16v4M3 20h16.5a2 2 0 0 0 2-2" />
    </>
  ),
  // Bicycle
  cycling: (
    <>
      <circle cx="5.5" cy="16" r="3.5" />
      <circle cx="18.5" cy="16" r="3.5" />
      <path d="M5.5 16h6l4-7H9l2.5 7M15.5 9l3 7M8 6.5h3M9.5 6.5 9 9M14.5 6h2.5" />
    </>
  ),
  // Pawn
  chess: (
    <>
      <circle cx="12" cy="6" r="2.6" />
      <path d="M9.4 10.5h5.2M10.6 10.5 9.5 17M13.4 10.5l1.1 6.5" />
      <rect x="6.5" y="17" width="11" height="4" rx="1" />
    </>
  ),
};
