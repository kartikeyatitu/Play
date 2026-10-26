# TRIQ feature + AI audit (read-only)

- Code audited: `origin/main` at `d7f2fef` ("fix(security): move cron fee generation out of server actions"), which includes the merged branches build/v-athlete-education, v-commerce-brand, v-business-enterprise, v-play-spaces and v-careers-wellness-creators. I exported it with `git archive` to a scratch folder. The `/home/claude/triq` working tree (still at `483b543`) was not touched.
- What I did: static reading of every `page.tsx` and `route.ts` under `src/app`, every `"use server"` file (69 files in `src/app/actions` plus `src/app/{book,join,academies,ops/*}/actions.ts`), and an auth/orgId scan of all ~240 exported actions. I also read schema metadata (table and column names only) from the two active Supabase projects. I ran no tsc, vitest or build.
- What I could not do: Vercel runtime errors (the API returned 403 for project "sportsos"), and production row-level reads (the permission classifier blocked them). So I could not confirm which Supabase project is production. Treat the findings marked "DB" as needing that check.
- All line numbers refer to `origin/main` (`d7f2fef`).

---

## 0. Most serious findings first

| # | Severity | Finding | Where |
|---|---|---|---|
| 1 | **Critical (verify now)** | **The Prisma schema and the live DBs disagree.** `SkillReport.sport` and `SkillReport.metrics` are in `schema.prisma` (since commit 3882fd2, 2026-10-19), but neither active Supabase project has those columns (`triq`/ap-south-1 and `Sportos`/ap-northeast-1). Prisma selects every scalar by default. So every query that loads skill reports without a `select` throws `column does not exist`: the coach dashboard (`coach/page.tsx:78`), the parent dashboard (`parent/page.tsx:43`), the student profile (`student/[id]/page.tsx:52`) and `submitSkillReport` (`actions/reports.ts:27`). Either production uses a different DB, or these screens are failing right now. | `prisma/schema.prisma` model SkillReport; there is no SQL file in `prisma/sql/` |
| 2 | **Critical (release blocker for verticals)** | **None of the vertical tables exist in either DB.** Missing: Branch, BatchBranch, Competition/Entry/Fixture, Athlete*, Opportunity*, Institution/Program/Team/Participation, Professional*/Job*, Wellness*, StoreOrder*, Sponsor*/Scholarship/FeeConcession. The ten `prisma/sql/2026-10-25/26_*.sql` files have not been applied. Turning on any flag (events, careers, wellness, marketplace, sponsorship, inclusive, education, opportunities, athleteOS, branches) will crash the screens it unlocks. There is no migrations folder; schema changes are hand-run SQL plus runtime DDL in `requireAuth` → `ensureTeamSchema` (`lib/auth.ts:77`, `lib/schema-ensure.ts`). | DB / `prisma/sql/*` |
| 3 | **High** | **The staff permission matrix does nothing.** `requirePermission`/`checkPermission` call `requireMember(["ADMIN"])` (`lib/membership.ts:44,77`). STAFF members (Receptionist, Accountant, Physio, Groundsman, `lib/team.ts:66-69`) have app role STAFF (`team.ts:115-119`), so every permission-gated action rejects them. `/staff` (`staff/page.tsx:12`) shows only check-in. The same applies to coaches: per-person overrides such as granting a coach `fees.collect` never apply, and `attendance.mark` is never checked (`actions/attendance.ts:18` checks role only). | `lib/membership.ts`, `lib/team.ts` |
| 4 | **High** | **Cross-tenant impersonation chain.** (a) `addTeamMember` attaches any existing coach or staff phone number to the caller's academy as an ACTIVE member, with no consent or acceptance step (`actions/team.ts:125-155`). (b) `createLoginLink` lets an owner mint a 7-day sign-in link that logs in *as* any user whose `User.orgId` equals the owner's academy (`actions/login-links.ts:37-75`). (c) That user's other memberships stay reachable through `switchAcademy` (`team.ts:351-357`). An owner of academy A can therefore become a coach who also works at academy B and read B's rosters, parent phone numbers and medical alerts. | team.ts, login-links.ts |
| 5 | **High** | **Anyone can add students to any academy without signing in.** `/join` `registerParent` creates a parent and student and **enrolls the child into a batch immediately**, with no academy approval (`app/join/actions.ts:14-125`). The monthly cron then bills these rows (`lib/monthly-fees-server.ts:16-37`). The rate limit is in-memory and per instance (`lib/rate-limit.ts:12`), so it is ineffective on serverless. The same applies to `bookTrial` (`actions/trial.ts:69`). | join/actions.ts, trial.ts |
| 6 | **High** | **/org shows all data to any manager regardless of permissions.** `/org` uses `requireAuth(["ADMIN"])` only (`org/page.tsx:225`). It loads revenue, all dues, leads and coach `verificationData` (ID-proof URLs, `:279`) for a MANAGER whose `fees.*`, `reports.view` or `leads.manage` has been removed. `AdminClient` has no permission gating at all. Only the payroll pulse checks a permission (`:324`). | org/page.tsx, AdminClient.tsx |
| 7 | High | **Money is stored as Float.** `FeeRecord.amount`, `Product.price` and `TurfBooking` amounts are Float. `FeeRecord.orgId` and `Student.orgId` are nullable, so tenant scoping depends on OR-joins (`org/page.tsx:232`). This contradicts the scope's "monetary precision" rule. Newer modules correctly use `*Paise` integers. | schema.prisma:582, 660 |
| 8 | Medium | **Unauthenticated exported actions.** `getFeeReceiptAction(feeRecordId)` has no auth check and returns the receipt number and public token URL (`actions/payments.ts:167`). It is currently unreferenced (dead), but it is still exported from a `"use server"` file. `releaseHold(bookingId)` lets anyone expire a hold by its id (`book/actions.ts:230`). | |
| 9 | Medium | **Audit log can be forged.** `logAction` lets any ADMIN write arbitrary `action`/`details` rows to the audit trail (`actions/audit.ts:18`). It is not called anywhere (dead), but it is exported. | |
| 10 | Medium | **Children's names exposed to other parents.** Every parent sees the names and points of the top 10 children in the academy (`parent/page.tsx:49-53`), with no consent. Admins can create "testimonials" on behalf of a parent (`actions/testimonials.ts:32-55`), which is a fabricated-review risk. | |
| 11 | Medium | **Medical data permissions are inconsistent.** Coaches can edit medical info with no `health.manage` check (`actions/medical.ts:36-41`). With the wellness flag off, `medicalInfo` stores arbitrary client keys (`:51`). The coach page sends medical summaries to the client for every student (`coach/page.tsx:156-162,200`). | |
| 12 | Medium | **N+1 and unbounded queries.** Cron fee generation does findUnique+create per student (`monthly-fees-server.ts:25-37`); `createMany({skipDuplicates})` would do it in one statement. `recalculateAllPoints` runs `Promise.all` over every student, each loading full attendance history, which can exhaust the pool (`actions/points.ts:66`). `getLeads`/`getLeadStats` are unbounded (`leads.ts:9,111`). The coach page loads **all** of the academy's fee records for the month, not just the coach's students (`coach/page.tsx:104`). The parent page runs 3 queries per child (`parent/page.tsx:83-109`). | |
| 13 | Medium | **India-only assumptions.** `Organization` has `country/currency/timezone/locale/phoneCountry` (they exist in the DB), but code hard-codes ₹ (53 files), `Asia/Kolkata`/IST helpers (18), `en-IN` (41) and `cleanIndianPhone` (12 files, including staff, import and registration). Examples: SOS dials 112/108 (`coach/EmergencySOS.tsx:97-106`); referral discount is 500 (`referrals.ts:51`); `lib/turf.ts:3` has a TODO for org timezone; `org/page.tsx:239` computes `monthStart` in server-local time (UTC on Vercel) rather than org time. | |
| 14 | Low/Med | **Destructive and auth hygiene.** `deleteAllData` is not transactional, needs only a `confirm()` (no re-auth or typed name) and deletes the audit log too (`actions/delete.ts:28-132`). The cron secret is compared with `!==` rather than timing-safe (`api/cron/monthly-fees/route.ts:21`). OTP and `/join` messages leak account existence ("Account not found", "registered with a different academy", `auth.ts:124`, `join/actions.ts:~92`). Two registration paths have different rules: `registerWithEmail` accepts 6-character passwords with no rate limit (`auth.ts:264`) while `registerAcademy` requires 8. | |
| 15 | Low | **Fabricated or "mock" content shown to real users.** The public academy page has a hard-coded "About" paragraph, labelled "Mock description" in code (`academy/[slug]/page.tsx:106`). `FeePricingAnalyzer` has invented city fee "market benchmarks" (behind the experimental flag, `org/FeePricingAnalyzer.tsx:14-19`). The "AI Insights" tab is rule-based (behind the experimental flag). | |

