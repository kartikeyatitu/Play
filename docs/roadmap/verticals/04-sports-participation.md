# Vertical 4 — Sports participation

Status: PLAN ONLY. Nothing here is applied. Written 2026-10-25 against branch `feat/academy-os-branches`.

## 1. Goal

Turn interest into regular play. A parent (or adult player) who finds an academy — via the directory,
the academy page, a coach link or a WhatsApp share — should be able to request a trial, get a confirmed
slot, attend, and enrol (or join a waitlist that actually moves), with the academy seeing one clean
funnel per source. v1 is about making the existing trial → enrol → waitlist path correct, attributable
and capacity-aware, not about new consumer products.

## 2. Verified today

| Capability | Evidence | Status |
|---|---|---|
| Public trial request | `src/app/trial/page.tsx` + `TrialClient.tsx`; `bookTrial` in `src/app/actions/trial.ts` creates `TrialBooking` + `Lead(status TRIAL_BOOKED, source WEBSITE)` in one `db.$transaction`; org resolved from batch, never client | working |
| Trial rate limiting | `bookTrial` uses in-memory `rateLimit` (resets on cold start — see comment in `prisma/schema.prisma` `RateLimit` model); directory uses DB-backed `rateLimitDb` | partial |
| Trial status vocabulary | DB default `"PENDING"` (`TrialBooking.status`); `TrialManager.tsx` sends `CONFIRMED` / `COMPLETED` / `NO_SHOW`; `updateTrialStatus` (`src/app/actions/trial-convert.ts`) only accepts `TRIAL_STATUSES` = SCHEDULED, ATTENDED, NO_SHOW, ENROLLED, DECLINED, CANCELLED (`src/lib/enums.ts`). By reading the code, **Confirm and Mark Done throw "Invalid trial status"**; `recordTrialOutcome` (`coach-session.ts`) writes `COMPLETED`, outside the enum. Not reproduced at runtime | partial (broken path) |
| Trial → student | `convertTrialToStudent` (`trial-convert.ts`, `requirePermission("students.manage")`), locks via `updateMany where status != ENROLLED` inside a transaction | working |
| Coach records trial outcome | `recordTrialOutcome` in `src/app/actions/coach-session.ts` updates trial + matching lead notes | working |
| Tenant scoping of trials | `TrialBooking` has **no `orgId`**; scoped via `batch: { orgId }` in queries | partial |
| Self-registration | `/join` → `registerParent` in `src/app/join/actions.ts`: slug required, batch must be same org, **capacity check** on `Batch.capacity`, in-memory rate limit, DOB age 2–70 (adults allowed) | working |
| Add another child (parent app) | `enrollAdditionalChild` in `src/app/actions/enroll-child.ts`: tenant-scoped batch, **no capacity check, no transaction, no audit** | partial |
| Waitlist | `src/app/actions/waitlist.ts` (`checkPermission("students.manage")`): add, set WAITING/NOTIFIED/ENROLLED; ENROLLED creates parent+student+enrollment without a transaction and without capacity check; no public "join waitlist" | partial |
| Waitlist UI | `src/components/org/WaitlistManager.tsx`, mounted in batches tab (`AdminClient.tsx` line 485) | working |
| Directory enquiries | `src/app/academies/actions.ts` `requestTrial` → `DirectoryLead`, mirrored into `Lead` for claimed academies (`source: "WEBSITE"`) | working |
| Academy public page | `src/app/academy/[slug]/page.tsx` links to `/trial?academy=` and `/join?academy=` | working |
| Coach page CTA | `/c/[coachId]` links to `/trial?academy=&batch=` | working |
| Source attribution | `Lead.source` values WALK_IN/WEBSITE/REFERRAL/…; trial page, directory and coach page all write `WEBSITE` — channel lost; `TrialBooking` has no source | missing |
| Trial slot capacity | `bookTrial` accepts any date; no per-session trial cap, no check against `Session` status or `Holiday` | missing |
| Funnel reporting | `Lead` has statuses; no funnel view by source found (`src/app/actions/reports.ts` not reviewed in detail) | unverified |
| Known issues | `docs/known-issues.md` 4.C (duplicate conversions), 4.F (trial atomicity — `bookTrial` now uses a transaction, so 4.F looks fixed in code) | partial |

## 3. Gaps for a real v1

