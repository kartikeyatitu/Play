# Sprint 1 — Reliability Lockdown

**Branch:** `codex/triq-reliability-and-vertical-roadmap`
**Owner:** Kartikeya (direction) + Claude Opus 4.7 (execution)
**Reference plan:** §11 Phase 1, §12 workflow, §19 safety rules
**Goal:** close every remaining P0/P1 correctness gap on the Academy OS so it is commercially reliable, before any new vertical (gym, events, play, creator…) starts.
**Exit gate (per §11 Phase 1):** "Pilot academies can complete their main daily workflows reliably."

## In scope

| # | Task | Audit ref | Who unblocks | Code effort |
|---|---|---|---|---|
| 1 | **Billing plan vocabulary reconciliation** | §4.H | — (solo) | ~3 hrs |
| 2 | **Duplicate conversion prevention** (lead/trial → student) | §4.C | — (solo) | ~2 hrs |
| 3 | **Regression tests** for the correctness fixes already shipped (fee toggle, enrolment, trial atomicity, coach membership, at-risk query) | §12 step 5 | — (solo) | ~4 hrs |
| 4 | **OrgLocale React context** so deep components (CheckoutModal, FeeKhataSheet, StaffHome, etc.) stop hardcoding `en-IN` / `Asia/Kolkata` | §6 (partial), §8 UI | — (solo) | ~3 hrs |
| 5 | **Rate limiter → Upstash Redis** | §G | **Kartikeya** must create Upstash account + add 2 env vars | ~2 hrs code |
| 6 | **CSP enforce** (switch header from report-only after reviewing 14-day CSP reports) | §CSP | **Kartikeya** must open CSP report dashboard | ~4 hrs code |
| 7 | **₹1 real payment test** through Razorpay to verify webhook signature + idempotency + reconciliation path | §4.1 | **Kartikeya** must run a card | 0 hrs code |
| 8 | **RLS end-to-end verification** against the actual app DB role | §5.7 | **Kartikeya** must share app-role creds OR confirm via `psql` | ~2 hrs |

## Out of scope (explicitly)

Nothing from §4.2 (Gym) through §4.14 (Intelligence) is in Sprint 1. The plan is unambiguous: no new vertical until Phase 1 exits.

## Discipline

Per §12 step 3 & §19 safety rules:
- All work on this branch, never `main`.
- No deploy to production during the sprint — Vercel auto-deploy from `main` only.
- No pricing changes without founder approval.
- No new third-party integrations without founder approval.
- Each task = one PR = one review = one merge decision.
- Tests MUST accompany every correctness fix.
- Report honestly: what passed, what failed, what wasn't verified.

## Acceptance criteria per task

### Task 1: Billing plan vocabulary
- Single `PlanId` type exported from `pricing.ts`
- `onboarding.ts`, `register-academy.ts`, `billing-service.ts` all import and use it
- DB migration documented for existing `"FREE_TRIAL"` rows (not executed — awaits founder decision)
- Entitlement helper has one source of truth, same answer regardless of caller

### Task 2: Duplicate conversions
- `convertTrialToStudent` and `convertLeadToStudent` are atomic (`db.$transaction`)
- Add index/uniqueness strategy: `(orgId, parentPhone, studentName)` or equivalent, documented
- Second simultaneous call returns the first conversion's result instead of creating a duplicate

### Task 3: Regression tests
- Playwright E2E for: fee toggle safety (no accidental reversal), enrolment integrity, trial booking atomicity
- Unit tests for: at-risk SQL query shape, lead/trial enum validation, coach membership helper
- All tests pass locally + on CI

### Task 4: OrgLocale context
- Server layouts fetch org locale once per request
- `useOrgLocale()` hook returns the five fields
- `formatMoney()`, `formatDate()`, `formatTime()` in i18n.ts become locale-aware per call
- All known `.toLocaleString("en-IN")` usages replaced in high-traffic components

### Task 5: Rate limiter
- `src/lib/rate-limit.ts` uses `@upstash/ratelimit` with Redis
- Falls back to in-memory in dev when env vars absent (loud warning)
- Login + trial + OTP endpoints share limits across concurrent instances

### Task 6: CSP enforce
- Review last 14 days of CSP reports
- Allowlist additions documented and justified
- Header renamed `Content-Security-Policy` (enforcing)
- Browser DevTools shows zero violations on `/`, `/org`, `/coach`, `/parent`, `/academy/[slug]`

### Task 7: ₹1 payment test
- One real transaction visible in `Payment` table with `status = 'PAID'` and `providerPaymentId` set
- `Receipt` row generated and downloadable
- Webhook delivery deduplicated (test with manual replay)

### Task 8: RLS verification
- Cross-tenant SELECT from app role returns 0 rows (or rejects)
- Policy coverage matrix per table documented
- One table intentionally missing a policy to confirm the test catches it, then policy added

## Timeline

If the founder clears the Vercel invoice today:
- Day 1 (today): Task 1 — billing plan reconciliation
- Day 2: Task 2 — duplicate conversions + Task 3 start
- Day 3: Task 3 finish — regression tests
- Day 4: Task 4 — OrgLocale context
- Day 5–7: Tasks 5–8 as the founder unblocks each

PR open after each task. Merge to `main` only after review.

## Risks

- **Billing plan migration is destructive if run wrong** → migration documented but NOT executed; needs founder approval and backup verification before any production SQL
- **CSP enforcement can take down the site** if an allowlist entry is wrong → ship enforce header behind a 1-day canary (preview deploy only)
- **Vercel invoice unpaid** → nothing in this sprint reaches prod regardless; branch work only
- **Upstash free tier limits (10K req/day)** → sufficient for current scale (8 orgs); monitor as org count grows

## Non-decisions this sprint will NOT make

Per plan §19: no pricing changes, no deletion of existing customer records, no change to Razorpay merchant account, no change to Supabase project, no logo or brand palette redesign (§8 is explicit about auditing before changing).