---

## 1. Platform-level observations

- **Identity model.** One `User` row per phone number and one global role (`SUPER_ADMIN|ADMIN|COACH|STAFF|PARENT`). The consequences:
  - A person cannot be both a parent and a coach (`team.ts:131`).
  - A parent cannot belong to two academies (`join/actions.ts:~92`).
  - **There is no STUDENT/athlete login.** Athlete features are reached only through the parent.
  - Professionals and wellness providers who are not attached to an academy have no sign-up path: OTP requires an existing user, and email sign-up creates an ADMIN who lands on `/onboarding`. Careers and Wellness therefore only work for people who already have an academy account.
- **Session.** HMAC-signed cookie, role re-read from the DB, `sessionVersion` revocation. This is solid. `requireAuth` runs `ensureTeamSchema` (DDL check) and a throttled `lastSeenAt` write on every authenticated request.
- **Flags** (`lib/features.ts`). Only `academyOS` and `bookings` are on by default. Everything else is off: coachOS, marketplace, athleteOS, progressReport, opportunities, education, events, spacesOps, spacesDiscovery, corporate, communities, branches, opsCalendar, facilityAllocation, businessReport, auditLogViewer, enterprise, sponsorship, inclusive, experimental, careers, wellness, creators. I could not read production env values.
- **Notifications.** There is no email provider. "Notifications" means chat messages from the last 24h (`actions/notifications.ts`). WhatsApp is either manual `wa.me` links (41 files) or Cloud API templates where configured (`lib/whatsapp.ts`). There is no delivery status, retry or user preference.
- **Dead code.** These are imported nowhere:
  - parent: CarpoolMatcher, DownloadReceipt, AchievementBadges, WeeklyTimetable, AutoProgressReport
  - coach: TrainingPlan, QRScanner
  - org: CoachProfile, Leaderboard, BulkActions, StudentTable, StudentQRCode, AuditLogViewer, FeePlans
  - 16 `ui/*` components (notification-bell, paginated-table, error-boundary, etc.)
  - Exported actions never called from UI: `getFeeReceiptAction`, `logAction`, the legacy `placeOrder`/`toggleFeeStatus`, and the duplicate `createReferral` in both `referral.ts` and `referrals.ts`.