1. Fix the trial status mismatch so admin Confirm / Mark Done work and coach outcomes stay in vocabulary.
2. Add `orgId` and `source` to `TrialBooking`; link it to its `Lead`.
3. Capacity-aware enrolment everywhere (`enrollAdditionalChild`, waitlist ENROLLED, trial convert) using one pure helper.
4. Waitlist that moves: when a seat frees, the next WAITING entry is offered (NOTIFIED with an expiry) — manual send via WhatsApp link, no auto-messaging in v1.
5. Public "Batch full — join waitlist" instead of a dead end on `/join`.
6. Trial date must land on a day the batch runs (`scheduleRunsOn` in `src/lib/fees.ts`) and not on a `Holiday`.
7. Move public rate limits on `/trial` and `/join` to `rateLimitDb`.
8. Funnel counts by source: enquiries → trials → attended → enrolled.

## 4. v1 scope

**In**: status vocabulary fix; TrialBooking `orgId`/`source`/`leadId`; capacity helper + enforcement; waitlist offers with expiry and public waitlist join; trial date validation; DB rate limits; funnel card on leads tab.

**Out**: online-paid trials, adult pay-and-play / drop-in sessions (venues V5 covers hourly courts), automatic WhatsApp sends, parent self-service rescheduling, cross-academy "find a batch" search (directory is V-marketplace), multi-sport participant profile (Athlete OS).

## 5. Data model

Reuse `TrialBooking`, `Waitlist`, `Lead`, `Batch.capacity`, `BatchEnrollment`, `AuditLog`. No new tables.

```prisma
model TrialBooking {
  // ...existing fields unchanged...
  orgId  String? // backfilled from batch.orgId; written on every new trial
  source String? // ACADEMY_PAGE | COACH_PAGE | DIRECTORY | JOIN_FULL | WALK_IN | OTHER
  leadId String? // the Lead row created with it
  @@index([orgId, status])
}

model Waitlist {
  // ...existing fields unchanged...
  source         String?   // ADMIN | PUBLIC_JOIN
  notifiedAt     DateTime?
  offerExpiresAt DateTime?
  @@index([batchId, status, createdAt])
}
```

```sql
-- prisma/sql/2026-11-XX_participation.sql
-- Additive only. NOT APPLIED. Requires founder approval.
ALTER TABLE "TrialBooking" ADD COLUMN IF NOT EXISTS "orgId"  TEXT REFERENCES "Organization"("id") ON DELETE CASCADE;
ALTER TABLE "TrialBooking" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "TrialBooking" ADD COLUMN IF NOT EXISTS "leadId" TEXT REFERENCES "Lead"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "TrialBooking_orgId_status_idx" ON "TrialBooking"("orgId", "status");
-- Backfill (idempotent):
UPDATE "TrialBooking" t SET "orgId" = b."orgId" FROM "Batch" b WHERE t."batchId" = b."id" AND t."orgId" IS NULL;

ALTER TABLE "Waitlist" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "Waitlist" ADD COLUMN IF NOT EXISTS "notifiedAt" TIMESTAMP(3);
ALTER TABLE "Waitlist" ADD COLUMN IF NOT EXISTS "offerExpiresAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Waitlist_batchId_status_createdAt_idx" ON "Waitlist"("batchId", "status", "createdAt");

-- Existing tables not listed in 2026-10-14_enable_rls_on_exposed_tables.sql; verify state first:
ALTER TABLE "TrialBooking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Waitlist"     ENABLE ROW LEVEL SECURITY;
```

Status values stay strings. Legacy trial statuses (`PENDING`, `CONFIRMED`, `COMPLETED`) are mapped
at read time by a pure `normalizeTrialStatus()` rather than rewritten (see §9 Q1).

## 6. Build slices

**S1 — Trial status fix (no schema, bug fix; ship without flag).**
- Objective: one vocabulary end-to-end.
- Files: `src/lib/trial-status.ts` (`normalizeTrialStatus(legacy)`: PENDING/CONFIRMED→SCHEDULED, COMPLETED→ATTENDED; `nextActions(status)`), `src/lib/__tests__/trial-status.test.ts`, `src/components/org/TrialManager.tsx` (send SCHEDULED/ATTENDED/NO_SHOW, render via normalize), `src/app/actions/coach-session.ts` (`recordTrialOutcome` writes ATTENDED).
- Permission/tenant: unchanged (`leads.manage`, `batch.orgId`).
- Audit: add `TRIAL_STATUS_CHANGED` {trialId, from, to} in `updateTrialStatus`.
- Tests: every legacy value maps into `TRIAL_STATUSES`; existing `status-enums.test.ts` still passes.
- Acceptance: Confirm / Mark done / No-show all succeed; Convert button still works on ATTENDED.

