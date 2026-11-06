# TRIQ Architecture

Date: 2026-11-06. Target architecture from `docs/TRIQ_AUDIT.md` section 5, adopted with the blueprint on 2026-11-06. `docs/ARCHITECTURE.md` (2026-10-26) still describes the current layering, conventions and metric definitions; this document sets the direction. Where they differ, this document is the plan and `ARCHITECTURE.md` is today's state.

Each section says what exists today and what is proposed. Nothing marked **Proposed** or **Planned** is built.

## 1. Stack and hosting (today)

| Item | Value |
|---|---|
| App | Next.js 15 App Router, React 19, TypeScript, Tailwind with semantic CSS tokens |
| Data | Prisma 5 on Supabase Postgres, project `triq`, Mumbai (`ap-south-1`) |
| Access | The app connects with the service role. RLS is enabled on every table with no policies, so the public REST API is denied by default |
| Hosting | Vercel project `sportsos`, region `bom1`. A second project, `xplay`, also deploys from `main` (decision pending) |
| Size | 118 Prisma models; 93 tables in production (the 25 wave 2 models are not applied); about 90 server-action files |
| Tests | Vitest; 492 tests passing at `8c8ed4b` |
| Flags | `src/lib/features.ts`; env override `NEXT_PUBLIC_FEATURE_<NAME>=1` |

## 2. Modular monolith

One Next.js application. No new application and no microservices.

**Proposed layout.** Each domain gets a folder `src/domains/<domain>/`:

| File | Role |
|---|---|
| `service.ts` | Business logic and transactions |
| `policy.ts` | Who can do what, including consent purpose and data tier checks |
| `queries.ts` | Reads, already scoped by policy |
| `types.ts` | Domain types |

Server actions in `src/app/actions` become thin wrappers: authenticate, call the domain service, return. Code moves into domains **as it is touched**, not in one large refactor. Status: **Planned.** `src/domains/` does not exist yet.

### Domains

Following the blueprint:

| Group | Domains |
|---|---|
| Platform | Identity, Organisations, Memberships, Permissions, Notifications, Analytics, AI |
| Operate | Academy, Coach, Scheduling, Attendance, Venues, Activities |
| Money | Billing, Payments, Marketplace |
| Athlete | Athlete, PhysicalPerformance, MentalPerformance, Psychology, Nutrition, Recovery, HealthcareProvider |
| Participate and compete | Competitions, Communities |
| Grow and expand | Brands, Sponsorships, Careers, Education, Wellness |

Rules between domains:

- A domain reads another domain's data only through that domain's `queries.ts`, never by raw table access.
- `MentalPerformance`, `Psychology`, `Recovery` (tier 2 and 3 parts) and `HealthcareProvider` clinical records sit behind the `care` schema and its access grants (see `TRIQ_DATA_PRIVACY.md`). No other domain can join into them.

## 3. Identity model

| Concept | Today | Proposed | Status |
|---|---|---|---|
| Login account | `User` | Keep. One account, many roles and memberships | Built and used |
| Per-academy athlete record | `Student` (belongs to one organisation) | Keep | Built and used |
| Cross-academy athlete | None | **`AthleteProfile`**: one per person, owned by the athlete (or guardian for a minor), linked to many `Student` records across academies. The passport reads from here | Planned |
| Guardian | `Student.parentId` (one parent) | **`GuardianLink`**: many guardians to many children, at most one primary. `Student.parentId` stays as the legacy primary | Schema only (wave 2) |
| Membership and permissions | `User.role` plus `OrgMembership.permissions` | Keep. Add an athlete role: login for 18+; minors through guardians | Built; athlete role Planned |
| Professional | `ProfessionalProfile`, `ProfessionalExperience`, `ProfessionalCredential` | Add **`ProviderPractice`** (a psychologist's or physiotherapist's practice) and explicit verification states | Built, unused; additions Planned |
| Wellness provider | `WellnessProvider`, `WellnessAppointment` | Reuse for professional booking in Mind & Performance C3 | Built, unused |

Known identity debts (from `docs/ARCHITECTURE.md`): single `User.orgId` and unique `User.phone` make multi-organisation people awkward; one guardian per student.

## 4. Database principles