---

## 2. Part A: features by role

Legend: **W** = Working (persisted, auth and orgId checks). **P** = Partial. **UI** = UI-only or mocked. **B** = Broken. **D** = Dead (never linked or mounted). **F** = behind a flag that is off by default (tables are missing in the DB, see finding 2). The vertical number is in brackets.

### 2.1 Owner / Manager (app role ADMIN, `/org`)

| Feature | Status | Notes / defects |
|---|---|---|
| Academy registration (`/register`, `registerAcademy`) and onboarding wizard (`/onboarding`, `createAcademyWorkspace`) [1] | W | India-only phone. Optional sample data writes fake coaches/students into the real academy (`onboarding.ts:127-165`). Two sign-up paths with different password rules. |
| Academy profile, UPI, default fee, locale (`academy.ts`) [1] | W | Owner-only. `updateAcademy` does not validate field lengths. |
| Razorpay connect (own keys, encrypted) [1] | W | Owner-only, keys verified live. In-memory rate limit. |
| Team: add/edit/remove coach, manager, staff; custom permissions (`team.ts`) [1/11] | P | No consent step (finding 4). Staff permissions do nothing (finding 3). |
| Staff attendance, self check-in/out [1] | W | |
| Payroll and expenses (`payroll.ts`) [1] | W | Permission-gated, audited. |
| Students: create, import (CSV/Excel/WhatsApp roster), export, transfer, edit fee override [1] | W | `createStudent`/import use Indian phone only. Paginated list of 20. |
| Parent self-registration via `/join?academy=` [1] | P | Auto-enrolls without approval (finding 5). |
| Batches: create, update, delete, capacity, fee; branch assignment (F branches) [1/11] | W / F | |
| Auto-generate today's sessions / monthly fees (buttons) [1] | W | `auto-fees.ts` is permission-gated. The cron path is now in `lib/monthly-fees-server.ts` (good) but has an N+1. |
| Trials → leads → convert to student (`trial-convert.ts`, `leads.ts`) [1] | W | Public `bookTrial`: in-memory rate limit, past dates allowed, org `isActive` not checked. |
| Waitlist [1] | W | Manual only: nothing promotes from the waitlist when a seat frees. |
| Fees: collect, mark paid (idempotent), reverse with reason, confirm or reject parent "I've paid", receipts, payment links, online Razorpay/Stripe [1] | W | `reverseFeePayment` logs only to the console (`fees.ts:125`), not AuditLog, and the receipt is not voided. Money is Float. |
| Fee plans (monthly/quarterly/annual) [1] | **UI** | Stored, but never used by fee generation or checkout (`feePlan` is read only in onboarding seed). |
| Coupons [1] | **UI** | Created and listed in the Fees tab, but never redeemed anywhere (`usedCount` never increments). |
| Referral program [1] | **UI / D** | Marketing tab is experimental. Status is never set to CONVERTED by real flows. Duplicate actions. |
| Announcements / broadcast [1] | W | Requires `settings.manage`. No delivery tracking. |
| Messages / chat [1] | P | Persisted. Parents can only reach the *first* ADMIN found (`parent/page.tsx:55`). No pagination beyond 300/500 rows. No notifications. |
| Analytics tab, Today pulse, low-attendance list [1] | W | Real SQL aggregates. Not permission-gated (finding 6). |
| AI Insights / Marketing (Instagram, social posts, churn, revenue forecast, pricing) [1] | **UI** (F experimental) | Heuristics; pricing benchmarks are invented. |
| Business report (F businessReport) [1] | W-F | Real data, `reports.view`. |
| Audit log viewer + CSV export (F auditLogViewer) [11] | W-F | `settings.manage`. `AuditLogViewer.tsx` (old) is dead; `AuditLogPanel` is live. |
| Operations: facilities, equipment, transport routes, holidays [1/4] | P | Transport stores free-text `studentNames` JSON instead of student links. Holiday date is parsed with `new Date(dateStr)` (UTC shift). Holidays do not block session generation (no reference found). |
| Ops calendar (F opsCalendar), court allocation for batches (F facilityAllocation) [1/4] | W-F | |
| Turf/court bookings board, counter bookings, public `/book/[slug]` with Razorpay/UPI hold [4] | W | `bookings` flag is on. Atomic holds. UPI "I've paid" is honour-based and flagged for owner review (correct). `releaseHold` has no auth. |
| Competitions: create, entries, eligibility, fixtures, results with optimistic version + advisory lock (F events) [3] | W-F | Single academy only: no cross-org registration, public discovery or standings page for participants. |
| Legacy events + RSVP (`events.ts`, coach MatchManager) [3] | P | Persisted. No notifications. |
| Opportunities board admin (F opportunities) [2] | W-F | `students.manage`, audited. |
| Institution profile, programs, teams, participation (F education) [10] | W-F | |
| Kit store v2 (stock reservation, price snapshot, order state machine) (F marketplace) [8] | W-F | Pay at academy only; no online checkout, refunds or settlements. `Product.price` is Float but snapshots are paise (good). |
| Brand Studio: sponsors, campaigns, proposals, deliverables, funding approval with re-typed amount; scholarships/concessions applied to fee generation (F sponsorship/inclusive) [9] | W-F (single tenant) | Sponsors are records kept *by the academy*, not sponsor accounts. There is no cross-org marketplace. Proposal status, status-event and audit writes are not in one transaction (`brand-studio.ts:216-226`). |
| Careers employer: post jobs, pipeline (`/org/careers`, F careers) [5] | W-F | |
| Gallery (link-based) and academy photos (Blob, owner) [7-ish] | W | |
| Settings: delete all data, sample data (dev only) | P | Finding 14. |
| Sales leads, directory claim (`/ops/leads`, `academies/actions.ts`) | W | SUPER_ADMIN only. |
| Wellness credential review (`/ops/credentials`) [5/6] | W-F | SUPER_ADMIN. |

