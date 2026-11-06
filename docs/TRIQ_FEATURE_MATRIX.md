# TRIQ Feature Matrix

Date: 2026-11-06. This is the tracker. Update a row whenever a feature changes status, in the same PR as the change.

Source of statuses: `docs/TRIQ_AUDIT.md` (code reading and production row counts on 2026-11-06), checked against `release/sprint-1`. Not end-to-end tested unless stated. Action files are in `src/app/actions/`; tables are Prisma models in `prisma/schema.prisma`.

**Status:** Built and used · Built, unused · Partial · Schema only · Missing · Planned · Not assessed. "(sprint-1)" = committed on `release/sprint-1`, not yet on `main`.

**Priority** (blueprint section 20): P0 foundation · P1 operations and athlete · P2 participation and competition · P3 commercial · P4 extended · P5 intelligence. "S1" marks a Sprint 1 item.

How to edit: keep one row per feature; keep the six columns; put the date in the next-step cell when a row changes status.

## TRIQ Core

| Ecosystem | Feature | Status | Evidence | Priority | Next step |
|---|---|---|---|---|---|
| Core | Accounts, login links | Built and used | `auth.ts`, `login-links.ts`; `LoginToken` 307 rows | P0 | Configure OTP provider |
| Core | Multiple roles and org memberships | Built and used | `OrgMembership` 21 rows; `team.ts` | P0 | — |
| Core | Second-academy join needs consent; no cross-academy login links | Built (sprint-1) | commit `96f467b` | P0 S1 | Merge to `main` after preview review |
| Core | Permissions (RBAC) from membership | Built | `src/lib/membership.ts`, `src/lib/team.ts`; `f3ba220`; `bb9fa6f` (sprint-1) | P0 S1 | Check non-admin roles (coach, physio, seller, verifier) |
| Core | Money permissions | Built | `f3ba220` | P0 | — |
| Core | Athlete identity across academies (`AthleteProfile`) | Planned | — | P1 | Design table; staging migration |
| Core | Athlete login (18+) | Missing | — | P1 | After `AthleteProfile` |
| Core | Guardian links (many-to-many) | Schema only | `GuardianLink`; flag `familyAccounts` off | P1 | Wave 2 SQL on staging |
| Core | Professional profiles and credentials | Built, unused | `ProfessionalProfile`, `ProfessionalCredential`; `careers.ts` | P1 | Add `ProviderPractice`, verification states |
| Core | Profile visibility controls | Missing | — | P1 | Design with passport modes |
| Core | Branches | Built, unused | `Branch`, `BatchBranch` 0 rows; `branches.ts` | P1 | Test with a multi-centre academy |
| Core | Audit log | Built and used | `AuditLog` 48 rows; `audit.ts`; viewer flag | P0 | — |
| Core | Rate limiting | Built | `RateLimit`; `b3dc136` | P0 | — |
| Core | Payments (per-academy Razorpay, links, online) | Built | `payments.ts`, `online-payments.ts`, `payment-links.ts`, `razorpay-connect.ts` | P0 | Idempotency keys on payments |
| Core | TRIQ subscription billing | Partial | `Subscription` 1 row; `BillingInvoice` 0; `SubscriptionInvoice` schema only | P0 | Automate invoicing (₹150/active student, min ₹699) |
| Core | Notifications and delivery tracking | Partial | `notifications.ts`, `reminders.ts`; `MessageDelivery` schema only | P0 | Wave 2 SQL; delivery log |
| Core | Notification preferences | Schema only | `NotificationPreference` | P0 | Wave 2 SQL |
| Core | Messaging | Partial | `chat.ts` | P1 | Add moderation and safeguarding before minors |
| Core | Global search | Missing | — | P2 | — |
| Core | Documents and private storage | Missing | — | P0 | Private bucket, signed URLs |
| Core | Reviews | Missing | — | P2 | — |
| Core | Customer support | Missing | — | P2 | — |
| Core | Consent ledger | Schema only | `ConsentRecord`; flag `consentLedger` off | P0 | Wave 2 SQL; counsel on purposes |
| Core | Waivers and guardian e-signatures | Schema only | `WaiverTemplate`, `WaiverSignature`; flag `waivers` off | P1 | Wave 2 SQL |
| Core | Data requests (delete, export) | Partial | `account-deletion.ts` records requests only; `DataRequest` schema only | P0 | Build purge workflow with approval |
| Core | Versioned migrations with ledger | Partial | 21 files in `prisma/sql/`; no ledger; runtime DDL in `src/lib/schema-ensure.ts` | P0 S1 | `_migrations` table; retire runtime DDL |
| Core | Staging database | Missing | — | P0 S1 | Founder chooses Supabase branch or separate project |
| Core | Preview deployments on staging | Partial | Previews build; no `DATABASE_URL` in Preview | P0 S1 | Set Preview env vars to staging |
| Core | Tenant-isolation tests (DB level) | Partial | Mocked unit tests only | P0 S1 | Staging test matrix (`TRIQ_SECURITY.md` §4) |
| Core | Revoke `rls_auto_enable()` execute | Built (applied to production 2026-11-06) | `prisma/sql/2026-11-06_revoke_rls_auto_enable.sql`; verified anon=false, authenticated=false | P0 S1 | Re-run the advisor after the next migration |
| Core | Move `btree_gist` out of `public` | Planned | Supabase advisor WARN | P0 | Planned migration |
| Core | Web analytics without child pages | Built (sprint-1) | `src/components/site-analytics.tsx`, `src/lib/analytics-privacy.ts`; `94c5826` | P0 S1 | Merge to `main` |
| Core | Design system | Partial | `docs/design/TRIQ_DESIGN_SYSTEM.md`; tokens; `SportIcon` (`16706b8`) | P0 | Finish shell and landing |
| Core | Branch consolidation (delete 20 merged branches) | Planned | `TRIQ_AUDIT.md` §3 | P0 S1 | Delete remote branches (approved) |

