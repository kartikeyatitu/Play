# TRIQ Product Blueprint

Date: 2026-11-06. Every ecosystem and OS from the founder's master blueprint, with the current status of each feature.

Status comes from `docs/TRIQ_AUDIT.md` (code reading plus production row counts on 2026-11-06), checked against the code on `release/sprint-1`. It is not from end-to-end testing. The per-feature tracker with evidence, priority and next step is `TRIQ_FEATURE_MATRIX.md`; keep the two in step.

## Status labels

| Label | Meaning |
|---|---|
| **Built and used** | Code, screens and production rows |
| **Built, unused** | Code and screens, no production rows |
| **Partial** | Code is thin, incomplete or not wired end to end |
| **Schema only** | Prisma model and draft SQL; table not in production; no feature code |
| **Missing** | Nothing found |
| **Planned** | Designed in the audit or a spec; no code yet |
| **Not assessed** | The audit did not check this feature; confirm before relying on it |

"(sprint-1 branch)" means the work is committed on `release/sprint-1` and not yet on `main` or production.

Priorities follow blueprint section 20: P0 foundation; P1 sports operations and athlete development; P2 participation and competition; P3 commercial; P4 extended; P5 intelligence.

---

## 1. TRIQ Core (P0)

| Area | Feature | Status | Notes |
|---|---|---|---|
| Identity | Single account, login, OTP and login links | Built and used | `LoginToken` 307 rows. OTP provider (MSG91) not configured per `docs/SECURITY.md` |
| Identity | Multiple roles, multiple organisation memberships | Built and used | `OrgMembership` 21 rows; academy switcher |
| Identity | Joining a second academy needs consent; cross-academy login links blocked | Built (sprint-1 branch) | Commit `96f467b` |
| Identity | Athlete profiles (cross-academy) | Planned | `AthleteProfile` proposed; today `Student` is per academy |
| Identity | Professional profiles | Built, unused | `ProfessionalProfile`, `ProfessionalCredential` |
| Identity | Parent and guardian accounts | Partial | One parent per student (`Student.parentId`); `GuardianLink` schema only |
| Identity | Organisation accounts, role-based dashboards | Built and used | Owner, staff, coach and parent areas exist |
| Identity | Account verification, profile visibility controls | Partial | Coach verification exists; no general visibility controls |
| Organisations | Creation, staff, invitations, switching, ownership | Built and used | Academy registration, team, coach invites |
| Organisations | Branches | Built, unused | `Branch`, `BatchBranch`, 0 rows |
| Organisations | Organisation verification | Partial | Listing claims (`ClaimRequest`); no general verification flow |
| Permissions | RBAC from membership | Built | `src/lib/membership.ts`; money permissions (`f3ba220`); staff and coach permissions from membership (`bb9fa6f`, sprint-1 branch) |
| Shared services | Payments | Built | Per-academy Razorpay, payment links, online payments |
| Shared services | TRIQ subscription billing | Partial | `Subscription` 1 row; invoicing is manual; `SubscriptionInvoice` schema only |
| Shared services | Notifications | Partial | WhatsApp reminders; no delivery tracking; `MessageDelivery` schema only |
| Shared services | Messaging | Partial | `chat.ts`; no safeguarding controls |
| Shared services | Global search | Missing | |
| Shared services | Documents, private storage | Missing | No shared document service |
| Shared services | Analytics | Partial | Owner insights; Vercel Analytics excludes child, family and token pages (sprint-1 branch) |
| Shared services | Audit logs | Built and used | `AuditLog` 48 rows; owner viewer |
| Shared services | Reviews, customer support | Missing | |
| Shared services | Integrations | Partial | Razorpay, WhatsApp, Stripe webhooks |
| Shared services | AI services | Built | `ai.ts`, `ask.ts`, `insights.ts` with name redaction |
| Shared services | Rate limiting | Built | Postgres-backed on sensitive actions |
| Platform | Tenant isolation tests | Partial | Unit tests with mocks only |
| Platform | Design system | Partial | Semantic tokens; landing redesign unfinished |