### 2.2 Coach (`/coach`: tabs today, squad, plan, inbox, me)

| Feature | Status | Notes |
|---|---|---|
| Today's sessions, attendance (present/absent/late), cancel/restore session, session recap, broadcast to batch [1] | W (**B if finding 1 applies**) | `authoriseBatch` checks role, not `attendance.mark`. Page `include`s skillReports (finding 1). |
| Squad roster, parent last-seen, invite-parent links (`coach-invites.ts`) [1] | W | |
| Monthly skill evaluation with sport metrics (`EvaluateModal`, `submitSkillReport`) [2] | W / **B?** | Writes `sport`/`metrics` columns that are missing in the DB (finding 1). No validation of month format or score range (`reports.ts:7-41`). |
| Fee khata (see who has paid) [1] | P | Loads every fee in the academy (`coach/page.tsx:104`). |
| Incident report, Emergency SOS with medical card [1/6] | W | India emergency numbers. `type`/`severity` unvalidated (`incidents.ts:36`). |
| Points, diet plan URL, highlight media links [2/7] | W | |
| Coach verification steps (ID upload), public coach page `/c/[coachId]` (F coachOS) [5] | P / F | |
| Training plan, QR attendance scanner | **D** | Components never imported. |
| Record a fixture result as an assigned official (F events) [3] | W-F | |
| Careers (apply), Wellness (book) as a user (F) [5/6] | W-F | |
| Payroll self-view / staff attendance | P | Coaches see their own check-in. Payouts are not visible to them. |

