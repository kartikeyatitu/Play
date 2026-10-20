/**
 * Canonical enum values for domain lifecycle states.
 *
 * Kept in their own file (no Prisma import) so test files can import the
 * tuples without pulling in the Postgres client. Server actions re-export
 * from here.
 *
 * If you add a value, verify it against the production DB first (every
 * historic row must map to something in the tuple).
 */

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "TRIAL_BOOKED",
  "TRIAL_ATTENDED",
  "ENROLLED",
  "LOST",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const TRIAL_STATUSES = [
  "SCHEDULED",
  "ATTENDED",
  "NO_SHOW",
  "ENROLLED",
  "DECLINED",
  "CANCELLED",
] as const;
export type TrialStatus = (typeof TRIAL_STATUSES)[number];
