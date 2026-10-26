# TRIQ Architecture

## Stack
- **App:** Next.js 15 App Router, React 19, TypeScript, Tailwind. Server components + server actions (`src/app/actions/*`), a few route handlers (`src/app/api/*`: auth, cron/monthly-fees, health, receipts, webhooks razorpay/stripe/whatsapp).
- **Data:** Prisma 5 → Supabase Postgres (`ap-south-1`). Schema of record: `prisma/schema.prisma`. Additive SQL in `prisma/sql/`.
- **Hosting:** Vercel, project `sportsos`, deploys `main` to production; branches get previews.
- **Tests:** Vitest (`src/**/__tests__`).

## Layering
```
UI (src/app/**/page.tsx, src/components/**)
   │  calls
Server actions (src/app/actions/*.ts, "use server", async exports only)
   │  auth → requirePermission → validate → db → auditLog
Pure domain rules (src/lib/*.ts, unit-tested, no I/O)
   │
Prisma client (src/lib/db.ts) → Postgres (RLS on, service connection)
```
Rules: business logic in `src/lib` pure functions; actions orchestrate; UI never queries the DB directly for writes.

## Vertical → code map
| Vertical | Main code today |
|---|---|
| 1 Business | `academy.ts`, `batch.ts`, `attendance.ts`, `fees.ts`, `payments.ts`, `trial*.ts`, `leads.ts`, `team.ts`, `announcements.ts`, `chat.ts`, `reports.ts`, `payroll.ts`, `coupons.ts`, `referral*.ts`, `points.ts` |
| 2 Athlete | `src/app/student/[id]`, `SkillReport`, `media.ts`, `medical.ts`, `gamification.ts` |
| 3 Play | `events.ts` (`Event`, `RSVP`), UI-only bracket |
| 4 Spaces | `turf-bookings.ts`, `facilities.ts`, `src/lib/turf*.ts`, `TurfBooking`, `Booking`, `Facility` |
| 5 Careers | `/c/[coachId]`, `coach-invites.ts`, `coach-verification.ts` |
| 6 Wellness | `medical.ts`, `incidents.ts` |
| 7 Creators | — (new) |
| 8 Commerce | `store.ts` (`Product`, `Order`) |
| 9 Brand Studio | — (archived Brand models, no orgId) |
| 10 Education | — (new) |
| 11 Enterprise | `AuditLog`, `export.ts`, branches (unmerged), `Subscription`, `BillingInvoice` |

Detailed status per feature: `docs/FEATURE_STATUS.md`. Specs: `docs/specs/`.

## Cross-cutting conventions
- **Money:** new tables store `Int` minor units + `currency`. Legacy `Float` columns remain until an approved migration.
- **Time:** store UTC instants; dates-as-strings (`YYYY-MM-DD`) computed in org timezone via `src/lib/i18n.ts`.
- **Flags:** `src/lib/features.ts`; new verticals default off.
- **Status enums:** constants in `src/lib/enums.ts` (never in `"use server"` files).
- **Audit:** `db.auditLog.create({ orgId, userId, action, entity, entityId, meta })` on every mutation.

## Metrics (definitions)
- **Attendance rate** = present ÷ (present + absent) for sessions in the period, excluding holidays and cancelled sessions.
- **Outstanding** = sum of FeeRecord amounts with status not PAID for months ≤ current org month.
- **Collected** = sum of PAID fee records by payment date in the period.
- **Utilisation (venue)** = booked minutes ÷ open minutes (operating hours minus blocked slots).
- **Active students** = students with at least one active batch enrolment.

## Known structural debts
1. Single `User.orgId` / unique `User.phone` blocks multi-org people.
2. One guardian per student.
3. Mixed money types.
4. Repo SQL does not reproduce the full production schema.
5. `sportsos` and `xplay` Vercel projects both build from this repo (cleanup deferred).