| Principle | Rule | Status |
|---|---|---|
| Versioned SQL with a ledger | Numbered hand-written SQL in `prisma/sql/`. A `_migrations` ledger table records each file applied, by whom and when. No `prisma migrate`, no `prisma db push` | SQL files: Built (21 files). Ledger: Planned (Sprint 1 item 6) |
| Retire runtime DDL | `src/lib/schema-ensure.ts` runs DDL at runtime today. Retire it once its tables are covered by migrations | Planned |
| Staging first | Every migration runs on a non-production database first, then on production with founder approval, before the code that needs it is merged | Planned; staging database not yet chosen (Supabase branch or separate Mumbai project) |
| Additive only | Production changes are additive unless a destructive change has its own approval | In force |
| Integer money | All new tables store money as integer minor units (paise) plus currency. Legacy `Float` money columns (for example `Receipt.amount`) migrate later in a separate, approved plan | In force for new tables |
| Private storage | Files containing children's or health data go to private storage, served by signed URLs only | Planned (no shared document service yet) |
| Idempotency | Idempotency keys on payments, bookings, rewards and live-scoring events | Built for live scoring; `PointsLedger` and `MessageDelivery` have keys in schema; extend to payments and bookings |
| RLS on every table | Every new table enables RLS with no policies | In force |
| Tenant scoping | Tenant tables carry `orgId`, with an index starting with it | In force |
| Append-only where it matters | Ledgers, media audit and waiver signatures are never updated; corrections are new rows | Schema only (wave 2) |
| Rollback | A down script for every migration | Partial (wave 2 has one) |

Deploy-order rule: a Prisma client must never select columns that production does not have yet. Example: `Receipt.voidedAt`, `voidReason` and `voidedById` stay out of `prisma/schema.prisma` until the wave 2 SQL has run (see `TRIQ_DECISIONS.md`).

## 5. Sensitive data placement

| Tier | Where | Access path |
|---|---|---|
| 1. Coaching | `public` schema, tenant-scoped | Domain queries with membership permissions |
| 2. Personal wellbeing | Separate `care` schema | `care` service functions checking a `CareAccessGrant`; every read logged |
| 3. Clinical | `care` schema, application-level encryption | Same, plus decryption key held only in production environment variables |

Status: `care` schema **Planned**. It must not hold real data before counsel and clinical sign-off. Full design in `TRIQ_DATA_PRIVACY.md`.

## 6. AI architecture

| Control | Rule | Status |
|---|---|---|
| Name redaction | Children's and parents' names redacted before every model call | Built (`032d3fd`) |
| Spend cap | Platform-wide monthly cap, `AI_MONTHLY_BUDGET_INR` | Built |
| Permission-aware retrieval | The model receives only what the requesting user could see, assembled by domain query functions, never raw table access | Planned |
| Consent enforcement | Purpose `ai_assistance` and tier checks before any child data is included | Planned (needs `ConsentRecord`) |
| Tier exclusion | Tier 2 and tier 3 data never enter AI context | Planned (enforced by `care` schema separation) |
| Audit | One audit entry per AI action | Partial |
| Cost caps per academy | Per-academy allowance (pricing: 50 actions/month Free, 1,000 Growth) | Partial |
| Human approval | A person approves anything sent to parents | Partial (drafts and WhatsApp share buttons; no automatic sending) |
| Fallback | Product works when the provider is down. No essential workflow depends on AI | Not assessed |
| Safety refusals | No diagnosis, no injury prediction, no return-to-play decisions, no inference of psychological conditions, no psychotherapy. Tested as refusal cases | Planned |

## 7. Mobile

| Stage | Status |
|---|---|
| Phone-first web app; screens checked at 390px | Built |
| Installable PWA | Planned |
| Native apps via the existing Capacitor configuration (`capacitor.config.json`) | Planned |
| Offline attendance and scoring for coaches | In progress (live-scoring offline queue) |

## 8. Release process

Decided 2026-11-06 (see `TRIQ_DECISIONS.md`). Full strategy: `TRIQ_AUDIT.md` section 9.

```
feature branch (feat/…, fix/…) from main
   │ push
Vercel Preview deployment ──► staging database (never production), test payment keys
   │ review on the preview URL; screenshots at 390px and 1440px for UI changes
founder approval
   │
merge to main ──► Vercel production deploy
```

1. No direct pushes to `main`.
2. Every push gets a Vercel Preview. Previews point at a staging database. Today preview builds have no `DATABASE_URL` or `DIRECT_URL`, so this needs Preview environment variables set (`DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `HMAC_SECRET` and the rest), with values separate from production.
3. Migrations run on staging first, are recorded in the ledger, then run on production with founder approval, before the code that needs them is merged.
4. Feature flags default off. A flag for a table must stay off until that table exists in the target database.
5. Rollback: Vercel instant rollback for code; a down script for each migration.
6. Open question: should `xplay` keep deploying from `main`?

Release checklist per slice (from `docs/SECURITY.md`, still in force): server-side validation; `orgId`-scoped queries; permission check; audit entry; `"use server"` files export only async functions; new tables have `orgId` and RLS; flag default off; typecheck clean; tests pass; `next build` passes.
