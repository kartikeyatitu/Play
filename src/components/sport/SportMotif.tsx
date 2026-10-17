import type { CSSProperties } from "react";
import { type SportKind } from "@/components/sport/sport-kind";

/**
 * Small original sport scenes: inline SVG + CSS keyframes (globals.css, "Sport motifs").
 * - No JS animation, no images; each scene is well under 2 KB.
 * - Plays `loops` times then rests on a composed pose (ambient, never endless noise).
 * - Under prefers-reduced-motion the animation is removed and the rest pose is shown.
 * - Balls use real-object colours (--ball-<kind>, same in every theme); lines use the neutral ramp.
 */
export function SportMotif({
  sport = "multi",
  className = "",
  loops = 2,
  label,
}: {
  sport?: SportKind;
  className?: string;
  /** Times the scene plays before resting. Use 0 for a still. */
  loops?: number;
  /** Accessible name; omit for decorative use (default). */
  label?: string;
}) {
  const style = {
    "--sport": `var(--ball-${sport === "multi" ? "other" : sport})`,
    // Pre-computed counts: Chromium ignores calc() in animation-iteration-count
    "--loops": loops,
    "--loops-q": loops + 0.25,
    "--loops-x2": loops * 2,
    "--loops-x3": loops * 3,
    "--loops-p1": loops + 1,
  } as CSSProperties;
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return (
    <svg viewBox="0 0 120 80" className={`sport-motif ${loops === 0 ? "sm-still" : ""} ${className}`} style={style} {...a11y} focusable="false">
      {SCENES[sport]}
    </svg>
  );
}

/** Five small pentagons around the rim of the multi-sport football (centre 28,59; r 14). */
const OUTER_PATCHES = [0, 1, 2, 3, 4]
  .map((k) => {
    const a = ((-90 + 36 + k * 72) * Math.PI) / 180;
    const cx = 28 + 10.6 * Math.cos(a);
    const cy = 59 + 10.6 * Math.sin(a);
    const pts = [0, 1, 2, 3, 4].map((j) => {
      const b = a + Math.PI + (j * 72 * Math.PI) / 180;
      return `${(cx + 3.1 * Math.cos(b)).toFixed(1)} ${(cy + 3.1 * Math.sin(b)).toFixed(1)}`;
    });
    return `M${pts.join(" L")} Z`;
  })
  .join(" ");

const ground = <line x1="8" y1="74" x2="112" y2="74" className="sm-line-faint" strokeWidth="1.5" strokeLinecap="round" />;

