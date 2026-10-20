# Triq — Production Deployment and Release Audit

**Audit date:** 2026-10-20 16:10 IST
**Auditor:** Claude Opus 4.7 (`claude.ai/code/session_01SHFsy2bnwW7XvrtnTNaszP`)
**Audit scope:** Deployment identity, routes, security, payments, DB, observability
**Audit methodology:** Read-only inspection + source code review + database schema check
**Audit limitations:** Live HTTP smoke tests, runtime log inspection, and Lighthouse
measurements were **not possible** from this environment (egress proxy blocks the
production domain; Vercel API scope is read-limited on this project; Lighthouse
is not installed). All findings labelled **"Verified in source"** come from
reading the repository; findings labelled **"Verified in DB"** come from direct
Supabase queries; nothing is marked "Verified in production" without
inspecting the live site.

---

## 1. Executive summary

- The deployed commit **matches** `main` HEAD (`dcef8f3`) — no stale deployment.
- CI typecheck is **in progress** on the latest commit (prior commit passed).
- 8 active organizations, 160 students, 285 paid fees, **0 online payments** on
  file. All collected fees are manual/offline — Razorpay integration code is
  shipped but has never been exercised in production.
- Several real correctness fixes were landed earlier today (fee toggle,
  status enums, at-risk analytics) from a separate strategy-doc audit — see
  `docs/known-issues.md`.
- **The highest-risk open items** are (1) in-memory rate limiter on a
  serverless deployment, (2) billing-plan vocabulary inconsistency across
  three systems, (3) missing PWA icon files referenced by `manifest.json`.
- One secondary Vercel project (`xplay`) has been failing on every push.
  Not currently serving `triqsports.vercel.app` or `sportsos-tau.vercel.app`
  so it is **not** affecting end users, but it should be investigated or deleted.

---

## 2. Production URL and deployment identity

| Field | Value |
|---|---|
| GitHub repo | `kartikeyatitu/Play` (origin only) |
| Default branch | `main` |
| HEAD at audit time | `dcef8f3` ("fix(critical): fee toggle, status enums, at-risk analytics") |
| Current working tree | **clean** — no uncommitted or unpushed changes |
| Vercel project (primary) | `sportsos` (bom1 region) |
| Vercel project (secondary) | `xplay` — purpose unknown, **failing on every push** |
| Primary production domain | `sportsos-tau.vercel.app` |
| Secondary domain (referenced in audit doc) | `triqsports.vercel.app` — **status not verified** from this environment |
| Expected framework | Next.js 15, React 19, TypeScript, Prisma, Supabase Postgres (ap-south-1) |
| vercel.json | buildCommand `prisma generate && next build`; cron on `/api/cron/monthly-fees` at `0 2 1 * *` |

### 2.1 Deployed commit vs repository commit

| Target | Commit |
|---|---|
| `main` HEAD | `dcef8f3` |
| sportsos latest production deployment | `dcef8f3` ✅ **match** |
| xplay latest production deployment | `dcef8f3` ❌ **failed to build** |

Latest 5 sportsos deployments all deployed successfully (`234e663`, `bd66655`,
`03c7cdb`, `775bc63`, `1415137`). xplay has been failing on every push for
days. The exact failure reason is **not accessible** from this audit — Vercel
API scope on `xplay` is denied.

**Severity:** P3 (xplay). Not blocking end users; needs owner-level inspection.

---

## 3. Public route smoke tests

**Not performed.** This environment's egress proxy refuses connections to
`*.vercel.app`. I cannot `curl` the production URL directly. However:

- The sportsos deployment status reported by Vercel is `success` for commit
  `dcef8f3`, so the application starts.
- One real signup landed on the system between 03:00 and 11:00 IST today
  ("JLN" academy) — proving `/register` and `/onboarding` work in production.
- `/org` was reported broken by the owner mid-session; root cause was a
  missing Supabase column (`country`); fixed by applying the globalisation
  migration. Last successful render confirmed by the owner's screenshots.

**Severity:** cannot classify. **Recommend:** owner runs `curl -I` manually
against the key routes and attaches results.

---

## 4. Branding and static asset findings

