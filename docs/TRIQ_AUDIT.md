# TRIQ first deliverable: repository audit, gap analysis and plan

Date: 2026-11-06. Prepared against the TRIQ master blueprint ("The Complete Sports Ecosystem"). Sources checked directly: the GitHub repository `kartikeyatitu/Play` (all 25 remote branches), the production Supabase project `triq` (Mumbai, `tfekmfumwsnxcddixlxm`), and the Vercel project `sportsos`. Status labels come from reading code and production row counts, not from end-to-end testing, unless stated.

Contents:
1. Current repository audit
2. Existing feature inventory
3. Branch consolidation report
4. Ecosystem gap analysis
5. Proposed database and architecture
6. Psychology and clinical data security design
7. Prioritised implementation plan
8. First sprint backlog
9. Preview release strategy

---

## 1. Current repository audit

### Stack and hosting

| Item | Finding |
|---|---|
| App | Next.js 15 App Router, React 19, TypeScript, Tailwind with semantic CSS tokens |
| Data | Prisma 5 on Supabase Postgres, project `triq`, Mumbai (`ap-south-1`). The app uses the service role; RLS is enabled on every table with no policies (deny by default for the public API) |
| Hosting | Vercel project `sportsos`, region `bom1`. A second project `xplay` also deploys from `main` |
| Production | `https://sportsos-tau.vercel.app`, currently serving `main` at `8c8ed4b` (deployment READY) |
| History | 166 commits on `main`, from 2026-10-13 (`521a446`, baseline copy of the earlier sportsos project) to 2026-10-29 |
| Code size | 118 Prisma models; 90 server-action files in `src/app/actions`; 49 test files, 492 tests passing; typecheck clean at `8c8ed4b` |
| Migrations | 21 hand-written SQL files in `prisma/sql/`, no `prisma/migrations` history. `src/lib/schema-ensure.ts` also runs DDL at runtime |
| Feature flags | `src/lib/features.ts`. Most verticals are on (bookings, marketplace, opportunities, education, events, communities, branches, enterprise, sponsorship, inclusive, careers, wellness, creators). Wave 2 flags are off |

### Production database

93 tables exist in production. The 25 wave 2 models in `schema.prisma` (rewards, media consent, guardians, waivers, consent ledger, drills, session plans, waitlist, messaging, data requests, fitness, TRIQ billing, parent plan) are **not** in production. Their SQL is drafted in `prisma/sql/2026-10-29_wave2.sql` and has not been applied.

Real use is concentrated in Academy OS:

| Table | Rows | | Table | Rows |
|---|---|---|---|---|
| Organization | 10 | | FeeRecord | 460 |
| User | 156 | | Receipt | 15 |
| Student | 160 | | SkillReport | 100 |
| Batch | 27 | | FeePlan | 7 |
| Session | 217 | | Lead | 11 |
| Attendance | 1,587 | | OrgMembership | 21 |
| AuditLog | 48 | | Facility / Equipment | 7 / 7 |

Every other vertical (competitions, live scoring, athlete achievements and goals, careers, wellness, creators, sponsorship, store, education, venue bookings beyond one row) has **zero rows**. These verticals are built but unused.

### Security findings (Supabase advisor, 2026-11-06)

| Level | Finding | Action |
|---|---|---|
| WARN | `public.rls_auto_enable()` is a SECURITY DEFINER function executable by the `anon` and `authenticated` roles through the REST API | Revoke EXECUTE from `anon` and `authenticated`. Production DB change, so it needs your approval |
| WARN | Extension `btree_gist` installed in the `public` schema | Move to an `extensions` schema in a planned migration |
| INFO | 93 tables have RLS enabled with no policies | Intended: the app uses the service role and the public API is denied. Keep, and document |

### Configuration

- The AI key was saved in Vercel as `Triqprod`; the code reads `ANTHROPIC_API_KEY`. Last checked 2026-10-29. Re-check before AI features are tested.
- Preview deployments have almost no environment variables. `DATABASE_URL` and `DIRECT_URL` are Production-only, so preview builds can't reach a database. Section 9 deals with this.

---

## 2. Existing feature inventory

