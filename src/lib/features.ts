/**
 * Feature flags — one place to turn product areas on/off.
 *
 * Triq's launch focus is Academy OS (+ turf bookings). Everything else is built or partly built
 * but hidden until real academies ask for it. Flip a flag to true (or set the env var
 * NEXT_PUBLIC_FEATURE_<NAME>=1) to expose it again — no code removal needed.
 *
 * Safe to import from both server and client code (NEXT_PUBLIC_ vars are inlined at build).
 */
function flag(name: string, fallback: boolean): boolean {
  const v = process.env[`NEXT_PUBLIC_FEATURE_${name}`];
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  return fallback;
}

export const FEATURES = {
  /** Core product — always on. */
  academyOS: true,
  /** Turf / court slot bookings (Milestone 4). */
  bookings: flag("BOOKINGS", true),

  /** Public coach profiles / creator pages / coaching registry (Coach OS). Hidden for launch. */
  coachOS: flag("COACH_OS", false),
  /** Public academy & coach directory / marketplace. Hidden for launch. */
  marketplace: flag("MARKETPLACE", false),
  /** Athlete profiles, assessments, rankings (Athlete OS). */
  athleteOS: flag("ATHLETE_OS", false),
  /** Tournaments / brackets. TRIQ Play competitions — apply prisma/sql/2026-10-26_competitions.sql first. */
  events: flag("EVENTS", false),
  /** TRIQ Spaces operator tools: blocked slots, reschedule, cancellation policy, utilisation, booking history. */
  spacesOps: flag("SPACES_OPS", false),
  /** TRIQ Spaces public venue discovery listing at /venues. */
  spacesDiscovery: flag("SPACES_DISCOVERY", false),
  /** Corporate sports programs. */
  corporate: flag("CORPORATE", false),
  /** Instagram/social generators, AI "insights" that are heuristics rather than real analytics. */
  experimental: flag("EXPERIMENTAL", false),
} as const;

export type FeatureName = keyof typeof FEATURES;