### 4.1 **P2 — Missing PWA icon files**
`public/manifest.json` references `/icon-192.png` and `/icon-512.png`, but
`public/` contains only `logo.jpg`, `manifest.json`, `sw.js`. When a user
tries to install the PWA on Android or iOS, the install prompt will show a
broken icon or fail silently.

**Evidence:**
```
public/
├── logo.jpg
├── manifest.json       (references /icon-192.png, /icon-512.png)
└── sw.js
```

**Fix:** generate 192x192 and 512x512 PNGs from `logo.jpg` and place them in
`/public`. One-time, ~10 min of work.

### 4.2 Theme and brand consistency — not inspected
Would require live rendering. Source code uses lime (`#a3e635`), emerald, and
orange (`#d1440a`) accents in various places. Owner should verify by eye.

---

## 5. Security and tenant isolation findings

### 5.1 Session cookie — ✅ correct
```
SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: NODE_ENV === "production",
  sameSite: "lax",
}
```
Cookie name is `sportsos_session`. Signed via `verifySignedCookie`. No
findings.

### 5.2 Cron auth — ✅ fail-closed
`/api/cron/monthly-fees` requires `Authorization: Bearer <CRON_SECRET>`. If
the env var is not set it **refuses to run** (returns 401), which is correct.

### 5.3 Razorpay webhook signature — ✅ verified
Three Razorpay webhook routes (`/api/webhooks/razorpay/route.ts`,
`/[orgId]/route.ts`, `/billing/route.ts`) all read `x-razorpay-signature` and
verify. Idempotency enforced via `Payment.providerOrderId` unique constraint.

### 5.4 WhatsApp webhook signature — ✅ verified
`verifySignature(secret, rawBody, header)` computes HMAC-SHA256 against the
app secret. Correct.

### 5.5 **P1 — Rate limiter is in-memory on serverless**
`src/lib/rate-limit.ts` uses a module-level `Map` with a comment:
> `// Simple in-memory rate limiter for serverless`
> `// Resets on cold start — good enough for MVP, use Redis/Upstash for production scale`

Each Vercel function instance has its own copy. Across concurrent cold starts
and warm instances the limit is **not shared**. OTP/login/trial-booking abuse
protection is effectively disabled under any real traffic.

**Impact:** attacker can enumerate phone numbers, spam OTP sends (costs
money once a real SMS provider is wired), brute-force trial booking.

**Fix:** switch to `@upstash/ratelimit` + Upstash Redis. Free tier handles
10K requests/day — fine for current scale.

**Severity:** P1 — real exposure, mitigated only by the fact that no OTP
provider is wired up yet (so OTP spam is harmless cost-wise).

### 5.6 **P1 — CSP is report-only**
`next.config.ts` emits `Content-Security-Policy-Report-Only` not
`Content-Security-Policy`. Violations are logged (if a report-URI is
configured) but nothing is actually blocked.

**Fix:** review the last two weeks of CSP reports, add any missing allow-list
entries, switch to enforcing header. See `docs/known-issues.md` for details.

### 5.7 Row-level security — not verified end-to-end
Prisma migrations include `enable_rls_on_exposed_tables.sql`, but the
specific DB role used by the application and its policy coverage was NOT
tested in this audit. RLS could be bypassed if the role has BYPASS or if
policies are mis-targeted.

**Recommend:** run cross-tenant test queries from the app role, document
policy coverage per table.

### 5.8 Tenant scoping in actions — mostly correct
Spot-check of `src/app/actions/` shows most actions use `requireAuth` +
`session.orgId` + explicit `where: { orgId: session.orgId, ... }` scoping.
No cross-tenant queries found in the sampled files. Full coverage not
verified.

---

## 6. Payment and data integrity findings

### 6.1 ✅ Just-fixed: Fee toggle is now safe
Earlier today in commit `dcef8f3`:
- Replaced bidirectional `toggleFeeStatus` with explicit `markFeeAsPaid`
  (idempotent) and `reverseFeePayment(reason)` (audited, refuses to flip
  reconciled online payments).
- Fixed pre-existing bug in `BulkActions.tsx` that passed `(fee.id, "PAID")`
  to `toggleFeeStatus(studentId, month)` — the server silently rejected every
  call. The bulk "mark paid" button has been doing nothing for weeks.

