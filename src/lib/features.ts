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
  coachOS: flag("COACH_OS", true),
  /**
   * TRIQ Commerce (V8): the academy Kit Store (admin "Kit Store" tab + parent "Pro Shop") with
   * stock reservation, price snapshots and the order lifecycle. Pay at academy only — no online
   * checkout. Requires prisma/sql/2026-10-26_store_orders.sql. (The public /academies directory is
   * not gated by this flag.)
   */
  marketplace: flag("MARKETPLACE", true),
  /** Athlete profiles, assessments, rankings (Athlete OS). */
  athleteOS: flag("ATHLETE_OS", true),
  /** V2: printable monthly progress report per athlete (attendance + coach skill reports). No schema. */
  progressReport: flag("PROGRESS_REPORT", true),
  /** V2: trials / scholarships board with guardian-consented applications. Needs 2026-10-26_athlete_vertical.sql. */
  opportunities: flag("OPPORTUNITIES", true),
  /** V10: schools / colleges / universities — institution profile, programs, teams, participation. Needs 2026-10-26_education.sql. */
  education: flag("EDUCATION", true),
  /** Tournaments / brackets. TRIQ Play competitions — apply prisma/sql/2026-10-26_competitions.sql first. */
  events: flag("EVENTS", true),
  /** TRIQ Spaces operator tools: blocked slots, reschedule, cancellation policy, utilisation, booking history. */
  spacesOps: flag("SPACES_OPS", true),
  /** TRIQ Spaces public venue discovery listing at /venues. */
  spacesDiscovery: flag("SPACES_DISCOVERY", true),
  /** Corporate sports programs. */
  corporate: flag("CORPORATE", false),
  /** V7 Communities: read receipts, parent replies and moderation on announcements. */
  communities: flag("COMMUNITIES", true),
  /** V1 Business: branches (academy locations) + batch → branch. Needs prisma/sql/2026-10-25_branches.sql
   *  and 2026-10-26_batch_branches.sql applied first — the Branch tables are never queried while this is off. */
  branches: flag("BRANCHES", true),
  /** V1 Business: unified operations calendar (sessions, planned batches, trials, holidays, court allocations,
   *  turf bookings, leases, blocked slots; day/week, filters, coach/court conflict highlighting). Read-only. No SQL. */
  opsCalendar: flag("OPS_CALENDAR", true),
  /** V1 Business: allocate batches to courts/facilities as weekly bookings (uses the turf booking engine). No SQL. */
  facilityAllocation: flag("FACILITY_ALLOCATION", true),
  /** V1 Business: GST tax invoices + credit notes for paid fees (org tax profile, FY numbering, CGST/SGST/IGST).
   *  Needs prisma/sql/2026-10-26_gst_invoices.sql — the GST tables are never queried while this is off. */
  gstInvoices: flag("GST_INVOICES", true),
  /** V1 Business: UPI AutoPay monthly fee mandates on the academy's own Razorpay account (recurring payments).
   *  Needs prisma/sql/2026-10-26_upi_autopay.sql and UPI recurring enabled on the academy's Razorpay account. */
  upiAutopay: flag("UPI_AUTOPAY", true),
  /** V1 Business: monthly business report (revenue, outstanding, attendance, utilisation). No SQL. */
  businessReport: flag("BUSINESS_REPORT", true),
  /** V1/V11: audit-log viewer with filters and CSV export (owners only). No SQL. */
  auditLogViewer: flag("AUDIT_LOG_VIEWER", true),
  /** V1 Business growth tools (ex-Rewards): parent referrals (convert on enrolment) and coupon admin. Coupons are
   *  not redeemable yet, and no referral reward is promised. No SQL. */
  growthTools: flag("GROWTH_TOOLS", true),
  /** V11 Enterprise: consolidated report across academies (and branches) the viewer may report on. No SQL. */
  enterprise: flag("ENTERPRISE", true),
  /** TRIQ Brand Studio (V9): sponsors, campaigns, proposals, deliverables. Needs 2026-10-26_brand_studio.sql. */
  sponsorship: flag("SPONSORSHIP", true),
  /**
   * TRIQ Brand Studio (V9): scholarship / CSR programs and fee concessions. Changes billing — monthly
   * fee generation applies active concessions when on. Needs 2026-10-26_brand_studio.sql.
   */
  inclusive: flag("INCLUSIVE", true),
  /** Instagram/social generators, AI "insights" that are heuristics rather than real analytics. */
  experimental: flag("EXPERIMENTAL", false),

  /** V5 TRIQ Careers: professional profiles, job listings, applications, credential verification. */
  careers: flag("CAREERS", true),
  /** V6 TRIQ Wellness: health.* permissions on medical data, provider profiles, appointments. */
  wellness: flag("WELLNESS", true),
  /** V7 TRIQ Creators: creator profiles, portfolio links, discovery, reporting. */
  creators: flag("CREATORS", true),
  /**
   * AI drafts and summaries (Claude API): coach note drafts, business report explanations.
   * Also needs ANTHROPIC_API_KEY; without it no AI button is shown. Spend capped by AI_MONTHLY_BUDGET_INR.
   */
  aiAssist: flag("AI_ASSIST", true),
  /** Owner insights on the Analytics tab: daily snapshot, fee ageing, 12-month trends. Read-only, no schema. */
  ownerInsights: flag("OWNER_INSIGHTS", true),
  /** At-risk students on the Analytics tab: risk score from attendance, overdue fees and tenure, with a WhatsApp draft. */
  atRiskStudents: flag("AT_RISK_STUDENTS", true),
  /** Live scoring: point-by-point scorer, live scoreboard and share link (prisma/sql/2026-10-28_live_scoring.sql, applied). */
  liveScoring: flag("LIVE_SCORING", true),
  /** Enquiry funnel by source and new-student retention cohorts on the Analytics tab. Read-only, no schema. */
  funnelCohorts: flag("FUNNEL_COHORTS", true),
  /** Ask TRIQ: plain-language questions routed by AI to approved reports (needs ANTHROPIC_API_KEY). */
  askTriq: flag("ASK_TRIQ", true),
  /** Coach insights (current month: sessions marked, attendance, evaluations) on the Analytics tab. */
  coachInsights: flag("COACH_INSIGHTS", true),
  /** Weekly summary on the Analytics tab with a Share on WhatsApp button (no automatic sending). */
  weeklyDigest: flag("WEEKLY_DIGEST", true),

  // ---- Wave 2 (all default OFF). Tables: prisma/sql/2026-10-29_wave2.sql — NOT APPLIED; never query
  // ---- them while the flag is off. Spec: docs/specs/wave2-schema.md.
  /** Rewards: points/XP ledgers, badges, reward catalogue, redemptions, leaderboard opt-in. */
  rewards: flag("REWARDS", false),
  /** Photo/video uploads with student tagging, per-scope guardian media consent and audit (MediaAsset*). */
  media: flag("MEDIA", false),
  /** Family accounts: several guardians per child, several children per guardian (GuardianLink). */
  familyAccounts: flag("FAMILY_ACCOUNTS", false),
  /** Versioned liability waivers and guardian e-signatures (WaiverTemplate, WaiverSignature). */
  waivers: flag("WAIVERS", false),
  /** DPDP verifiable parental consent ledger, per purpose (ConsentRecord). */
  consentLedger: flag("CONSENT_LEDGER", false),
  /** Drill library and coach session plans (Drill, SessionPlan, SessionPlanItem). */
  drillLibrary: flag("DRILL_LIBRARY", false),
  /** Competition fixtures UI extras on the existing Fixture table + computed standings. No new table. */
  fixtures: flag("FIXTURES", false),
  /** Per-event waitlist with offers that expire (EventWaitlist). */
  eventWaitlist: flag("EVENT_WAITLIST", false),
  /** Outbound WhatsApp/email/SMS delivery log with retries, and notification preferences. */
  messageDelivery: flag("MESSAGE_DELIVERY", false),
  /** Parent/user data deletion and export requests (DataRequest). */
  dataRequests: flag("DATA_REQUESTS", false),
  /** Void a receipt (kept, marked, with reason) instead of deleting it (Receipt.voidedAt/voidReason/voidedById). */
  receiptVoid: flag("RECEIPT_VOID", false),
  /** Standardised fitness tests with decimal values and units (FitnessResult). */
  fitnessTests: flag("FITNESS_TESTS", false),
  /** Parent-reported absences, stored as Attendance status EXCUSED (no new table). */
  absenceNotices: flag("ABSENCE_NOTICES", false),
  /** TRIQ's own per-active-student plan invoices in paise with GST (SubscriptionInvoice). */
  triqBilling: flag("TRIQ_BILLING", false),
  /** Parent premium plan placeholder (ParentPlan). */
  parentPremium: flag("PARENT_PREMIUM", false),
} as const;

export type FeatureName = keyof typeof FEATURES;