Legend: **Built and used** (code, screens and production rows) · **Built, unused** (code and screens, no production rows) · **Partial** (code thin or not wired) · **Schema only** · **Missing**.

### TRIQ Core

| Capability | Status | Evidence |
|---|---|---|
| Accounts, login, OTP and login links | Built and used | `auth.ts`, `login-links.ts`, `LoginToken` 307 rows |
| Multiple roles and organisation memberships | Built and used | `OrgMembership` 21 rows, `team.ts`, academy switcher |
| Permissions (RBAC) | Built | `src/lib/membership.ts`; money permissions enforced (`f3ba220`); permission tests (`b3dc136`) |
| Tenant isolation tests | Partial | Unit tests with mocks only; no database-level tests |
| Branches | Built, unused | `Branch`, `BatchBranch`, 0 rows |
| Audit log | Built and used | `AuditLog` 48 rows |
| Notifications | Partial | `notifications.ts` (28 lines); WhatsApp reminders via `reminders.ts`; no delivery tracking in production |
| Payments | Built | Per-academy Razorpay keys, payment links, online payments, UPI AutoPay mandates (0 rows), GST invoices (0 rows) |
| TRIQ subscription billing | Partial | `Subscription` 1 row, `BillingInvoice` 0 rows; invoicing is manual |
| Rate limiting | Built | Postgres-backed on all sensitive actions (`b3dc136`) |
| AI services | Built | `ai.ts`, `ask.ts`, `insights.ts`; names of children and parents redacted before model calls (`032d3fd`) |
| Global search, documents, reviews, support | Missing or partial | Not found as shared services |
| Design system | Partial | Semantic tokens; `SportIcon` and sport accents added (`16706b8`); landing redesign not finished |

### TRIQ Operate

| OS | Status | Evidence |
|---|---|---|
| **Academy OS** | **Built and used** (strongest area) | Leads, trials, trial conversion, batches, sessions, attendance, fee records, receipts, fee plans (thin, 37 lines), concessions, coupons, reminders, autopay, GST, payroll, staff attendance, expenses, store, events, holidays, transport, announcements, skill reports, imports, exports |
| Gym OS | **Missing** | No membership-plan, class or trainer model |
| Club OS | Partial, unused | `SportsProgram`, `ProgramTeam`, `ParticipationRecord`, `Competition`, `Fixture` |
| Coach OS | Partial | Coach invites, coach sessions, verification, `ProfessionalProfile` and credentials, payroll; no leave, availability or development |
| Venue OS | Built, barely used | `turf-bookings.ts` (542 lines), facilities, allocation, booking events; 1 booking row |
| Sports Event Business OS | Partial | `Event`, `RSVP`, waitlist (0 rows) |

### TRIQ Athlete

| Capability | Status | Evidence |
|---|---|---|
| Athlete Passport | Partial | `student/[id]` page, `athlete.ts` (achievements with staff review, goals), 0 rows; per-academy only; no athlete login |
| Competition history | Built, unused | `LiveMatch`, `AthleteMatchStat`, `PerformanceResult`, 0 rows |
| Physical performance | Schema only | `FitnessResult`, `Drill`, `SessionPlan` |
| Mind & Performance | **Missing** | Nothing athlete-facing |
| Nutrition | **Missing** | |
| Recovery and injury | Partial | `medical.ts` (medical info, SOS), `Incident` (0 rows) |
| Career and opportunities | Built, unused | `Opportunity` and applications, `ScholarshipProgram` |
| Recognition | Partial | `points.ts`, `gamification.ts` (a points number on Student); wave 2 rewards schema only |

### TRIQ Participate, Compete, Grow, Connect, Expand, Intelligence

| Ecosystem | Status |
|---|---|
| Participate | Academy discovery and listings (`ListedAcademy`, `places.ts`, `/academies`, city pages); trial booking. TRIQ Play (find players, create games) **missing**. Communities: flag on, slice 1 only |
| Compete | Live scoring for 22 sports across 7 scoring families: **built**, 0 production matches. Competitions and fixtures: built, unused. Tournament draws and standings: partial |
| Grow | Brand Studio, sponsorship (profiles, campaigns, proposals, deliverables), store with orders, creators, careers: **built, unused**. Rewards and perks: partial |
| Connect | Professional profiles, experience and credentials, ops credential review: built, unused. Discovery and booking for psychologists, physiotherapists and nutritionists: **missing** |
| Expand | Wellness providers and appointments: built, unused. Education: built, unused. Enterprise: partial. Corporate: flag off. Inclusive: flag on, plan documented. Global: scholarships only |
| Intelligence | Assistant, drafts, insights and register photo reading exist. No permission-aware retrieval, no consent enforcement, no evaluation |