## 2. TRIQ Operate

### 2.1 Academy OS (P1, first journey) — strongest area

| Feature | Status | Notes |
|---|---|---|
| Academy setup | Built and used | 10 organisations |
| Branches | Built, unused | 0 rows |
| Sports programmes | Partial | Batches per sport; `SportsProgram` is used by Club/Education, unused |
| Admissions CRM, enquiries | Built and used | `Lead` 11 rows; `/join` creates a lead needing approval |
| Trials and trial conversion | Built and used | Trial-status fix (`a827d8d`) still to port |
| Students | Built and used | `Student` 160 rows |
| Parents and guardians | Partial | One parent per student; `GuardianLink` schema only |
| Coaches, coach management | Built and used | Coach invites, coach sessions, payroll |
| Batches | Built and used | `Batch` 27 rows |
| Scheduling | Built and used | `Session` 217 rows; operations calendar |
| Attendance | Built and used | `Attendance` 1,587 rows |
| Fees | Built and used | `FeeRecord` 460 rows; fee plans thin (`FeePlan` 7 rows, 37-line action) |
| Fee plans and instalments | Partial | Sprint 1 item 8 |
| Overdue and renewal workflow | Partial | Reminders exist; no overdue panel or renewal workflow |
| Invoices | Built, unused | GST invoices, 0 rows |
| Receipts | Built and used | `Receipt` 15 rows |
| Receipt voiding | Schema only | Columns in wave 2 SQL; held out of Prisma until the SQL runs |
| Payment reconciliation | Not assessed | |
| UPI AutoPay | Built, unused | `FeeMandate` 0 rows |
| Discounts and scholarships | Built | Coupons (not redeemable yet), concessions, `ScholarshipProgram` |
| Parent portal | Partial | `/parent` exists; parent home screen is a Sprint 1 gap |
| Student progress, assessments | Built and used | `SkillReport` 100 rows; printable monthly progress report. No sport rubrics |
| Announcements | Built | Read receipts and replies behind `communities` flag |
| Reports | Built | Business report, owner insights, exports |
| Retention | Partial | At-risk students and cohorts are analytics only; no workflow |
| Equipment inventory | Built and used | `Equipment` 7 rows |
| Camps | Missing | Not found |
| Academy competitions | Built, unused | `Competition`, `Fixture` 0 rows |
| Payroll, staff attendance, expenses, store, events, holidays, transport, imports | Built | Usage not counted in the audit except where shown above |
| Consent ledger | Schema only | `ConsentRecord` |

### 2.2 Gym OS (P1, later) — Missing

Member onboarding, membership plans, renewals, personal trainers, group classes, workout programmes, class schedules, attendance, facility capacity, equipment, payments, personal-training bookings, member progress, fitness assessments, retention, trainer compensation, reports. **All Missing.** No membership-plan, class or trainer model exists.

### 2.3 Club OS (P1) — Partial, unused

| Feature | Status |
|---|---|
| Club and team management | Partial, unused (`SportsProgram`, `ProgramTeam`) |
| Squad management, player registrations | Missing |
| Contracts and membership records | Missing |
| Coaches, staff, facilities, training schedules | Partial (shared with Academy OS) |
| Match schedules, competition records | Built, unused (`Competition`, `Fixture`, `ParticipationRecord`) |
| Club finances, communication, performance reporting | Not assessed for clubs; Academy equivalents exist |

### 2.4 Coach OS (P1) — Partial

| Feature | Status |
|---|---|
| Professional profile, specialisations, qualifications, experience | Built, unused (`ProfessionalProfile`, `ProfessionalExperience`, `ProfessionalCredential`) |
| Verification | Built (`coach-verification.ts`) |
| Academy affiliations | Built and used (memberships) |
| Session scheduling, athlete roster | Partial (coach sessions and batches; no roster view) |
| Availability, leave | Missing |
| Training plans | Schema only (`Drill`, `SessionPlan`) |
| Performance assessments | Partial (skill reports; no sport rubrics) |
| Compensation records | Built (payroll) |
| Career opportunities | Built, unused (Careers) |
| Certifications, coach development | Missing |
| Reviews and reputation | Missing |