### 2.3 Staff (`/staff`)
- Self check-in, check-out and own month view: **W**.
- Everything a staff role's permissions advertise (reception, accounts, physio, groundsman): **B**. See finding 3. Staff cannot open `/org`, `/student/[id]` or `/coach`.

### 2.4 Parent (`/parent`: home, children, chat, coaches, more, shop)

| Feature | Status | Notes |
|---|---|---|
| Children overview, attendance %, skill reports, fee dues, announcements [1/2] | W / **B?** | Includes skillReports (finding 1). Unbounded skillReports and Media. |
| "I've paid" (UPI) → pending verification; online pay (Razorpay/Stripe); receipts `/r/[token]` [1] | W | |
| Enroll another child [1] | W | Same academy only. |
| Event RSVP [3] | P | `RSVPButtons` component is unmounted in some views. Event creation sends no notification. |
| Chat with admin, feedback/testimonial [1] | P | Single "admin" recipient. |
| Leaderboard [2] | W, **privacy issue** | Finding 10. |
| Medical info edit [6] | W | Audited (field names only, good). |
| Progress report `/student/[id]/report` (F progressReport) and athlete records: achievements and goals with coach review (F athleteOS) [2] | W-F | |
| Opportunities: browse/apply with guardian consent (F) [2/10] | W-F | |
| Pro shop / store orders (F marketplace) [8] | W-F | |
| Carpool, weekly timetable, achievement badges, auto progress report, download receipt widget | **D** | Never imported. |
| Referral widget [1] | **UI** | |

### 2.5 Student / athlete
- **No login and no role exists.** All V2 functions are exercised by the parent, coach or admin on the athlete's behalf. Self-managed athlete identity, sharing and saved opportunities are **missing**.

### 2.6 Public visitor

| Feature | Status |
|---|---|
| Landing, pricing, city pages (`/noida`, `/gurgaon`), contact/demo request (`submitDemoRequest`), privacy/terms/refund, delete-account page | W (marketing; product mock labelled as sample) |
| Academy directory `/academies/...` with trial request and claim listing | W (`marketplace` flag affects visibility) |
| Public academy page `/academy/[slug]` | P: hard-coded "About" text (finding 15) |
| Trial booking `/trial`, self-registration `/join` | P: findings 5 and 14 |
| Turf booking `/book/[slug]` | W |
| Public receipt `/r/[token]` | W (token-scoped) |
| Careers list/detail (F careers), wellness provider pages (sign-in required, F wellness), coach profile `/c/[id]` (F coachOS, noindex) | W-F |
| Webhooks: Razorpay (platform, per-org, billing), Stripe, WhatsApp, all signature-verified; cron monthly fees with CRON_SECRET; `/api/health` | W |

---

## 3. Mapping to the 11 verticals (on `origin/main`)

| Vertical | Built today | Status | Main gaps |
|---|---|---|---|
| 1 Business | Nearly every academy-ops flow | **P→W** | Permissions not enforced for staff or on the /org page. Fee plans and coupons are UI-only. No notifications. Money stored as Float. India hard-coding. Self-join bypasses approval. Migration discipline. |
| 2 Athlete | Skill reports, media, points, achievements/goals (F), opportunities with guardian consent (F), progress report (F) | P | No athlete login or identity, no profile sharing or privacy controls, no verification states beyond coach review, no saved opportunities. Tables are not in the DB. |
| 3 Play | Competition engine (knockout/league, eligibility, fixtures, officials, results) (F) + legacy events/RSVP | P (single org) | No public discovery, cross-org registration, registration fees, standings page for participants, or notifications. |
| 4 Spaces | Turf board, public booking with holds, policy/utilisation pure functions, court allocation (F) | **W** for single venue | No discovery across venues (spacesDiscovery flag), no reviews, no refund execution. |
| 5 Careers | Professional profile, credentials, jobs, applications pipeline (F), ops credential review | P | No standalone professional sign-up. Pagination is take-50 then filtered. |
| 6 Wellness | Provider profile, credential status, appointment state machine with CAS (F), health.view/manage | P | Only existing users can use it. No guardian consent when a parent books for a minor. Appointment `note` is free-text health data stored in plain text. |
| 7 Creators | Flag only (`creators`), plus gallery/media links | **Missing** | Everything. |
| 8 Commerce | Kit store v2 (F) | P | No checkout, payment, refunds or seller accounts. |
| 9 Brand Studio | Sponsors, campaigns, proposals, deliverables, funding approval, scholarships/concessions (F) | P (academy-internal CRM) | No sponsor-side accounts or discovery across orgs. |
| 10 Education | Institution profile, programs, teams, participation (F) | P | No inter-school events, internships or institution reports beyond the overview. |
| 11 Enterprise | Branches (F), audit viewer (F), permission model, `enterprise` flag | P/Missing | No org hierarchy, consolidated cross-org reports, API keys/webhooks management or data-export controls. |