---

## 3. Branch consolidation report

25 remote branches. Checked each against `main` with `git cherry` and a trial merge.

### Fully contained in main (safe to delete after your approval)

20 branches have no commits that aren't on `main`, or only patch-equivalent ones:

`build/group-a`, `build/group-c`, `build/landing-feature-copy`, `build/v-athlete-education`, `build/v-business-enterprise`, `build/v-business-payments-calendar`, `build/v-careers-wellness-creators`, `build/v-commerce-brand`, `build/v-play-spaces`, `codex/triq-reliability-and-vertical-roadmap`, `design/sportos-ui-v1`, `feat/academy-os-branches`, `feat/academy-os-payment-method`, `feat/v2-athlete-profile-fixes`, `fees-collection`, `fix/lazy-session-secret`, `integrate/all-verticals`, `pro-redesign`, `sprint-3-today`, `v0/fix-use-server-exports`.

### Unique work not on main (5 commits)

| Branch / commit | What it does | Merges cleanly | Recommendation |
|---|---|---|---|
| `build/security-fixes` `de21216` | Enforce staff and coach permissions from membership; 81 lines of tests | Yes | **Merge**, after running its tests against the money-permission changes in `f3ba220` |
| `build/security-fixes` `c933409` | Require consent to join a second academy; block cross-academy login links | Yes | **Merge.** Closes master-plan risk 2 (owners reaching other academies' data) |
| `build/security-fixes` `f90a2a9` | Public `/join` creates a pending enquiry | Conflict | `main` already solved this differently in `f3ba220` (`/join` creates a `Lead`). **Keep main's version**; port only its tests if they add coverage |
| `fix/trial-status-buttons` `a827d8d` | Trial conversion accepts the statuses the Trials screen sends | Conflict | **Port by hand**: the 9-line fix in `trial-convert.ts`. The inclusive-participation doc is already on main |
| `vercel/vercel-web-analytics-setup-9fcebk` `c8d72e4` | Adds `@vercel/analytics` | Yes | **Merge with a change**: exclude child and parent pages from analytics, per master-plan risk 4 |

No working production feature is overwritten by these merges. Branch deletion needs your approval.

---

## 4. Ecosystem gap analysis

| Ecosystem | Built | Biggest gaps | Priority |
|---|---|---|---|
| Core | Identity, memberships, RBAC, audit, payments, rate limits | Versioned migrations; runtime DDL; preview database; notifications and delivery; TRIQ billing; global search; shared document storage; DB-level tenant tests | **P0** |
| Operate: Academy | Most of the blueprint list | Fee plans and instalments; overdue and renewal workflow; parent home; guardian links; consent ledger; receipt voiding | P1 (first journey) |
| Operate: Gym | Nothing | Whole OS | P1 later |
| Operate: Club, Coach, Venue, Events | Partial | Squads and registrations; coach availability and leave; venue recurring bookings, holds and refunds; event ticketing and officials | P1 |
| Athlete | Achievements, goals, match stats, performance results | Cross-academy athlete identity; athlete login; passport UI; verified vs self-reported; physical assessment; nutrition; recovery workflow | **P1 flagship** |
| Mind & Performance | Nothing | Entire vertical; requires the data design in section 6 and an advisory network | **P1 flagship**, gated |
| Participate | Discovery, trials | TRIQ Play, communities | P2 |
| Compete | Live scoring, competitions, fixtures | Draws, standings, officials, appeals, certificates, registration fees | P2 |
| Grow | Brand Studio, sponsorship, store, creators, careers | Real users; minors' protections; settlement | P3 |
| Connect | Professional profiles and credentials | Discovery and booking for health professionals; messaging with safeguarding | P1 (for Mind & Performance) |
| Expand | Wellness, education, partial enterprise | Corporate, global, inclusive | P4 |
| Intelligence | Assistant with redaction | Permission-aware retrieval, consent enforcement, evaluations, cost controls | P5 |

The most important gap isn't a missing feature. **Many verticals are built and switched on but have no users, while the core Academy flow is still missing pieces.** The plan below finishes connected journeys before adding screens.

---

## 5. Proposed database and architecture

### Product and domain architecture

A **modular monolith** inside the existing Next.js app. No new application.

- `src/domains/<domain>/` for each domain: `service.ts` (business logic, transactions), `policy.ts` (who can do what, including consent and data tier), `queries.ts` (reads), `types.ts`. Server actions in `src/app/actions` become thin wrappers that call a domain service.
- Domains, following the blueprint: Identity, Organisations, Memberships, Permissions, Athlete, Academy, Coach, PhysicalPerformance, MentalPerformance, Psychology, Nutrition, Recovery, HealthcareProvider, Scheduling, Attendance, Billing, Payments, Activities, Venues, Competitions, Communities, Brands, Sponsorships, Marketplace, Careers, Education, Wellness, Notifications, Analytics, AI.
- Existing code moves into domains as it's touched, not in one big refactor.

### Identity

| Concept | Today | Proposed |
|---|---|---|
| Person | `User` (login) and `Student` (per-academy record) are separate | Keep both. Add **`AthleteProfile`**: one per person, owned by the athlete (or guardian for minors), linked to many `Student` records across academies. The passport reads from here |
| Guardian | `Student.parentId` (one parent) | `GuardianLink` (schema ready): several guardians, several children |
| Professional | `ProfessionalProfile`, `ProfessionalCredential` | Add `ProviderPractice` (a psychologist's or physio's practice) and verification states |
| Roles | `User.role` plus `OrgMembership` permissions | Keep. Add athlete role (18+ login; minors through guardians) |

### Database principles

- **Versioned migrations.** Keep numbered SQL in `prisma/sql/`, add a `_migrations` ledger table recording each file applied, by whom and when. Retire runtime DDL in `schema-ensure.ts` once its tables are covered by migrations.
- **Every migration runs on a non-production database first** (section 9), then on production with your approval.
- **Money in integer minor units** in all new tables. Plan the Float-to-integer migration for legacy money columns separately.
- **Additive changes only** in production unless a destructive change has its own approval.
- **Private storage** for all files containing children or health data; signed URLs only.
- **Idempotency keys** on payments, bookings, rewards and live-scoring events. These already exist for live scoring; extend the same pattern.

### Permissions matrix (starting point)

| Data | Athlete (18+) / guardian | Coach | Academy owner | Finance staff | Qualified clinician | Sponsor / selector |
|---|---|---|---|---|---|---|
| Public sporting profile | Own and control | View | View | — | View | View if published |
| Training schedule and attendance | Own | Assigned athletes | Their academy | — | With consent | No |
| Physical assessments | Own | Assigned athletes | Limited operational | — | If authorised | No |
| Match stats and results | Own | Assigned athletes | Their academy | — | — | If published |
| Fees, invoices, receipts | Own / guardian | No | With finance permission | Yes | No | No |
| Medical safety info (allergy, emergency contact, "coach must know") | Own / guardian | Assigned athletes | Their academy | No | Yes | No |
| Personal wellbeing (check-ins, journal, recovery log) | Own | **No automatic access** | **No automatic access** | No | Only if shared | **Never** |
| Clinical records and notes | As agreed with provider | **No** | **No** | No | Authorised care team | **Never** |

Section 6 sets the rules for the last two rows.

### AI architecture

- Permission-aware retrieval: the AI only receives what the requesting user could see, assembled by domain query functions, never by raw table access.
- Consent enforcement: purposes `ai_assistance` and tier checks before any child data is included. Tier 2 and tier 3 data are never in AI context.
- Existing name redaction stays in front of every call.
- Audit log per AI action; cost caps per academy; human approval for anything sent to parents; a fallback when the provider is down. No essential workflow depends on AI.
- No diagnosis, no injury prediction, no return-to-play decisions, no inference of psychological conditions. These are tested as refusal cases.

### Mobile

Phone-first web app now. Installable PWA next. Native apps later through the existing Capacitor configuration. Coaches need offline attendance and scoring first (the live-scoring offline queue is in progress).

---

## 6. Psychology and clinical data security design

### Three data tiers

| Tier | Contents | Owner | Default access |
|---|---|---|---|
| **1. Coaching** | Attendance, match stats, assessments, fitness tests, goals | Academy, with the athlete | Coach, academy, athlete, guardian |
| **2. Personal wellbeing** | Check-ins, journal, recovery log, mental-skills progress | The athlete (guardian for young children) | Only people the athlete chooses, revocably |
| **3. Clinical** | Professional assessments, screening results, treatment notes, care plans | The qualified professional | Professional and authorised care team; athlete as agreed |

### Storage and access

- Tier 2 and tier 3 live in a **separate Postgres schema** (`care`), not in `public`. No academy-scoped query can join into it.
- Access only through `care` domain service functions that check an explicit **`CareAccessGrant`** (who, which records, purpose, expiry, granted by whom).
- **Every read is logged** in `CareAccessLog`. The athlete (or guardian) can see who looked.
- Clinical notes are **encrypted at the application level** with a key separate from the payments key, held only in production environment variables.
- Tier 2 and tier 3 are **excluded** from academy exports, analytics, AI context, search indexes, backups shared outside the platform, and anything a sponsor, selector or opponent can reach.
- No ranking, scoring, leaderboard or reward is ever computed from tier 2 or tier 3 data. Metrics that reward hiding distress are not used.

### Minors

- Under 13: guardian-led access; content and check-ins designed for guardian use.
- 13 to 17: athlete-facing with **guardian consent and the athlete's own assent**.
- 18+: full athlete control.
- **Limits of confidentiality are explained in plain language before any service begins**, for the athlete and the guardian.

### Safeguarding

- Risk language in a check-in or journal shows a supportive screen with crisis contacts and a way to reach a trusted adult or professional.
- **Who is notified, when, and how for a minor must be set by a clinical advisor and counsel before tier 2 holds real data.** The product never promises confidentiality it can't keep.
- Abuse and misconduct reporting, moderation and secure messaging use the same safeguarding policy.

### Professionals

- Listed as **verified** only after credential checks. Which registrations count (for example RCI registration for clinical psychologists in India) is confirmed with the advisory network.
- Validated screening tools only under professional governance.
- Informed consent recorded per engagement; private professional records; follow-up workflows.

### Legal and governance

- India: the DPDP Act and Rules; verifiable parental consent for under-18s, with substantive duties from May 2027. UAE: PDPL and the Child Digital Safety Law.
- An advisory network covering sports psychology, sports medicine, physiotherapy, nutrition, safeguarding and coaching, as the blueprint requires.
- **Counsel and a clinical advisor sign off before tier 2 or tier 3 stores real data.** Until then, Mind & Performance ships only content that holds no personal data.

---

## 7. Prioritised implementation plan

Delivery estimates assume the current team. Recalculate once team size is confirmed.

### First 30 days: consolidate and connect two journeys

1. Consolidate branches (section 3) and close the security warnings.
2. Migration discipline: ledger, staging database, retire runtime DDL.
3. Release process: feature branches and preview deployments (section 9).
4. **Academy journey, end to end**: enquiry → trial → enrolment approval → batch → attendance → fee plan → invoice → reminder → payment → receipt → parent home → monthly progress report.
5. **Athlete journey, first slice**: Athlete Passport v1 from existing data (sports, academy, coach, match history, season stats, personal bests, achievements, goals, latest assessment), with verified and self-reported clearly marked.
6. Fix the points rule that deducts points for missed sessions; restrict coaches to safety-critical medical fields.
7. Write the ten required docs (`docs/TRIQ_*.md`).

### Days 31 to 60

- Coach OS: availability, roster, training plans, assessments with sport rubrics.
- Physical performance: fitness tests and session plans (needs the wave 2 migration).
- Mind & Performance C1: mental-skills library and sport packs, with no personal data; reviewed by a sports psychologist.
- Professional onboarding and verification for psychologists, physiotherapists and nutritionists.
- Shared scheduling and payments for professional bookings.

### Days 61 to 90

- Mind & Performance C2 and C3 (private wellbeing, professional consultations): **only after counsel and clinical sign-off**.
- Nutrition professional workspace and education.
- Physiotherapy and recovery workflow, with return-to-sport decisions recorded from the qualified professional.
- TRIQ Play and communities; competition management (draws, standings).

### Days 91 to 180

Commercial ecosystem (sponsorship, Brand Studio, marketplace, rewards, careers, creators), then corporate, wellness, global, education, inclusive, AI assistants and integrations, as the blueprint orders them.

### Stop or pause

- Switching on new verticals without users. Several flags are on for verticals with zero rows; keep them visible only where they're tested.
- Building screens without the backend, permissions and tests behind them.

---

## 8. First sprint backlog (two weeks)

| # | Item | Acceptance criteria | Needs approval |
|---|---|---|---|
| 1 | Merge `de21216` and `c933409` (security) | Their tests and all existing tests pass; a coach without a permission is refused; joining a second academy requires consent | No |
| 2 | Port the trial-status fix (`a827d8d`) | Converting a trial from the Trials screen succeeds for every status it sends; test added | No |
| 3 | Merge Vercel Analytics, excluding child and parent pages | No analytics script on `/parent`, `/student`, `/live` or receipt pages | No |
| 4 | Delete the 20 fully merged branches | Listed branches gone; nothing unique lost | **Yes** |
| 5 | Revoke EXECUTE on `rls_auto_enable()` from `anon` and `authenticated` | Advisor no longer reports it | **Yes** (production DB) |
| 6 | Migration ledger and staging database | Each SQL file recorded once; wave 2 SQL runs cleanly on staging | **Yes** (staging cost) |
| 7 | Preview deployments with a staging database | A pushed feature branch gets a preview URL that works end to end against staging | **Yes** |
| 8 | Academy journey gaps: fee plans and instalments, overdue panel, one-tap reminders, parent home screen | The full journey in section 7 passes on preview with test data, phone-first at 390px | No (migration items behind flags) |
| 9 | Athlete Passport v1 | A coach finishes a live match and each linked athlete's passport shows it; parents see only their own children; outsiders see no child name; no medical or wellbeing field on the passport | No |
| 10 | Remove the missed-session penalty; restrict coach medical view | Missing a session never lowers points; coaches see only safety-critical medical fields | No |
| 11 | Docs | The ten `docs/TRIQ_*.md` files exist and match this audit | No |
| 12 | Tenant-isolation tests against the staging database | One academy can't read another's students, fees or receipts through any action tested | Depends on 6 |

---

## 9. Preview release strategy

1. **No more direct pushes to `main`.** Each piece of work goes on a feature branch (`feat/…`, `fix/…`) from `main`.
2. **Every push gets a Vercel Preview deployment.** Previews must point at a **staging database**, never at production. Options: a Supabase branch of `triq`, or a separate Supabase project in Mumbai seeded with fictional data. Both have a cost; you choose.
3. **Preview environment variables**: set `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `HMAC_SECRET` and the rest for the Preview environment, pointing at staging. Test payment keys only.
4. **Review on the preview URL**, with screenshots at 390px and 1440px for UI changes.
5. **Production release** = merging the branch into `main`, **only with your approval**. Vercel then deploys production.
6. **Migrations**: run on staging first, record in the ledger, then on production with your approval, before the code that needs them is merged.
7. **Rollback**: Vercel instant rollback for code; a down script for every migration.
8. **The `xplay` project also deploys from `main`.** Decide whether it should keep doing so.

---

## Decisions needed from you

1. Approve the **branch merges** in section 3 and the **deletion** of the 20 merged branches.
2. Approve **revoking** the public execute permission on `rls_auto_enable()`.
3. Choose the **staging database**: Supabase branch or separate project.
4. Confirm the **two first journeys**: the Academy journey and Athlete Passport v1.
5. Name the **advisors** for sports psychology, safeguarding and counsel, so Mind & Performance can go past content.
6. Approve the **wave 2 migration** on staging first.