### 6.2 ✅ Just-fixed: Lead and trial status enum validation
`updateLeadStatus` and `updateTrialStatus` now reject anything outside the
canonical `LEAD_STATUSES` / `TRIAL_STATUSES` lists.

### 6.3 ✅ Just-fixed: At-risk analytics placeholder
`atRiskStudents: []` hardcoded placeholder replaced with a real Postgres
query (last ≤ 10 sessions, < 60% attendance, ≥ 3 sessions on record).

### 6.4 **P1 — Billing plan vocabulary mismatch across 3 systems**
Three independent plan vocabularies in use, verified in source:

| File | Plan values used |
|---|---|
| `src/lib/pricing.ts` | `FREE_PLAN.id = "free"`, `GROWTH_PLAN`, `ACADEMY_PLAN` |
| `src/app/actions/onboarding.ts` | writes `plan: "FREE_TRIAL"` on new Organization |
| `src/app/actions/register-academy.ts` | writes `plan: "FREE_TRIAL"` on new Organization |
| `src/lib/billing-service.ts` | reads/writes `"FREE" \| "STARTER" \| "PRO" \| "ENTERPRISE"` on Subscription |

These three systems can produce entitlement decisions that disagree with each
other — a Free user could get PRO features or vice versa.

**Fix:** define one canonical `PlanId` type in `pricing.ts` and migrate all
three to use it. Needs a careful data migration for existing
`Organization.plan` rows (8 orgs today, all "FREE_TRIAL").

### 6.5 **P2 — No end-to-end payment flow has ever run in production**
Verified in DB: `SELECT COUNT(*) FROM "Payment" WHERE status = 'PAID'` → **0**.
Every one of the 285 "paid" fees was marked paid manually by an admin (status
flip in `FeeRecord`, no `Payment` row). Razorpay integration is code-complete
but has never processed a real transaction.

**Why it matters:** webhook signature verification, idempotency, and
reconciliation code paths have never been tested with real Razorpay data in
production. The first real payment is likely to hit edge cases.

**Fix:** run one small test transaction (₹1) through Razorpay in production
to prove the end-to-end flow. Owner can do this with their own card.

### 6.6 Prisma uniqueness constraints — ✅ generally correct
Reviewed:
- `Payment.providerOrderId` is `@unique` (prevents double-processing a Razorpay webhook)
- `Receipt.receiptNumber` and `Receipt.token` are `@unique`
- `Receipt.feeRecordId` is `@unique` (one receipt per fee)
- `BatchEnrollment` has `@@unique([batchId, studentId])` (no double-enrol)
- `Attendance` has `@@unique([sessionId, studentId])` (no double-mark)
- `Session` has `@@unique([batchId, date])` (no two sessions same day)

### 6.7 Carryover items from `docs/known-issues.md`
Audit flags not yet addressed (also in that doc):
- **4.A Student enrolment integrity** — update can delete enrolments before
  validating new batch
- **4.C Duplicate conversions** — lead/trial → student not race-safe
- **4.D Coach assignment** — validates via `User.orgId` only, not multi-org Memberships
- **4.F Trial booking atomicity** — trial and lead created in separate statements
- **4.J Deletion reliability** — bulk delete not transactional

---

## 7. Database and migration safety

### 7.1 Supabase project
- **Primary (triq):** `tfekmfumwsnxcddixlxm` (ap-south-1, PostgreSQL 17.11, ACTIVE_HEALTHY)
- **Dormant (Sportos):** `oxhhdtzkusjqdvuyitkf` (ap-northeast-1, PostgreSQL 17.11, ACTIVE_HEALTHY, 4 orgs, last activity Oct 11)

### 7.2 Schema state (verified today)
Globalisation + photos columns verified live on primary DB:
- `country` TEXT NOT NULL DEFAULT 'IN'
- `currency` TEXT NOT NULL DEFAULT 'INR'
- `timezone` TEXT NOT NULL DEFAULT 'Asia/Kolkata'
- `locale` TEXT NOT NULL DEFAULT 'en-IN'
- `phoneCountry` TEXT NOT NULL DEFAULT '91'
- `photos` TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]

All 8 orgs backfilled with India defaults.