## TRIQ Operate

| Ecosystem | Feature | Status | Evidence | Priority | Next step |
|---|---|---|---|---|---|
| Operate: Academy | Academy setup and onboarding | Built and used | `Organization` 10 rows; `register-academy.ts`, `onboarding.ts` | P1 | — |
| Operate: Academy | Enquiries and admissions CRM | Built and used | `Lead` 11 rows; `leads.ts`; `/join` creates a lead | P1 S1 | Part of academy journey test |
| Operate: Academy | Trials and conversion | Built and used | `trial.ts`, `trial-convert.ts` | P1 S1 | Port `a827d8d` status fix |
| Operate: Academy | Enrolment approval | Partial | `enroll-child.ts` | P1 S1 | Journey test on preview |
| Operate: Academy | Students | Built and used | `Student` 160 rows | P1 | — |
| Operate: Academy | Batches | Built and used | `Batch` 27 rows; `batch.ts` | P1 | — |
| Operate: Academy | Sessions and scheduling | Built and used | `Session` 217 rows; `auto-sessions.ts`, `ops-calendar.ts` | P1 | — |
| Operate: Academy | Attendance | Built and used | `Attendance` 1,587 rows; `attendance.ts` | P1 | Offline attendance for coaches |
| Operate: Academy | Fee records | Built and used | `FeeRecord` 460 rows; `fees.ts`, `auto-fees.ts` | P1 | Float → integer money plan |
| Operate: Academy | Fee plans and instalments | Partial | `FeePlan` 7 rows; `fee-plans.ts` (thin) | P1 S1 | Build instalments |
| Operate: Academy | Overdue panel | Partial | Fee ageing in insights | P1 S1 | Build panel |
| Operate: Academy | Reminders (one-tap) | Partial | `reminders.ts` (WhatsApp) | P1 S1 | One-tap reminders |
| Operate: Academy | Receipts | Built and used | `Receipt` 15 rows; `src/lib/receipt-service.ts` | P1 | — |
| Operate: Academy | Receipt voiding | Schema only | Columns in `2026-10-29_wave2.sql`, held out of `schema.prisma`; flag `receiptVoid` off | P1 | Run SQL, then add fields, then deploy |
| Operate: Academy | GST invoices | Built, unused | `TaxInvoice` 0 rows; `gst-invoices.ts` | P1 | Pilot with one academy |
| Operate: Academy | UPI AutoPay | Built, unused | `FeeMandate` 0 rows; `autopay.ts` | P1 | Pilot |
| Operate: Academy | Concessions and scholarships | Built | `FeeConcession`, `ScholarshipProgram`; `concessions.ts` | P1 | Usage not assessed |
| Operate: Academy | Coupons and referrals | Partial | `coupons.ts`, `referral.ts`; coupons not redeemable | P1 | — |
| Operate: Academy | Payment reconciliation | Not assessed | — | P1 | Check against Razorpay settlements |
| Operate: Academy | Parent portal / parent home | Partial | `src/app/parent` | P1 S1 | Build parent home screen |
| Operate: Academy | Skill reports | Built and used | `SkillReport` 100 rows | P1 | Sport rubrics (Phase B) |
| Operate: Academy | Monthly progress report | Built | flag `progressReport` | P1 S1 | Part of journey test |
| Operate: Academy | Announcements | Built | `announcements.ts` | P1 | — |
| Operate: Academy | Business report, owner insights, exports | Built | `business-report.ts`, `insights.ts`, `export.ts` | P1 | Exclude tier 2/3 from exports when they exist |
| Operate: Academy | Retention (at-risk, cohorts) | Partial | flags `atRiskStudents`, `funnelCohorts` | P1 | Retention workflow |
| Operate: Academy | Renewals | Missing | — | P1 | Design with fee plans |
| Operate: Academy | Equipment inventory | Built and used | `Equipment` 7 rows | P1 | — |
| Operate: Academy | Payroll, staff attendance, expenses | Built | `payroll.ts`; `StaffAttendance`, `Expense` | P1 | Usage not assessed |
| Operate: Academy | Holidays, transport, imports | Built | `holidays.ts`, `transport.ts`, `import.ts` | P1 | — |
| Operate: Academy | Camps | Missing | — | P1 | Confirm need with pilots |
| Operate: Academy | Academy competitions | Built, unused | `Competition`, `Fixture` 0 rows | P2 | — |
| Operate: Gym | Gym OS (all features) | Missing | No membership-plan, class or trainer model | P1 later | Wait for first gym customer |
| Operate: Club | Clubs, teams | Partial, unused | `SportsProgram`, `ProgramTeam`, `ParticipationRecord` | P1 | — |
| Operate: Club | Squads and player registrations | Missing | — | P1 | — |
| Operate: Club | Contracts and membership records | Missing | — | P1 | — |
| Operate: Coach | Coach invites and onboarding | Built | `coach-invites.ts` | P1 | — |
| Operate: Coach | Coach verification | Built | `coach-verification.ts` | P1 | — |
| Operate: Coach | Coach sessions | Partial | `coach-session.ts` | P1 | — |
| Operate: Coach | Availability and leave | Missing | — | P1 | Days 31–60 |
| Operate: Coach | Athlete roster | Partial | Batches with `coachId` | P1 | Days 31–60 |
| Operate: Coach | Training plans | Schema only | `Drill`, `SessionPlan`, `SessionPlanItem`; flag `drillLibrary` off | P1 | Wave 2 SQL |
| Operate: Coach | Compensation | Built | `payroll.ts` | P1 | — |
| Operate: Coach | Certifications, development, reviews | Missing | — | P1 | — |
| Operate: Venue | Listings, facilities, courts, availability, pricing, reservations | Built, barely used | `turf-bookings.ts`, `facilities.ts`; `TurfBooking` 1 row | P1 | Venue pilot |
| Operate: Venue | Facility allocation to batches | Built | `facility-allocation.ts` | P1 | — |
| Operate: Venue | Holds, refunds, recurring bookings | Partial | Audit gap | P1 | Build and test |
| Operate: Venue | Check-ins | Missing | — | P1 | — |
| Operate: Venue | Utilisation and booking history | Built | flag `spacesOps` | P1 | — |
| Operate: Events | Events and RSVP | Partial | `Event`, `RSVP`; `events.ts` | P1 | — |
| Operate: Events | Event waitlist | Schema only | `EventWaitlist`; flag `eventWaitlist` off | P1 | Wave 2 SQL |
| Operate: Events | Ticketing, officials, vendors, budgets, check-in | Missing | — | P1 | — |