### 2.5 Venue OS (P1) — Built, barely used

| Feature | Status |
|---|---|
| Listings, facility and court management, availability, pricing, reservations | Built, barely used (`turf-bookings.ts`, facilities, allocation; 1 booking row) |
| Payments | Built |
| Booking holds, cancellations, refunds | Partial (audit lists holds and refunds as gaps) |
| Recurring bookings | Partial (weekly batch allocation only) |
| Check-ins | Missing |
| Maintenance | Partial (blocked slots) |
| Utilisation, revenue reports | Built (utilisation metric, booking history) |

### 2.6 Sports Event Business OS (P1) — Partial

| Feature | Status |
|---|---|
| Event creation, registration (RSVP) | Partial (`Event`, `RSVP`; production usage not confirmed) |
| Waitlist | Schema only (`EventWaitlist`) |
| Ticketing, vendors, officials, budgets, sponsors, check-in, event analytics | Missing |

## 3. TRIQ Athlete (P1 flagship)

Six dimensions; details in `TRIQ_ATHLETE_ECOSYSTEM.md`.

| Dimension / feature | Status | Notes |
|---|---|---|
| Athlete Passport | Partial | `student/[id]`, `athlete.ts`; per academy only; no athlete login; 0 achievement and goal rows |
| Passport v1 from existing data | Planned | Sprint 1 item 9 |
| Verified vs self-reported marking | Partial | Achievements have staff review; not shown as verified/self-reported |
| Competition history | Built, unused | `LiveMatch`, `AthleteMatchStat`, `PerformanceResult`, 0 rows; no season or passport view |
| Physical performance (TRIQ Body) | Schema only | `FitnessResult`, `Drill`, `SessionPlan` |
| Training load, wearables | Missing | |
| Mind & Performance | Missing | See section 4 |
| Nutrition | Missing | |
| Recovery and injury | Partial | `medical.ts` (medical info, SOS), `Incident` 0 rows; coaches currently see more medical fields than needed |
| Career and opportunities | Built, unused | `Opportunity`, applications with guardian consent, `ScholarshipProgram` |
| Recognition | Partial | `points.ts`, `gamification.ts`; legacy rule deducts 5 points per missed session (to be removed); wave 2 rewards schema only |

## 4. TRIQ Mind & Performance (P1 flagship, gated) — Missing

Nothing athlete-facing exists. Full design in `TRIQ_MIND_AND_PERFORMANCE.md`.

| Feature | Status | Gate |
|---|---|---|
| Mental-skills library and programmes (focus, confidence, anxiety, emotional regulation, resilience, motivation, team) | Planned (C1) | Sports psychologist content review |
| Sport packs (badminton, cricket, football, basketball, athletics, combat) | Planned (C1) | Content review |
| Parent and coach education | Planned (C1) | Content review |
| Match-day workspace (content parts) | Planned (C1) | Content review |
| Private mental performance profile, check-ins, journal | Planned (C2) | Counsel and clinical sign-off |
| Sports psychology services marketplace and workspace | Planned (C3) | Credential verification, counsel, clinical sign-off |
| Wellbeing support, screening under professional governance, emergency pathways | Planned (C2/C3) | Counsel and clinical sign-off |
| Psychology analytics (private, consent-based) | Planned | After C2 |

## 5. TRIQ Body, Nutrition, Recovery

| Ecosystem | Feature | Status |
|---|---|---|
| Body | Physical assessments, assessment templates | Missing (skill reports only) |
| Body | Performance testing, personal bests | Partial (`PerformanceResult` integers, fixed measures; `FitnessResult` schema only) |
| Body | Training programmes, calendars | Schema only (`Drill`, `SessionPlan`, `SessionPlanItem`) |
| Body | Training load | Missing |
| Body | Wearables and device integrations | Missing |
| Nutrition | Verified nutritionists, consultations, plans, education, sport templates | Missing |
| Recovery | Provider discovery, verification, appointments | Partial (`WellnessProvider`, `WellnessAppointment` built for adult wellness, unused) |
| Recovery | Injury workflow, rehab programmes, return-to-sport coordination | Missing (`Incident` exists, 0 rows) |