---

## 4. Part B: where AI would genuinely help

### 4.1 Ground rules (consistent with `docs/roadmap/verticals/16-ai-assistance.md`)
- **No voice.** AI only drafts, summarises, ranks or explains. A human sends, approves or saves anything that touches a parent, a minor, money or health.
- **Never present a prediction as a fact.** Every insight shows the numbers it came from.
- **Prerequisites before any AI work:** finding 1 (SkillReport schema mismatch) and finding 3 (permissions) must be fixed first. AI tools must reuse the same permission-checked server functions, otherwise they inherit the same holes.

### 4.2 Opportunities by vertical

Size: S ≈ ≤3 days, M ≈ 1–2 weeks, L ≈ 3+ weeks. "Approval" means a human must confirm before anything is sent or saved.

| # | Vertical / role | AI feature | User value | Data needed (exists?) | Risk | Size | Approval |
|---|---|---|---|---|---|---|---|
| 1 | V1 owner/coach | **Draft parent messages and announcements** (rain closure, fee reminder, holiday), with tone and language options (English/Hindi/Hinglish) | Saves daily typing; better reminders | Announcement composer, org locale, batch names (yes) | Low; redact phone numbers | S | Yes: draft only |
| 2 | V1/V2 coach → parent | **Turn coach scores and short notes into a progress-report narrative** (monthly) | Coaches write 3 keywords; parents get a readable paragraph | SkillReport scores/metrics, attendance % (yes, after the finding 1 fix), progress report page (F) | Minors: use first name only or none; no medical data; label "AI-assisted" | S–M | Yes: coach edits and saves |
| 3 | V1 owner | **Attendance-drop / churn risk list with reasons** ("3 absences in a row after fee went pending") | Saves students before they leave | Attendance, fee status, lastSeenAt, trials (yes). Rule-based scoring already exists in SQL (`analytics.ts:39`, `org/page.tsx:41`) | Low–med: never shown to parents; avoid labels about the child | S (rules + LLM explanation) → M (learned model) | Suggests actions only |
| 4 | V1 owner/accountant | **Fee-default risk and best-time-to-remind** | Fewer overdue fees, fewer awkward calls | FeeRecord history, paidAt, payment method, reminders sent (partly; no reminder delivery log) | Financial profiling of families; keep it internal, explainable, no automated penalties | M | Yes: reminder still sent by a human |
| 5 | V1 owner | **Natural-language questions over reports**, e.g. "How much is outstanding in the Noida branch?" or "Which batch had the worst attendance in September?" | Owners avoid digging through tabs | Fees, attendance, batches, branches (F; tables missing) | Tenant leak if the model writes SQL. **It must only call permission-checked server tools** (e.g. `getUnpaidFees`, analytics functions), never raw SQL | M | No for reads; show the source table |
| 6 | V1 owner/coach | **Auto-schedule batches**: propose timings, coach and court assignment from capacity, coach availability and facility allocation | Faster season setup; fewer clashes | Batches, facility allocation (F), staff attendance, holidays (partly; no coach availability model) | Low | M (solver + LLM explanation) | Yes: owner applies |
| 7 | V1 | **Import cleanup**: map messy WhatsApp/Excel rosters to students, parents and batches; detect duplicates | Faster onboarding (the biggest adoption barrier) | Existing import parsers (yes) | PII is sent to the model; redact or process in-region | S–M | Yes: preview then confirm |
| 8 | V1 | **Multilingual translation** of announcements, receipts and report narratives | Reaches Hindi- and regional-language parents | Text plus org locale (yes) | Low | S | Yes for the first send of a template |
| 9 | V1 leads | **Lead follow-up drafting and next-best-action** (call today / offer trial / close) | Higher trial-to-enrolment conversion | Lead, TrialBooking, conversion history (yes) | Low | S | Yes |
| 10 | V2 athlete/parent | **Explain my child's progress**: a plain-language summary of trends over months, with goals suggested from metrics | Parents understand development | SkillReport history, goals (F) | Minors; must not invent achievements; show the data | S | Coach review recommended |
| 11 | V2/V7 coach | **Video and skill feedback** (pose and technique cues from uploaded clips) | High perceived value | Media is currently link-only; needs upload, storage and consent | **High**: minors' video, biometric-like data, guardian consent, retention | L | Yes, plus guardian consent |
| 12 | V2/V10 parent | **Opportunity matching** (trials and scholarships that fit age, sport, level and city) | Discovery without searching | Opportunity (F), student dob/sport/batch (yes) | Minors; eligibility must be rule-checked, with AI only ranking and explaining | S–M | Guardian consents to apply (already built) |
| 13 | V3 organiser | **Fixture scheduling with constraints** (venues, rest days, school hours) and **automatic match report text** | Hours saved per tournament | Competition, Fixture, facility allocation (F) | Low; results must stay human-recorded | M | Yes |
| 14 | V4 venue owner | **Dynamic pricing and empty-slot suggestions; utilisation summary** | More revenue from idle slots | TurfBooking, utilisation functions (yes) | Price fairness; keep owner-set bounds | M | Yes |
| 15 | V5 careers | **Job matching** (rank candidates against a listing, explain fit) and **job description drafting** | Faster hiring for academies | ProfessionalProfile, credentials, JobListing (F) | Bias and discrimination; never auto-reject; no protected attributes | M | Yes: employer decides |
| 16 | V6 wellness | **Intake summarisation and routing to the right provider type** (physio vs nutrition), not diagnosis | Faster triage | Appointment note (F) | **High**: health data. Clinical AI is out of scope per the spec. Explicit consent, no storage of prompts | M | Yes: provider reviews |
| 17 | V7 creators | **Highlight captions, post copy, content tagging** | Creators publish faster | Media (link-only), creator profile (missing) | Minors in content; no engagement fabrication | S (copy) / L (video) | Yes |
| 18 | V8 commerce | **Size/kit recommendations; product description drafting; reorder suggestions** from stock and order history | Less stock-out, better listings | Product, StoreOrderDetail (F) | Low | S | Yes for listings |
| 19 | V9 brand studio | **Sponsor matching** (which campaign fits which athlete or team) and **proposal drafting**; deliverable report from verified data | More sponsorship won; honest reports | Campaigns, proposals, deliverables (F); verified attendance/results | Minors' likeness; must not overstate reach; funding approval stays human (already enforced) | M | Yes, and money always needs `funding.approve` |
| 20 | V10 education | **Institution participation reports in prose**; inter-school event schedule drafts | Saves admin time for schools | Participation, programs (F) | Minors; aggregate only | S | Yes |
| 21 | V11 enterprise | **Consolidated multi-branch digest and anomaly flags** (branch revenue drop, unusual reversals or deletions in the audit log) | Leadership oversight; fraud detection | Branches (F), AuditLog (yes), fees | Cross-tenant: only for explicitly authorised hierarchy | M | No for reads; alerts only |
| 22 | All / ops | **Support assistant over TRIQ docs** ("how do I connect Razorpay?") | Fewer support calls | Docs (yes) | Low | S | No |