**S2 — Capacity helper + enforcement.**
- Objective: no path over-fills a batch.
- Files: `src/lib/capacity.ts` (`seatsLeft(capacity, enrolled)`, `canEnroll`), test; use in `enroll-child.ts`, `waitlist.ts` (ENROLLED), `trial-convert.ts`, `join/actions.ts` (replace inline check). Wrap `enrollAdditionalChild` and waitlist ENROLLED in `db.$transaction` with a count re-check.
- Permission/tenant: unchanged; batch always fetched with `orgId`.
- Audit: `ENROLL_BLOCKED_FULL` (admin paths only), `WAITLIST_ENROLLED`.
- Acceptance: with capacity N and N enrolled, every path returns "Batch is full" (admin may override with explicit `force` + audit `ENROLL_OVER_CAPACITY`).

**S3 — Schema + attribution (flag `participation`).**
- Objective: TrialBooking `orgId/source/leadId`; capture `?src=` on `/trial` (academy page, coach page, directory pass it).
- Files: SQL above; `prisma/schema.prisma`; `src/app/actions/trial.ts` (write orgId, source whitelist, leadId; switch to `rateLimitDb`); links in `academy/[slug]/page.tsx`, `c/[coachId]/page.tsx`; `src/lib/trial-source.ts` + test.
- Permission/tenant: public write; org from batch only; source whitelisted.
- Audit: none on public write (Lead row is the record).
- Acceptance: new trials carry orgId + source; queries can switch from `batch.orgId` to `orgId`.

**S4 — Trial date validation.**
- Files: `src/lib/trial-date.ts` (`isBookableTrialDate(schedule, date, holidays, today)` using `scheduleRunsOn`), test; `trial.ts`, `TrialClient.tsx` (date picker hints).
- Acceptance: a Tuesday date for a Mon/Wed/Fri batch is rejected with a friendly message.

**S5 — Waitlist that moves + public join.**
- Objective: "Batch full" on `/join` offers the waitlist; admin sees "Offer seat" on the oldest WAITING entry, producing a WhatsApp deep link and 48h `offerExpiresAt`.
- Files: `src/app/join/actions.ts` (`joinWaitlist`, rate-limited via `rateLimitDb`), `JoinForm.tsx`, `src/app/actions/waitlist.ts` (`offerSeat`), `WaitlistManager.tsx`, `src/lib/waitlist.ts` (`nextInLine`, `isOfferLive`) + test.
- Permission/tenant: public add resolves org from slug + batch; admin actions `students.manage` with `batch.orgId = session.orgId`.
- Audit: `WAITLIST_OFFERED`, `WAITLIST_EXPIRED`, `WAITLIST_ENROLLED`.
- Acceptance: FIFO order; expired offers return to WAITING and the next entry becomes offerable.

**S6 — Funnel card.**
- Files: `src/app/actions/leads.ts` (`getParticipationFunnel(range)`, `reports.view`), `src/lib/funnel.ts` (pure aggregation) + test; card on leads tab.
- Acceptance: counts by source for enquiry → trial → attended → enrolled reconcile with Lead/TrialBooking rows.

## 7. Feature flag

New flag `participation` → `NEXT_PUBLIC_FEATURE_PARTICIPATION`, add to `FEATURES` in `src/lib/features.ts`
with fallback **false**. Gates S3–S6 UI and new actions. S1 (bug fix) and S2 (capacity safety) ship
unflagged because they correct existing behaviour; founder to confirm.

## 8. Dependencies

- **Vertical 1 (Academy operations):** batches, schedules, `Holiday`, enrolment and capacity are V1 data; known issues 4.A/4.C in `docs/known-issues.md` (enrolment integrity, duplicate conversions) should land first or alongside S2. Branches (`Batch.branchId`, `prisma/sql/2026-10-25_branches.sql`, not yet applied) would let `/trial` filter by location later.
- **Vertical 3 (Coach careers):** coach page is a trial source (`COACH_PAGE`).
- **Vertical 5 (Venues):** none for v1; adult drop-in play is a V5 extension.
- **Marketplace / directory:** `DirectoryLead` → `Lead` mirror is reused as a source (`DIRECTORY`).

## 9. Risks and open questions

1. Rewrite legacy trial statuses in the DB, or normalise at read time forever? (Proposal: normalise now, one approved UPDATE later.) Needs a read-only count of current values — not verified.
2. Is the trial status bug hitting academies in Noida/Gurgaon today? Code reading says Confirm throws; please confirm in the UI before S1 is prioritised.
3. Should admins be able to over-fill a batch? Proposal: yes, with explicit override + audit.
4. Adults: `/join` already accepts ages up to 70 but copy says "child". Do we position participation for adult players in v1?
5. Waitlist offers via WhatsApp deep link are manual; automated sends need WhatsApp template approval (`src/lib/whatsapp.ts` not reviewed for this).
6. RLS status of `TrialBooking`, `Waitlist`, `Lead` could not be verified from code.