## TRIQ Athlete

| Ecosystem | Feature | Status | Evidence | Priority | Next step |
|---|---|---|---|---|---|
| Athlete | Athlete Passport v1 | Partial | `src/app/student/[id]`, `athlete.ts` | P1 S1 | Build Phase A |
| Athlete | Achievements with staff review | Built, unused | `AthleteAchievement` 0 rows | P1 | Show on passport |
| Athlete | Goals | Built, unused | `AthleteGoal` 0 rows | P1 | Show on passport |
| Athlete | Verified vs self-reported marking | Planned | — | P1 S1 | Part of passport v1 |
| Athlete | Season stats and competition history | Built, unused | `LiveMatch`, `AthleteMatchStat`, `PerformanceResult` 0 rows | P1 S1 | Passport view |
| Athlete | Level per sport | Planned | — | P1 | Compute from tier 1 only |
| Athlete | Public/private modes, shareable profile, sporting CV | Missing | — | P1 | After passport v1 |
| Athlete | Evidence uploads | Missing | `MediaAsset` schema only | P1 | Needs private storage |
| Athlete | Coach endorsements | Missing | — | P1 | — |
| Athlete | Points without missed-session penalty | Partial | Rule still in `src/app/actions/points.ts` (−5 per missed session) | P1 S1 | Remove rule; add test |
| Athlete | Coach medical view limited to safety fields | Partial | `medical.ts` | P1 S1 | Restrict fields |
| Athlete | Medical info and SOS | Built | `medical.ts` | P1 | — |
| Athlete | Incidents | Built, unused | `Incident` 0 rows; `incidents.ts` | P1 | Link to recovery workflow |
| Athlete | Opportunities and applications (guardian consent) | Built, unused | `Opportunity`, `OpportunityApplication`; `opportunities.ts` | P1 | Phase E |
| Athlete | Rewards ledger, badges, catalogue, redemptions | Schema only | `PointsLedger`, `XpLedger`, `BadgeDefinition`, `RewardItem`, `Redemption`; flag `rewards` off | P3 | Wave 2 SQL; reuse, don't duplicate `points.ts` |
| Athlete | Leaderboard opt-in | Schema only | `LeaderboardOptIn` | P3 | Guardian opt-in; never wellbeing data |
| Body | Fitness tests | Schema only | `FitnessResult`; flag `fitnessTests` off | P1 | Phase B |
| Body | Performance results (integers) | Built, unused | `PerformanceResult` | P1 | — |
| Body | Assessment templates and sport rubrics | Missing | — | P1 | Phase B |
| Body | Training load | Missing | — | P1 | Decision support only |
| Body | Wearables and devices | Missing | — | P5 | Consent-based |
| Nutrition | Education content | Missing | — | P1 | Phase D |
| Nutrition | Nutritionist workspace and consultations | Missing | — | P1 | Days 61–90 |
| Recovery | Provider discovery and booking | Partial | `WellnessProvider`, `WellnessAppointment` (unused) | P1 | Reuse for C3 / physio |
| Recovery | Injury workflow and return-to-sport record | Missing | — | P1 | Days 61–90; professional decides |
| Recovery | Recovery log | Planned | — | P1 | Tier 2; gated |