### 4.3 By role, at a glance

| Role | Features from 4.2 |
|---|---|
| Owner/manager | 1, 3, 4, 5, 6, 7, 9, 14, 21 |
| Coach | 1, 2, 6 (view), 11, 13 |
| Staff (once finding 3 is fixed) | Receptionist: 7, 9. Accountant: 4, 5. Physio: 16. Groundsman: 14 |
| Parent | 8 (receive), 10, 12 |
| Student/athlete | 10 and 12 via the parent until an athlete login exists |
| Public | 22, and discovery ranking for venues and jobs |

### 4.4 Recommended architecture (provider-agnostic)

1. **Server-only module `src/lib/ai/`.**
   - An `AiProvider` interface: `complete({system, messages, schema?, maxTokens}) → {text|json, usage}`.
   - Adapters for one or two providers, selected by `AI_PROVIDER`/`AI_MODEL` env vars. No `NEXT_PUBLIC_` keys.
   - All calls are made from server actions only, never from client components.
2. **Tool layer, not SQL.** AI features call a small allow-list of *existing* permission-checked functions (`getUnpaidFees`, analytics aggregates, `listCompetitions`, …), wrapped as typed tools with zod input/output. Each tool re-runs `checkPermission` with the **caller's** session and `orgId`. The model never sees or chooses `orgId`.
3. **PII minimisation and redaction.**
   - Prompt builders take typed inputs whose types exclude phone, email, medical and dob fields.
   - A `redact()` pass then strips phone numbers in every `phoneCountry` format, emails and token URLs.
   - Prefer IDs plus first names; re-hydrate names after generation.
   - Health data is never sent unless the specific feature is consented and needs it.