## 6. TRIQ Participate (P2)

| Feature | Status |
|---|---|
| Academy discovery and listings, city pages | Built (`ListedAcademy`, `/academies`, `/noida`, `/gurgaon`) |
| Trial booking | Built and used |
| TRIQ Play: find players and groups, create and join games, recurring activities, capacity, waitlists, check-ins, reviews, moderation | Missing |
| Community OS | Partial (communities flag on; announcement read receipts, replies and moderation only) |

## 7. TRIQ Compete (P2)

| Feature | Status |
|---|---|
| Live scoring, 22 sports across 7 scoring families | Built, unused (0 production matches); offline queue in progress |
| Competition creation, entries, fixtures | Built, unused |
| Draws, standings, tie-breakers | Partial (standings computed design in wave 2 spec; `fixtures` flag off) |
| Officials, referees, appeals, certificates, entry fees | Missing |
| Competition psychology and wellbeing resources | Planned (with Mind & Performance C1) |

## 8. TRIQ Grow (P3)

| OS | Status |
|---|---|
| Brand Studio and Sponsorship OS (profiles, campaigns, proposals, deliverables) | Built, unused |
| Recognition Engine | Partial (achievements with staff review; no certificates or verified rankings) |
| Rewards and Perks | Partial (`points.ts`); ledger, badges, catalogue, redemptions schema only |
| Marketplace (kit store with orders) | Built, unused; pay at academy only; no seller verification, disputes or settlement |
| Creator OS | Built, unused |
| Careers OS (jobs, applications, credential review) | Built, unused |

Minors' protections and settlement are the main gaps across Grow.

## 9. TRIQ Connect (P1 for Mind & Performance)

| Feature | Status |
|---|---|
| Professional profiles, experience, credentials, ops credential review | Built, unused |
| Discovery and booking for psychologists, physiotherapists, nutritionists | Missing |
| `ProviderPractice` and verification states | Planned |
| Messaging with privacy, moderation and safeguarding | Missing |
| Reviews, referrals, professional development | Missing |

## 10. TRIQ Expand (P4)

| OS | Status |
|---|---|
| Wellness OS (providers, appointments) | Built, unused |
| Education OS (institutions, programmes, teams) | Built, unused |
| Enterprise (consolidated reports) | Partial |
| Corporate Sports OS | Partial; flag off |
| Global Sports OS | Partial (scholarships only) |
| Inclusive Sports OS | Partial (concessions and scholarship programmes; flag on; plan documented) |

## 11. TRIQ Intelligence (P5)

| Assistant / control | Status |
|---|---|
| Ask TRIQ, coach note drafts, report explanations, insights, register photo reading | Built |
| Name redaction before model calls | Built |
| Monthly spend cap (`AI_MONTHLY_BUDGET_INR`) | Built |
| Permission-aware retrieval | Missing |
| Consent enforcement for AI | Missing |
| Evaluations and refusal tests (no diagnosis, no return-to-play) | Missing |
| Athlete AI, Mind & Performance AI, Sports science AI, Business AI | Missing |
| Provider fallback | Not assessed |

Configuration risk: the AI key is saved in Vercel as `Triqprod` while the code reads `ANTHROPIC_API_KEY` (last checked 2026-10-29). Re-check before AI testing.

## 12. Cross-vertical journeys

| Journey | Status |
|---|---|
| Academy: enquiry → trial → enrolment approval → batch → attendance → fee plan → invoice → reminder → payment → receipt → parent home → monthly progress report | Partial; Sprint 1 target |
| Athlete: the 19-step connected journey (`TRIQ_ATHLETE_ECOSYSTEM.md`) | Steps 1–5 partial; most later steps missing |
| Professional: profile → qualifications → verification → services → availability → packages → requests → consent → sessions → private records → follow-up → payment → business tracking | Profile and credentials built, unused; the rest missing |