## TRIQ Mind & Performance

| Ecosystem | Feature | Status | Evidence | Priority | Next step |
|---|---|---|---|---|---|
| Mind & Performance | Mental-skills library | Planned (C1) | — | P1 | Find reviewing sports psychologist |
| Mind & Performance | Conditioning programmes (content) | Planned (C1) | — | P1 | Write and review |
| Mind & Performance | Sport packs | Planned (C1) | — | P1 | Badminton and cricket first |
| Mind & Performance | Parent and coach education | Planned (C1) | — | P1 | Write and review |
| Mind & Performance | Match-day templates | Planned (C1) | — | P1 | — |
| Mind & Performance | Private profile, check-ins, journal | Planned (C2) | — | P1 gated | Counsel and clinical sign-off; `care` schema |
| Mind & Performance | Safeguarding path and escalation | Planned (C2) | — | P1 gated | Set with clinical advisor and counsel |
| Mind & Performance | Psychologist marketplace and workspace | Planned (C3) | — | P1 gated | Credential rules; `ProviderPractice` |
| Mind & Performance | `care` schema, `CareAccessGrant`, `CareAccessLog`, encryption | Planned | `TRIQ_DATA_PRIVACY.md` §4 | P1 gated | Design review |
| Mind & Performance | Private analytics | Planned | — | P1 gated | After C2 |

## TRIQ Participate and Compete