### 7.3 **P2 — Runtime schema creation (`schema-ensure.ts`)**
`src/lib/schema-ensure.ts` runs CREATE TABLE IF NOT EXISTS at request time
to backfill tables added after launch. Clever as a stopgap but has race
conditions and makes migrations non-deterministic.

**Fix:** move to proper Prisma migrations with a deployment-time step.

### 7.4 Secondary DB (`Sportos`) — schema drift
The `Sportos` DB (dormant) is **missing** the globalisation and photos
columns. Any application pointing at it would crash on `/org`. Primary
production is NOT using it, so this is a dormant-cleanup task.

**Severity:** P3 — only matters if someone accidentally points a deployment
at the wrong DB.

### 7.5 Indexes
Prisma schema has `@@index` directives for high-traffic tenant-scoped
queries (e.g. `Payment [orgId, status]`, `Attendance [studentId]`). Not
exhaustively audited for coverage.

---

## 8. Observability

### 8.1 Runtime error inspection — **not possible from this audit**
My Vercel MCP permissions are read-restricted on `sportsos`; `get_runtime_errors`
and build log inspection return 404. Owner must inspect from the Vercel
dashboard directly.

### 8.2 Code-level observability
- Sentry is wired in `next.config.ts` via `withSentryConfig` — only active if
  `NEXT_PUBLIC_SENTRY_DSN` is set
- PostHog mentioned in CSP config — only active if `NEXT_PUBLIC_POSTHOG_KEY` is set
- Server actions use `console.log` / `console.error` — captured by Vercel logs
- Audit logging is partial (`AuditLog` model exists; not every sensitive write
  is logged — see `docs/known-issues.md`)

### 8.3 Known failures observed in this audit
- `xplay` production deploys fail on every push — build logs inaccessible
- Rate limiter log noise: in-memory map doesn't trigger alerts even when
  under abuse

---

## 9. Performance and SEO

### 9.1 Not measured
No Lighthouse runs performed (not installed, cannot reach production from
this environment).

### 9.2 Static review — SEO setup is good
- `src/app/sitemap.ts` present (4.3 KB, generated at build)
- `src/app/robots.ts` present (522 B)
- `src/app/opengraph-image.tsx` dynamically generates OG card (gradient
  background + "TRIQ" branding + plan info)
- Metadata on key pages uses `generateMetadata` with proper title/description/OG
- `next.config.ts` enables AVIF/WebP image formats via Next Image optimizer

### 9.3 Potentially slow spots noticed in source
- No `revalidate` or `cache` directives on heavy admin pages — every request
  hits the DB from scratch. Acceptable at 8 orgs, will become a cost at 1000+.
- `getAutoReminders()` and similar wide queries pull from several tables with
  `include` — could be slow on larger academies (not yet exercised).

---

## 10. Evidence, timestamps, test commands

All timestamps are 2026-10-20 IST unless noted.

```
# Repository state
git rev-parse HEAD                                       → dcef8f3...
git status --short --branch                              → clean, in sync with origin/main

# Deployment identity (via GitHub + Vercel MCP)
gh api repos/kartikeyatitu/Play/deployments              → latest sportsos sha matches HEAD
                                                           latest xplay sha matches HEAD but build failed

# CI
gh api repos/kartikeyatitu/Play/commits/dcef8f3/check-runs  → typecheck in_progress at audit time
                                                              (previous commits all passed)

# DB counts
SELECT COUNT(*) FROM "Organization" WHERE "isActive" = true;    → 8
SELECT COUNT(*) FROM "User";                                    → 153
SELECT COUNT(*) FROM "Student";                                 → 160
SELECT COUNT(*) FROM "FeeRecord" WHERE status = 'PAID';         → 285
SELECT COUNT(*) FROM "FeeRecord" WHERE status = 'PENDING';      → 53
SELECT COUNT(*) FROM "Payment"   WHERE status = 'PAID';         → 0

# Schema state verified
SELECT column_name, data_type, column_default
FROM information_schema.columns WHERE table_name = 'Organization'
                                 AND column_name IN (...);      → all 6 new columns present

# Public asset listing
ls public/                                                       → logo.jpg, manifest.json, sw.js
                                                                   (missing icon-192.png, icon-512.png)
```

