# TRIQ Shared Platform

Capabilities built once and reused by all 11 verticals. Each vertical keeps its own business rules; this layer supplies identity, time, money, search, notifications, trust, reporting, integrations and the AI-ready function layer.

Status legend: **Complete** · **Partial** · **Mocked** · **Broken** · **Missing**. Verified against `main` on 2026-10-26.

## 1. Identity and permissions

| Capability | Status | Where | Gap / next step |
|---|---|---|---|
| Account + session (signed cookie, HMAC) | Complete | `src/lib/auth.ts` (lazy `sessionSecret()`), `src/app/actions/auth.ts`, `login-links.ts` | Preview env needs its own `HMAC_SECRET` |
| Phone OTP login | Partial | `src/lib/msg91.ts` | MSG91 not configured in production; WhatsApp login-link fallback in use |
| Organisation membership | Partial | `OrgMembership` (`role`, `permissions` JSON overrides), `src/lib/membership.ts` | `User.orgId` is single and `User.phone` unique → a parent cannot belong to two academies. Needs a person/membership split (additive: memberships become the source of truth, `User.orgId` = active org) |
| Role/permission checks | Partial | `checkPermission`, `requirePermission`, `hasPermission`; keys in `src/lib/team.ts` | `checkPermission` only admits ADMIN app role; coach/physio/seller/verifier paths need explicit checks. New permission keys per vertical: `community.moderate`, `health.view`, `health.manage`, `store.manage`, `careers.manage`, `verify.credentials`, `competition.manage`, `sponsorship.manage` |
| Active organisation context | Partial | session `orgId` | Org switcher needed once multi-membership lands |
| Account recovery | Partial | login links via WhatsApp/SMS | No email recovery; no device/session list |
| Guardian relationships | Partial | `Student.parentId` (one guardian) | `Guardian` link table (many guardians per athlete, consent flags) — needed by Athlete, Education, Wellness |
| Public vs private visibility | Partial | public routes `/c/[coachId]`, `/join`, directory | One `visibility` enum (PRIVATE / ORG / PUBLIC) per profile entity; minors never PUBLIC beyond first name + last initial with consent |

## 2. Scheduling and availability

| Capability | Status | Where | Gap |
|---|---|---|---|
| Timezone-aware dates | Complete | `src/lib/i18n.ts` (`orgToday`, `formatDate`), `src/lib/currency.ts` (`getOrgDateString`) | Store instants in UTC, render in org timezone — enforce in new code |
| Sessions & batches | Complete | `Batch`, `Session`, `auto-sessions.ts` | — |
| Holidays | Complete | `Holiday`, `holidays.ts` | — |
| Booking conflict validation | Complete (venues) | `TurfBooking` + DB exclusion constraint (btree_gist) in prod; `src/lib/turf-engine.ts` | Reuse the same pattern for wellness appointments and facility allocation |
| Cancellation/reschedule rules | Missing | — | Pure policy functions in `src/lib/policy.ts` shared by Spaces, Wellness, Play |
| Unified calendar | Missing | — | Read model merging sessions, trials, bookings, fixtures, appointments per org/user |

## 3. Payments and financial infrastructure

| Capability | Status | Where | Gap |
|---|---|---|---|
| Fee records + receipts | Complete | `FeeRecord`, `Receipt`, `receipt-service.ts` | — |
| Payment method provenance | Complete | `FeeRecord.paymentMethod` (`OFFLINE_RECORDED`, `PARENT_REPORTED_UPI`, `ADMIN_CONFIRMED_UPI`, `ONLINE_VERIFIED`), `src/lib/payment-method.ts` | — |
| Gateway payments | Partial | Razorpay (per-org connect), `Payment` (amount in minor units), webhooks `src/app/api/webhooks/razorpay`, `stripe` | Only fees + turf advances; no generic "payable" abstraction for store orders, registrations, appointments |
| Idempotency | Partial | webhook dedupe by provider id; `@@unique([studentId, month])` on fee generation | Generic idempotency key on all money-moving actions |
| Refunds / reconciliation | Missing | `reverseFeePayment` only | Refund records with provider reference, reconciliation report |
| Monetary precision | Partial | Mixed: `Float` (FeeRecord.amount, Expense), `Int` rupees (turf), `Int` minor units (Payment) | New tables use `Int` minor units + `currency`; migrate floats later (not additive — needs approval) |
| Financial audit + scoped reporting | Partial | `AuditLog`, `payroll.ts` P&L | Sponsorship income and store revenue must enter P&L once |