| Ecosystem | Feature | Status | Evidence | Priority | Next step |
|---|---|---|---|---|---|
| Participate | Academy discovery and listings | Built | `ListedAcademy`; `places.ts`; `/academies`, `/noida`, `/gurgaon` | P2 | — |
| Participate | Venue discovery | Built | `/venues`; flag `spacesDiscovery` | P2 | — |
| Participate | TRIQ Play (find players, games) | Missing | — | P2 | Days 61–90 |
| Participate | Community OS | Partial | flag `communities` (announcement receipts, replies, moderation) | P2 | — |
| Compete | Live scoring (22 sports, 7 families) | Built, unused | `live-scoring.ts`; `LiveMatch` 0 rows | P2 | Pilot match; offline queue |
| Compete | Competitions, entries, fixtures | Built, unused | `competitions.ts`; `Competition`, `CompetitionEntry`, `Fixture` | P2 | — |
| Compete | Draws and standings | Partial | Standings computed (wave 2 spec); flag `fixtures` off | P2 | Days 61–90 |
| Compete | Officials, appeals, certificates, entry fees | Missing | — | P2 | — |
| Compete | Competition wellbeing resources | Planned | — | P2 | With C1 |

## TRIQ Grow and Connect

| Ecosystem | Feature | Status | Evidence | Priority | Next step |
|---|---|---|---|---|---|
| Grow | Brand Studio and sponsorship | Built, unused | `brand-studio.ts`; `SponsorProfile`, `SponsorshipCampaign` | P3 | Minors' protections |
| Grow | Recognition engine | Partial | Achievements with staff review | P3 | Certificates; verified results |
| Grow | Marketplace / kit store | Built, unused | `store.ts`; `StoreOrderDetail` | P3 | Seller verification, refunds, settlement |
| Grow | Media uploads with consent | Schema only | `MediaAsset`, `MediaConsent`; flag `media` off | P3 | Wave 2 SQL; private storage |
| Grow | Creator OS | Built, unused | `creators.ts`; `CreatorProfile` | P3 | — |
| Grow | Careers OS | Built, unused | `careers.ts`; `JobListing`, `JobApplication` | P3 | — |
| Grow | Parent premium plan | Schema only | `ParentPlan` placeholder | P3 | Not defined |
| Connect | Professional profiles and credential review | Built, unused | `ProfessionalProfile`, `ProfessionalCredential`, `verification.ts` | P1 | Onboard first professionals |
| Connect | Discovery and booking for health professionals | Missing | — | P1 | Days 31–60 |
| Connect | Safe messaging with moderation | Missing | `ContentReport` exists | P1 | Safeguarding policy first |

## TRIQ Expand and Intelligence

| Ecosystem | Feature | Status | Evidence | Priority | Next step |
|---|---|---|---|---|---|
| Expand | Wellness OS | Built, unused | `wellness.ts`; `WellnessProvider`, `WellnessAppointment` | P4 | — |
| Expand | Education OS | Built, unused | `education.ts`; `InstitutionProfile` | P4 | — |
| Expand | Enterprise consolidated reports | Partial | `enterprise.ts` | P4 | — |
| Expand | Corporate Sports OS | Partial | flag `corporate` off | P4 | — |
| Expand | Global Sports OS | Partial | Scholarships only | P4 | — |
| Expand | Inclusive Sports OS | Partial | flag `inclusive` on; concessions | P4 | — |
| Intelligence | Ask TRIQ, drafts, insights | Built | `ai.ts`, `ask.ts`, `insights.ts` | P5 | Fix AI key name in Vercel |
| Intelligence | Name redaction before model calls | Built | `032d3fd` | P5 | — |
| Intelligence | Monthly spend cap | Built | `AI_MONTHLY_BUDGET_INR` | P5 | Per-academy allowances |
| Intelligence | Permission-aware retrieval | Missing | — | P5 | Domain query functions |
| Intelligence | Consent enforcement | Missing | Needs `ConsentRecord` | P5 | After consent ledger |
| Intelligence | Safety refusal tests (diagnosis, return-to-play) | Missing | — | P5 | Before any athlete AI |
| Intelligence | Provider fallback | Not assessed | — | P5 | Check |

## Platform

| Ecosystem | Feature | Status | Evidence | Priority | Next step |
|---|---|---|---|---|---|
| Platform | Phone-first web | Built | 390px checks | P0 | — |
| Platform | PWA | Planned | — | P5 | — |
| Platform | Native apps | Planned | `capacitor.config.json` | P5 | — |
| Platform | Required docs (`docs/TRIQ_*.md`) | Built | this folder, 2026-11-06 | P0 S1 | Keep in step with code |