---

## 11. Severity-ranked issue list

### P0 — confirmed critical exposure, data loss, or outage
**None confirmed.**

### P1 — major security, payment, or tenant-isolation issue
1. **5.5** In-memory rate limiter on serverless — abuse protection effectively absent
2. **5.6** CSP in report-only mode — enforcement promised, not delivered
3. **6.4** Billing plan vocabulary mismatch — entitlement checks can disagree

### P2 — significant functional, reliability, or user-experience issue
4. **4.1** Missing PWA icon files (`/icon-192.png`, `/icon-512.png`) referenced by manifest
5. **6.5** No end-to-end payment has ever run — Razorpay reconciliation untested in prod
6. **7.3** Runtime schema creation (`schema-ensure.ts`) — race-condition surface

### P3 — polish, optimisation, lower impact
7. **2.1** `xplay` secondary project failing on every push — owner should delete or fix
8. **5.7** RLS policy coverage not end-to-end verified
9. **7.4** Dormant Sportos DB missing migrations — cleanup
10. **9.3** No cache/revalidate hints on heavy admin pages — acceptable at current scale

### Also from `docs/known-issues.md` (not re-ranked here):
Student enrolment integrity, duplicate lead/trial conversions, coach
assignment via wrong table, trial booking atomicity, deletion reliability.

---

## 12. Fix plan with owners and dependencies

| # | Issue | Severity | Owner | Depends on | Estimated effort |
|---|---|---|---|---|---|
| 1 | **Rate limiter → Upstash Redis** | P1 | engineering | Upstash account | 2 hours |
| 2 | **CSP enforce** (after reviewing reports) | P1 | engineering | last 14-day CSP reports | 4 hours |
| 3 | **Billing plan reconciliation** | P1 | engineering | data migration plan for 8 orgs | 1 day |
| 4 | **PWA icons** (192 + 512) | P2 | design | logo.jpg available | 30 min |
| 5 | **₹1 end-to-end payment test** | P2 | owner | Razorpay live key configured | 30 min |
| 6 | **Replace `schema-ensure.ts`** | P2 | engineering | all backfills traced | 1 day |
| 7 | **xplay cleanup** | P3 | owner | — | 15 min |
| 8 | **RLS end-to-end verify** | P3 | engineering | app-role credentials | 2 hours |

---

## 13. Verification plan for each fix

| Fix | How to verify |
|---|---|
| Rate limiter | 110 rapid logins to the same account should see 100 pass + 10 blocked, consistent across cold-start simulations |
| CSP enforce | Browser DevTools shows no CSP violations on `/`, `/org`, `/academy/*`, `/parent` after deploy |
| Billing plan | Migration script output lists before/after plan values for all 8 orgs; entitlement helpers return consistent plan name across all 3 files |
| PWA icons | `curl -I https://sportsos-tau.vercel.app/icon-192.png` returns 200; Lighthouse PWA audit passes |
| ₹1 payment | A row appears in `Payment` with `providerPaymentId` set and `status = 'PAID'`; a matching `Receipt` is generated |
| schema-ensure | `grep -r "ensureTeamSchema\|schema-ensure" src/` returns zero references; app boots cleanly on an empty DB with only Prisma-run migrations |
| xplay | Project either deletes cleanly OR latest deploy shows "success" |
| RLS | `psql` as app role: `SELECT * FROM "Student"` without an org filter returns 0 rows (or rejects) |

---

## 14. Areas that could NOT be verified from this audit

- Live HTTP responses from any `*.vercel.app` route (egress proxy blocks)
- Vercel runtime logs, build logs, function timing metrics (API scope denied)
- Lighthouse / Core Web Vitals scores
- Actual CSP violation reports (would need Sentry/report-URI configured)
- End-to-end payment flow with a real card
- RLS behaviour under a non-superuser role
- Email deliverability / WhatsApp Business API deliverability
- Browser compatibility on real Android / iOS devices
- `triqsports.vercel.app` deployment identity — I only verified `sportsos-tau.vercel.app`

For any of these, the owner (or a session with broader permissions) must
reproduce the check and record the result in a follow-up pass.

---

**End of audit.**
