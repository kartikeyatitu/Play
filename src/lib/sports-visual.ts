/**
 * Visual identity per sport: accent colour tokens.
 * Keys match LIVE_SPORTS in src/lib/live-match.ts. Values are CSS custom property names
 * defined for light and dark in src/app/themes.css (each >= 4.5:1 on canvas and surface).
 *
 * The academy's own --brand colour is a separate override and is never replaced by these:
 * use sport accents for sport identity (icons, chips, live-card rails), --brand for the academy.
 */

export const SPORT_ACCENT = {
  cricket: "--sport-cricket",
  football: "--sport-football",
  futsal: "--sport-futsal",
  basketball: "--sport-basketball",
  hockey: "--sport-hockey",
  kabaddi: "--sport-kabaddi",
  handball: "--sport-handball",
  badminton: "--sport-badminton",
  table_tennis: "--sport-table-tennis",
  volleyball: "--sport-volleyball",
  squash: "--sport-squash",
  pickleball: "--sport-pickleball",
  tennis: "--sport-tennis",
  karate: "--sport-karate",
  taekwondo: "--sport-taekwondo",
  wrestling: "--sport-wrestling",
  boxing: "--sport-boxing",
  athletics: "--sport-athletics",
  swimming: "--sport-swimming",
  skating: "--sport-skating",
  cycling: "--sport-cycling",
  chess: "--sport-chess",
} as const;

export type SportKey = keyof typeof SPORT_ACCENT;

export function isSportKey(v: unknown): v is SportKey {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(SPORT_ACCENT, v);
}

/**
 * CSS colour for a sport, falling back to the theme accent for unknown sports:
 * `var(--sport-cricket, var(--volt))`. Use in style props, e.g. `style={{ color: sportAccentVar("cricket") }}`.
 */
export function sportAccentVar(sport: string | null | undefined): string {
  if (!isSportKey(sport)) return "var(--volt)";
  return `var(${SPORT_ACCENT[sport]}, var(--volt))`;
}
