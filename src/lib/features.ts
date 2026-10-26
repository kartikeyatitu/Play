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
  /**
   * TRIQ Commerce (V8): the academy Kit Store (admin "Kit Store" tab + parent "Pro Shop") with
   * stock reservation, price snapshots and the order lifecycle. Pay at academy only — no online
   * checkout. Requires prisma/sql/2026-10-26_store_orders.sql. (The public /academies directory is
   * not gated by this flag.)
   */
  marketplace: flag("MARKETPLACE", false),
  /** Athlete profiles, assessments, rankings (Athlete OS). */
  athleteOS: flag("ATHLETE_OS", false),
  /** V2: printable monthly progress report per athlete (attendance + coach skill reports). No schema. */
  progressReport: flag("PROGRESS_REPORT", false),
  /** V2: trials / scholarships board with guardian-consented applications. Needs 2026-10-26_athlete_vertical.sql. */
  opportunities: flag("OPPORTUNITIES", false),
  /** V10: schools / colleges / universities — institution profile, programs, teams, participation. Needs 2026-10-26_education.sql. */
  education: flag("EDUCATION", false),
  /** Tournaments / brackets. TRIQ Play competitions — apply prisma/sql/2026-10-26_competitions.sql first. */
  events: flag("EVENTS", false),
  /** TRIQ Spaces operator tools: blocked slots, reschedule, cancellation policy, utilisation, booking history. */
  spacesOps: flag("SPACES_OPS", false),
  /** TRIQ Spaces public venue discovery listing at /venues. */
  spacesDiscovery: flag("SPACES_DISCOVERY", false),
  /** Corporate sports programs. */
  corporate: flag("CORPORATE", false),
  /** V7 Communities: read receipts, parent replies and moderation on announcements. */
  communities: flag("COMMUNITIES", false),
  /** V1 Business: branches (academy locations) + batch → branch. Needs prisma/sql/2026-10-25_branches.sql
   *  and 2026-10-26_batch_branches.sql applied first — the Branch tables are never queried while this is off. */
  branches: flag("BRANCHES", false),
  /** V1 Business: operational calendar (sessions, planned batches, trials, holidays, court allocations). No SQL. */
  opsCalendar: flag("OPS_CALENDAR", false),
  /** V1 Business: allocate batches to courts/facilities as weekly bookings (uses the turf booking engine). No SQL. */
  facilityAllocation: flag("FACILITY_ALLOCATION", false),
  /** V1 Business: monthly business report (revenue, outstanding, attendance, utilisation). No SQL. */
  businessReport: flag("BUSINESS_REPORT", false),
  /** V1/V11: audit-log viewer with filters and CSV export (owners only). No SQL. */
  auditLogViewer: flag("AUDIT_LOG_VIEWER", false),
  /** V11 Enterprise: consolidated report across academies (and branches) the viewer may report on. No SQL. */
  enterprise: flag("ENTERPRISE", false),
  /** TRIQ Brand Studio (V9): sponsors, campaigns, proposals, deliverables. Needs 2026-10-26_brand_studio.sql. */
  sponsorship: flag("SPONSORSHIP", false),
  /**
   * TRIQ Brand Studio (V9): scholarship / CSR programs and fee concessions. Changes billing — monthly
   * fee generation applies active concessions when on. Needs 2026-10-26_brand_studio.sql.
   */
  inclusive: flag("INCLUSIVE", false),
  /** Instagram/social generators, AI "insights" that are heuristics rather than real analytics. */
  experimental: flag("EXPERIMENTAL", false),

  /** V5 TRIQ Careers: professional profiles, job listings, applications, credential verification. */
  careers: flag("CAREERS", false),
  /** V6 TRIQ Wellness: health.* permissions on medical data, provider profiles, appointments. */
  wellness: flag("WELLNESS", false),
  /** V7 TRIQ Creators: creator profiles, portfolio links, discovery, reporting. */
  creators: flag("CREATORS", false),
} as const;

export type FeatureName = keyof typeof FEATURES;
