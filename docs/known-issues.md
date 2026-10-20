# Triq — Known issues & tech debt

Living list of real correctness/safety issues observed in the codebase.
Flagged by a strategy document review on 2026-10-20. Fixes shipped so far
are noted inline; the rest are prioritised below.

## Fixed in commit (2026-10-20)

- **Fee toggle (4.E)** — replaced bidirectional `toggleFeeStatus(studentId, month)` with explicit
  `markFeeAsPaid` (idempotent, safe) and `reverseFeePayment(reason)` (audited, refuses
  reversal of reconciled online payments). `FeeToggle` prompts for a reason before
  reversing. `BulkActions` fixed to pass the right args.
- **Status validation (4.B)** — `updateLeadStatus` and `updateTrialStatus` now validate
  against explicit enum (`LEAD_STATUSES`, `TRIAL_STATUSES`). Unknown values rejected.
- **At-risk students (4.I)** — replaced hardcoded `[]` placeholder with a real SQL query:
  students whose recent (last ≤ 10 sessions) attendance rate is < 60% with ≥ 3 sessions.

## Open — critical (blocks real production launch)

### 4.G Rate limiter is in-memory
`src/lib/rate-limit.ts` uses a module-level `Map`. On Vercel serverless, each cold
start wipes it; across concurrent instances it never shares state. Login/OTP
abuse protection is effectively unenforced.

**Fix:** move to Upstash Redis (free tier covers 10K req/day). Requires:
1. Create Upstash Redis store, link to `sportsos` project
2. Env vars: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
3. Replace Map with `@upstash/ratelimit`

**Risk if unfixed:** OTP spam attack costs money and could lock out real users.

### 4.H Billing plan vocabulary mismatch
Three independent systems with incompatible plan values:
- `Organization.plan` written as `"FREE_TRIAL"` (onboarding.ts, register-academy.ts)
- `Subscription.plan` written/read as `"FREE" | "STARTER" | "PRO" | "ENTERPRISE"` (billing-service.ts)
- UI/pricing exports `FREE_PLAN.id = "free"`, `GROWTH_PLAN`, `ACADEMY_PLAN`

**Fix:** define one canonical `PlanId` type in `pricing.ts` and migrate all three
to use it. Needs a careful data migration for existing `Organization.plan` rows.

**Risk if unfixed:** entitlement checks can mis-fire (free user gets paid features,
or vice versa).

## Open — high

### 4.A Student enrolment integrity
`src/app/actions/users.ts` — an update can remove enrolments before validating
the new batch. Invalid batch leaves student with no enrolment.
**Fix:** validate first, then apply changes atomically in a transaction.

### 4.C Duplicate conversions (leads + trials)
Lead/trial → student conversion is not race-safe. Concurrent requests can create
duplicate students.
**Fix:** DB-level uniqueness constraint on (orgId, parentPhone + childName) or
transaction with SELECT FOR UPDATE.

### 4.D Coach assignment consistency
`src/app/actions/batch.ts` validates coach via `User.orgId` only. Multi-org
coaches (via Membership) may be rejected incorrectly, and invalid coachIds may
be silently ignored.
**Fix:** validate against `OrgMembership` table.

### 4.F Trial booking atomicity
`src/app/actions/trial.ts` creates trial and lead records in separate statements.
**Fix:** wrap in `db.$transaction`.

### CSP in report-only mode
`next.config.ts` sends `Content-Security-Policy-Report-Only`. Reports accumulate
but nothing is enforced.
**Fix:** review the last 2 weeks of CSP reports, add any missing allowlist entries,
switch header name to `Content-Security-Policy` to enforce.

## Open — medium

### 4.J Deletion reliability
Bulk delete isn't transactional and audit records can be removed before the main
operation finishes.
**Fix:** audit evidence must survive the deleted entity; use a tombstone / anonymise
pattern instead of hard delete for anything with a financial trail.

### Row-level security
A migration enables RLS on some tables, but the actual DB role used by the app
and policy behaviour haven't been end-to-end verified. If the role has BYPASS
or policies are mis-targeted, RLS is theatre.
**Fix:** run cross-tenant test queries from the app role, document the policy
coverage matrix.

### `schema-ensure.ts` runtime DDL
`src/lib/schema-ensure.ts` runs `CREATE TABLE IF NOT EXISTS` at request time to
backfill tables added after launch. This is clever but has edge cases (race
conditions, bad migrations between orgs).
**Fix:** move to proper Prisma migrations with a deployment-time step.

## Not blocking — nice to have

- At-risk student threshold (60%, 10 sessions, 3 min) is hardcoded in SQL. Make
  it a per-org setting if any academy asks.
- Audit log coverage: not every sensitive write is logged yet (membership changes,
  permission grants, bulk operations).
- Payroll permissions: ensure only org owner (not any admin) can see individual
  salary numbers.