const SCENES: Record<SportKind, React.ReactNode> = {
  badminton: (
    <>
      {ground}
      {/* net, side view */}
      <line x1="60" y1="52" x2="60" y2="74" className="sm-line" strokeWidth="2" strokeLinecap="round" />
      <rect x="56.5" y="50" width="7" height="3" rx="1" className="sm-fill-line" />
      <path d="M19 34 Q60 10 101 34" fill="none" className="sm-line-faint" strokeWidth="1.2" strokeDasharray="2 4" strokeLinecap="round" />
      <g className="sm-rally">
        <g transform="translate(60 22)">
          <g className="sm-flip">
            <path d="M3 -3.6 L-12 -8.5 L-12 8.5 L3 3.6 Z" className="sm-skirt" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M3 0 L-12 0 M3 -1.8 L-12 -4.3 M3 1.8 L-12 4.3" className="sm-line" strokeWidth="0.8" />
            <circle cx="6.5" cy="0" r="4.6" className="sm-ball" />
            <line x1="2.6" y1="-3.6" x2="2.6" y2="3.6" className="sm-line" strokeWidth="1.4" />
          </g>
        </g>
      </g>
    </>
  ),
  cricket: (
    <>
      {ground}
      {/* stumps and bails */}
      <path d="M99 42 V74 M104 42 V74 M109 42 V74" className="sm-line" strokeWidth="2" strokeLinecap="round" />
      <path d="M98 40 H104 M104.5 40 H110" className="sm-line" strokeWidth="1.6" strokeLinecap="round" />
      <g className="sm-streaks">
        <path d="M22 50 H42 M16 57 H44 M26 64 H40" className="sm-line-faint" strokeWidth="2" strokeLinecap="round" />
      </g>
      <g className="sm-spin">
        <defs>
          <clipPath id="sm-cricket-clip">
            <circle cx="64" cy="57" r="15" />
          </clipPath>
        </defs>
        <circle cx="64" cy="57" r="15" className="sm-ball" />
        <g clipPath="url(#sm-cricket-clip)" transform="rotate(-30 64 57)">
          <ellipse cx="64" cy="57" rx="6" ry="16" fill="none" className="sm-seam" strokeWidth="1.3" />
          <ellipse cx="64" cy="57" rx="8.6" ry="16" fill="none" className="sm-seam" strokeWidth="1.1" strokeDasharray="1.2 2.2" />
          <ellipse cx="64" cy="57" rx="3.4" ry="16" fill="none" className="sm-seam" strokeWidth="1.1" strokeDasharray="1.2 2.2" />
        </g>
        <circle cx="58" cy="51" r="4" className="sm-shine" />
      </g>
    </>
  ),
  football: (
    <>
      {ground}
      <ellipse cx="60" cy="74" rx="14" ry="2.6" className="sm-shadow sm-shadow-bounce" />
      <g className="sm-bounce">
        <g className="sm-roll">
          <circle cx="60" cy="58" r="16" className="sm-ball-light" />
          <path d="M60 52 L65.7 56.1 L63.5 62.9 L56.5 62.9 L54.3 56.1 Z" className="sm-patch" />
          <path d="M60 52 V42 M65.7 56.1 L75.2 53.1 M63.5 62.9 L69.4 70.9 M56.5 62.9 L50.6 70.9 M54.3 56.1 L44.8 53.1" className="sm-line-dark" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M55 42.8 L60 42 L65 42.8 L63 45.5 L57 45.5 Z M73.8 49 L75.6 53.4 L74.8 58.2 L71.7 56.3 L71.6 51.6 Z M46.2 49 L44.4 53.4 L45.2 58.2 L48.3 56.3 L48.4 51.6 Z" className="sm-patch" />
        </g>
      </g>
    </>
  ),
  tennis: (
    <>
      <line x1="8" y1="74" x2="112" y2="74" className="sm-line" strokeWidth="2" strokeLinecap="round" />
      <line x1="60" y1="74" x2="60" y2="66" className="sm-line" strokeWidth="2" strokeLinecap="round" />
      <g className="sm-streaks">
        <path d="M18 34 H44 M12 42 H48 M22 50 H42" className="sm-line-faint" strokeWidth="2" strokeLinecap="round" />
      </g>
      <g className="sm-swing">
        <defs>
          <clipPath id="sm-tennis-clip">
            <circle cx="70" cy="42" r="14" />
          </clipPath>
        </defs>
        <circle cx="70" cy="42" r="14" className="sm-ball" />
        <g clipPath="url(#sm-tennis-clip)">
          <path d="M57.5 30 C66 36 66 48 57.5 54 M82.5 30 C74 36 74 48 82.5 54" fill="none" className="sm-seam" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      </g>
    </>
  ),
  swimming: (
    <>
      {/* lane rope */}
      <line x1="8" y1="70" x2="112" y2="70" className="sm-line-faint" strokeWidth="1.5" strokeDasharray="5 3" />
      <g className="sm-wave-back">
        <path d={wave(46, 3.2)} className="sm-water-back" />
      </g>
      <g className="sm-bob">
        {/* body just under the surface, kick splashes behind */}
        <path d="M60 50 L86 51" className="sm-line-faint" strokeWidth="5" strokeLinecap="round" />
        <path d="M90 47 l3 -3 M95 48 l3 -2" className="sm-line-faint" strokeWidth="1.4" strokeLinecap="round" />
        <g className="sm-arm">
          <path d="M60 47 L60 33 L52 30" fill="none" className="sm-line" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <g className="sm-arm sm-arm-2">
          <path d="M60 47 L60 33 L52 30" fill="none" className="sm-line" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <circle cx="52" cy="47" r="5" className="sm-skin" />
        <path d="M47 47 a5 5 0 0 1 10 0 Z" className="sm-ball" />
      </g>
      <g className="sm-wave-front">
        <path d={wave(49, 2.6)} className="sm-water-front" />
      </g>
    </>
  ),
  basketball: (
    <>
      {ground}
      <line x1="104" y1="10" x2="104" y2="36" className="sm-line" strokeWidth="2.6" strokeLinecap="round" />
      <line x1="104" y1="30" x2="100" y2="30" className="sm-line" strokeWidth="2" />
      <g className="sm-shot">
        <g className="sm-spin-fast">
          <circle cx="91" cy="66" r="8" className="sm-ball" />
          <path d="M83 66 H99 M91 58 V74 M85.4 60.4 Q89 66 85.4 71.6 M96.6 60.4 Q93 66 96.6 71.6" fill="none" className="sm-line-dark" strokeWidth="1" />
        </g>
      </g>
      <g className="sm-net">
        <path d="M82 30 L85 44 M86.5 30 L88 44 M91 30 V44 M95.5 30 L94 44 M100 30 L97 44 M83.4 36.5 H98.6 M84.6 41.5 H97.4" fill="none" className="sm-line" strokeWidth="0.9" />
      </g>
      <line x1="81" y1="30" x2="101" y2="30" className="sm-rim" strokeWidth="2.6" strokeLinecap="round" />
    </>
  ),
  multi: (
    <>
      {ground}
      {[28, 60, 92].map((x) => (
        <ellipse key={x} cx={x} cy="74" rx="11" ry="2.2" className="sm-shadow" />
      ))}
      <g className="sm-hop" style={{ animationDelay: "0ms" }}>
        <circle cx="28" cy="59" r="14" className="sm-ball-light" />
        <path d="M28 54 L32.8 57.5 L31 63.1 L25 63.1 L23.2 57.5 Z" className="sm-patch" />
        <path d="M28 54 V49 M32.8 57.5 L37.5 56 M31 63.1 L34 67 M25 63.1 L22 67 M23.2 57.5 L18.5 56" className="sm-line-dark" strokeWidth="1.1" />
        <path d={OUTER_PATCHES} className="sm-patch" />
      </g>
      <g className="sm-hop" style={{ animationDelay: "160ms" }}>
        <circle cx="60" cy="59" r="14" style={{ fill: "rgb(var(--ball-tennis))" }} />
        <path d="M48 49 C56 54 56 64 48 69 M72 49 C64 54 64 64 72 69" fill="none" className="sm-seam" strokeWidth="1.7" />
      </g>
      <g className="sm-hop" style={{ animationDelay: "320ms" }}>
        <circle cx="92" cy="59" r="14" style={{ fill: "rgb(var(--ball-cricket))" }} />
        <path d="M87 46 C83 52 83 66 87 72" fill="none" className="sm-seam" strokeWidth="1.3" />
        <path d="M84.2 47.5 C80.5 53 80.5 65 84.2 70.5 M89.8 46 C86 52 86 66 89.8 72" fill="none" className="sm-seam" strokeWidth="1" strokeDasharray="1.2 2" />
      </g>
    </>
  ),
};

/** Seamless sine wave (period 30) from x=-30 to 150, filled down to the bottom. */
function wave(y: number, amp: number) {
  let d = `M-30 ${y}`;
  for (let x = -30; x < 150; x += 30) d += ` q7.5 ${-amp} 15 0 t15 0`;
  return d + " V80 H-30 Z";
}