## 4. Search and discovery

| Capability | Status | Where | Gap |
|---|---|---|---|
| Academy directory | Partial | `ListedAcademy`, `directory.ts`, `cities.ts` | Gated by `marketplace` flag |
| Pagination helper | Complete | `src/lib/pagination.ts` | — |
| Sport/location filters | Partial | per-screen | One `searchListings({ kind, sport, city, q, cursor })` contract reused by Spaces, Careers, Wellness, Creators, Commerce, Brand Studio |
| Visibility rules in search | Missing | — | Search must apply the visibility enum + minor rules server-side |

## 5. Notifications

| Capability | Status | Where | Gap |
|---|---|---|---|
| In-app | Partial | `Message` rows; `notifications.ts` reads last 24h | No `Notification` table, no read state, no preferences |
| WhatsApp | Partial | `src/lib/whatsapp.ts` (Cloud API templates + deep links), webhook | Template sending needs approved templates per use |
| Email | Missing | — | Provider choice pending |
| Delivery status, retry, dedupe | Missing | — | `Notification` + `NotificationDelivery(channel, status, attempts, dedupeKey)` |

## 6. Verification and trust

- Submitted / reviewed / verified distinction: **Missing** platform-wide. Standard fields for every verifiable claim (achievement, credential, certification, provider licence): `verificationStatus` (SUBMITTED, UNDER_REVIEW, VERIFIED, REJECTED), `verifiedById`, `verifiedAt`, `evidenceUrl`. Only holders of `verify.credentials` may set VERIFIED; always audited.
- Coach verification today: **Partial**, academy-set and unaudited (`coach-verification.ts`).
- Moderation / reporting: **Missing**. One `ContentReport(targetType, targetId, reason, status)` used by Communities, Creators, Commerce reviews.
- Audit trail: **Complete** base (`AuditLog`, `src/app/actions/audit.ts`); coverage incomplete (bookings, medical edits).
- Abuse prevention: **Partial** — `rateLimitDb` (`RateLimit` table).
- Guardian consent: **Missing** — see Guardian table above.

## 7. Analytics and reporting

- Org dashboards and reports: **Partial** (`analytics.ts`, `reports.ts`, `payroll.ts`). "AI Insights" are fixed formulas — must be labelled as such.
- Metric definitions: **Missing** — to be documented in `docs/ARCHITECTURE.md#metrics` (attendance rate, utilisation, outstanding, MRR).
- Exports: **Partial** (`export.ts`) — require `reports.export` permission and an audit entry per export.
- Rule: reports show only recorded data; no estimated or filler numbers.

## 8. Integration foundation

- Webhooks in: Razorpay, Stripe, WhatsApp — signature validation present (Razorpay verified).
- Secrets: per-org gateway keys encrypted with `src/lib/secret-box.ts`.
- Outbound webhooks / public API: **Missing** — Enterprise vertical. Design: `ApiKey(orgId, hashedKey, scopes)`, `WebhookEndpoint(orgId, url, secret, events)`, `WebhookDelivery` with HMAC signature and retry.
- Integration logs must never contain secrets or full payloads with PII.

## 9. Future AI foundation (no voice)

- Business logic in server actions with explicit permission checks and Zod-style validation (`src/lib/validations.ts`) — these become assistant tools later.
- Every consequential action audited; anything that sends messages, moves money or changes records needs human confirmation when invoked by an assistant.
- No AI provider integrated yet; provider, region and cost cap are founder decisions.

## 10. Feature flags

`src/lib/features.ts` — `flag(NAME, fallback)` reads `NEXT_PUBLIC_FEATURE_<NAME>`. New verticals default **off**; turned on per environment in Vercel once the migration they need is applied and the flow is verified.

## 11. Acceptance criteria for the shared layer

1. A person can hold memberships in two organisations and switch between them without data leaking across tenants.
2. Every new table carries `orgId` (or is explicitly global), is in the deletion order in `src/app/actions/delete.ts`, and has RLS enabled (deny-by-default; app uses the service connection).
3. Every money-moving action is idempotent and audited.
4. Every verifiable claim shows its verification status and who verified it.
5. Notifications are deduplicated and record delivery status.

## 12. Open decisions

OTP/SMS and email providers; multi-academy parents in v1; public display rules for minors; AI provider and cost cap; currency migration of float amounts.