4. **Audit and usage tables.**
   - Log `AiUsage(orgId, userId, feature, model, inputTokens, outputTokens, costMicros, latencyMs, status)` for every call.
   - Log `AI_DRAFT_GENERATED` and `AI_ASSISTED_SENT` in AuditLog with no prompt text.
   - Add an "AI-assisted" marker on saved rows that parents read.
5. **Cost caps.**
   - Per-org daily and per-user hourly limits via `rateLimitDb` (the DB-backed limiter, not the in-memory one).
   - A per-plan monthly token budget tied to `Subscription.plan`.
   - Hard `maxTokens`; cache weekly summaries.
6. **Human approval.** Generation returns a draft. A separate, already-permissioned action sends or saves it. Nothing is auto-sent to parents or minors, and nothing moves money.
7. **Evals.**
   - A golden set per feature, run in CI against a mock provider plus a nightly real-provider run: fixtures of anonymised aggregates with expected facts.
   - Checks: no PII leaks (regex), numbers match the source, language follows the requested locale, nothing invented (every number in the output must appear in the input).
   - Collect thumbs up/down in the UI.
8. **Data residency and terms.** Choose a provider and region that meet Indian DPDP Act expectations for children's data. Record whether prompts may leave India (open question in doc 16).
9. **Kill switches.** `FEATURES.ai` plus a per-feature flag. When the key is absent, buttons are hidden and actions return "AI not configured".

### 4.5 Top 8 AI features to build first (ordered)

1. **Draft parent messages and announcements, with translation (#1 + #8).** S. Low risk, used daily, needs no new data.
2. **Coach notes → progress-report narrative (#2).** S–M. Unblocks the progress-report flag. Fix finding 1 first.
3. **Churn / attendance-drop flags with reasons (#3).** S. Explains the existing SQL rules; the model writes only the explanation and a suggested next step.
4. **Natural-language report Q&A over permission-checked tools (#5).** M. This is the owner "wow" feature. Only after finding 6 is fixed (permission-aware reads).
5. **Fee-default risk + reminder timing + drafted reminder (#4).** M. Direct revenue impact. Internal-only and explainable.
6. **Roster import cleanup / dedupe (#7).** S–M. Reduces onboarding friction for new academies in Noida and Gurgaon.
7. **Lead follow-up drafting / next-best-action (#9).** S. Improves trial conversion.
8. **Batch and fixture auto-scheduling suggestions (#6 + #13).** M. A constraint solver does the scheduling; the LLM only explains and edits.

Deferred until consent, storage and athlete identity exist: video/skill feedback (#11), wellness intake (#16) and creator video (#17). Sponsor and job matching (#15, #19) should wait until those verticals' tables are live and have real cross-org data.

---

## 5. Suggested immediate actions (no AI)
1. Confirm which Supabase project production uses. Then either add `SkillReport.sport`/`metrics` via SQL or remove them from the schema, and check the Vercel logs for `column ... does not exist`.
2. Adopt Prisma migrations (or one ordered SQL runner with a ledger table). Remove runtime DDL from `requireAuth`.
3. Fix the permission model: allow STAFF/COACH memberships through `requirePermission` by checking membership permissions rather than app role, gate `/org` data and tabs by permission, and use `attendance.mark`.
4. Add consent before a person is added to an academy. Restrict `createLoginLink` to users whose *only* active membership is the caller's academy, or drop impersonation links for multi-academy users.
5. Make `/join` create a pending enrolment (or lead) that staff approve. Move all public rate limits to `rateLimitDb`.
6. Delete or guard the dead exported actions (`getFeeReceiptAction`, `logAction`, legacy duplicates). Remove the leaderboard names or make them opt-in.
7. Move money fields to integer minor units. Make `FeeRecord.orgId` and `Student.orgId` non-null after backfill.
