# Vertical 5 — Venues

Status: PLAN ONLY. Nothing here is applied. Written 2026-10-25 against branch `feat/academy-os-branches`.

## 1. Goal

Let any academy or turf owner run their courts/pitches on Triq: one availability grid that covers
walk-in, phone, academy-batch and online bookings, money that is clearly marked as gateway-verified
or recorded offline, and no double-booking — including between public customers and the academy's
own batches. v1 hardens the already-working turf engine rather than building a new one.

## 2. Verified today

| Capability | Evidence | Status |
|---|---|---|
| Courts/pitches | `Facility` (name, type, hourlyRate, openHour, closeHour, advanceAmount, isActive); `saveFacility` / `archiveFacility` in `src/app/actions/turf-bookings.ts` (`checkPermission("bookings.manage")`); legacy `createFacility`/`deleteFacility` in `src/app/actions/facilities.ts` | working |
| Admin board | `src/components/org/TurfBoard.tsx` via `src/components/shell/BookingsScreen.tsx`, behind `FEATURES.bookings` (`AdminClient.tsx` lines 173, 212, 304; `TodayScreen.tsx` line 240) | working |
| Counter / phone / lease bookings | `createCounterBooking` (`turf-bookings.ts`): validates date, hours, phone, amount, opening hours; repeats weekly up to `MAX_LEASE_WEEKS = 26` (`src/lib/turf.ts`) with `leaseGroupId`, source `COUNTER`/`LEASE`; reports per-week conflicts | working |
| No-double-booking | `reserveSlot` in `src/lib/turf-engine.ts` (advisory lock + overlap check). Engine comments and `isOverlapViolation` reference a Postgres exclusion constraint `turf_booking_no_overlap` created by `scripts/apply-turf-constraint.ts` — **that script is not in `scripts/`** and no SQL for it exists in `prisma/sql/`. Whether the constraint exists in production could not be verified | partial |
| Booking lifecycle | `updateBooking` actions CANCEL, NO_SHOW, COMPLETE, COLLECT_BALANCE, CANCEL_SERIES, CONFIRM_UPI, REJECT_UPI; writes `AuditLog` `TURF_BOOKING_<ACTION>` | working |
| Audit on creation | `createCounterBooking` writes **no** audit row | missing |
| Public booking page | `/book/[slug]` (`src/app/book/[slug]/page.tsx`, `BookClient.tsx`, `src/app/book/actions.ts`): `getPublicVenue` (active org + active facilities), `getPublicAvailability`, `MAX_DAYS_AHEAD` window | working |
| Public page behind flag | `/book/*` does not import `FEATURES` — live regardless of `bookings` flag | partial |
| Online advance (Razorpay) | `startOnlineBooking` creates HOLD (`HOLD_MINUTES = 10`) + Razorpay order on the academy's own keys; `confirmTurfCheckout` verifies checkout signature; `confirmPaidBooking` checks amount (`AMOUNT_MISMATCH` → `PAID_CONFLICT`); per-org webhook `src/app/api/webhooks/razorpay/[orgId]/route.ts` verifies signature and confirms turf bookings on `payment.captured` / `order.paid` by `providerOrderId` | working (code); `docs/audits/feature-inventory.md` says 0 webhook events ever delivered in prod |
| Paid-but-slot-taken | `PAID_CONFLICT` status surfaced on board (`getTurfBoard` query) for manual refund | working |
| UPI direct (no gateway) | `startUpiBooking` (`UPI_HOLD_MINUTES = 15`), customer `reportUpiPaid` stores marker `UPI_REPORTED[:utr]` in **`providerPaymentId`**; admin `CONFIRM_UPI`/`REJECT_UPI` | working, but overloads a gateway column |
| Offline vs online money | `TurfBooking.advancePaid` is one number; `COMPLETE`/`COLLECT_BALANCE` set `advancePaid = amount` with no method. Only inference: `source=ONLINE` + real `providerPaymentId` ⇒ gateway. Fees already have `PAYMENT_METHODS` (`src/lib/payment-method.ts`) | partial |
| Rate limits on public writes | `rateLimitDb` per phone and IP in `book/actions.ts` | working |
| Academy batch ↔ court | `Booking` model (facility↔batch) written only by `bookFacility` in `facilities.ts`; **no UI calls it** (grep) and nothing reads `Booking`; it is not checked by `reserveSlot` | UI-missing / dead |
| Branch link | `Facility` has no `branchId`; `Branch` exists (`prisma/sql/2026-10-25_branches.sql`, not applied) | missing |
| Venue revenue report | Not found in `turf-bookings.ts`; `reports.ts` not reviewed for turf | unverified |

## 3. Gaps for a real v1

1. Commit the exclusion constraint as SQL in `prisma/sql/` (and confirm prod state) — today the "last line of defence" is undocumented.
2. Record how each rupee was received: `paymentMethod` on `TurfBooking` reusing `PAYMENT_METHODS`; stop storing `UPI_REPORTED` in `providerPaymentId`.
3. Academy batches must block courts: represent recurring batch usage as `TurfBooking` rows with `source = 'BATCH'` (reuse the engine) instead of the dead `Booking` model.
4. Audit booking creation and public online confirmations.
5. `/book/[slug]` should respect the `bookings` flag and the org's `businessType` (`ACADEMY | TURF | BOTH`).
6. Facilities per branch for multi-centre venues.
7. Day-end cash-up: totals by method (offline recorded vs UPI confirmed vs gateway verified).

## 4. v1 scope

**In**: constraint SQL; `paymentMethod` + `utr` columns and backfill; batch blocks via `source=BATCH`; creation audit; flag + businessType gating for `/book`; `Facility.branchId`; daily cash-up card; slot-level pricing stays flat (`hourlyRate`).

**Out**: peak/off-peak pricing, memberships/packs for venues, refunds via Razorpay API (stays manual on `PAID_CONFLICT`), split payments between players, third-party aggregator sync (Playo/Hudle), multi-hour discounts, deleting the legacy `Booking` table.

## 5. Data model

Reuse `Facility`, `TurfBooking`, `Branch`, `AuditLog`, `PAYMENT_METHODS`. No new tables.

```prisma
model Facility {
  // ...existing...
  branchId String?
  branch   Branch? @relation(fields: [branchId], references: [id], onDelete: SetNull)
  @@index([branchId])
}

model TurfBooking {
  // ...existing...
  paymentMethod String?  // OFFLINE_RECORDED | PARENT_REPORTED_UPI | ADMIN_CONFIRMED_UPI | ONLINE_VERIFIED (src/lib/payment-method.ts)
  upiRef        String?  // customer-reported UTR (moves out of providerPaymentId)
  batchId       String?  // set when source = 'BATCH' (academy's own batch blocking the court)
  createdById   String?  // staff who created a COUNTER/LEASE/BATCH booking
  @@index([orgId, batchId])
}
// Branch gets: facilities Facility[]
```

```sql
-- prisma/sql/2026-11-XX_venues.sql
-- Additive only. NOT APPLIED. Requires founder approval. Apply AFTER 2026-10-25_branches.sql.
ALTER TABLE "Facility" ADD COLUMN IF NOT EXISTS "branchId" TEXT REFERENCES "Branch"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "Facility_branchId_idx" ON "Facility"("branchId");

ALTER TABLE "TurfBooking" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "TurfBooking" ADD COLUMN IF NOT EXISTS "upiRef" TEXT;
ALTER TABLE "TurfBooking" ADD COLUMN IF NOT EXISTS "batchId" TEXT REFERENCES "Batch"("id") ON DELETE SET NULL;
ALTER TABLE "TurfBooking" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
CREATE INDEX IF NOT EXISTS "TurfBooking_orgId_batchId_idx" ON "TurfBooking"("orgId", "batchId");

-- Backfill payment method conservatively (idempotent):
UPDATE "TurfBooking" SET "paymentMethod" = 'ONLINE_VERIFIED'
 WHERE "paymentMethod" IS NULL AND "source" = 'ONLINE' AND "providerPaymentId" IS NOT NULL
   AND "providerPaymentId" NOT LIKE 'UPI_REPORTED%' AND "status" IN ('CONFIRMED','COMPLETED');
UPDATE "TurfBooking" SET "upiRef" = NULLIF(split_part("providerPaymentId", ':', 2), ''),
       "paymentMethod" = CASE WHEN "status" IN ('CONFIRMED','COMPLETED') THEN 'ADMIN_CONFIRMED_UPI' ELSE 'PARENT_REPORTED_UPI' END
 WHERE "paymentMethod" IS NULL AND "providerPaymentId" LIKE 'UPI_REPORTED%';
UPDATE "TurfBooking" SET "paymentMethod" = 'OFFLINE_RECORDED'
 WHERE "paymentMethod" IS NULL AND "source" IN ('COUNTER','LEASE') AND "advancePaid" > 0;

-- Overlap guard, committed for the first time (verify whether it already exists before running):
CREATE EXTENSION IF NOT EXISTS btree_gist;
-- ALTER TABLE "TurfBooking" ADD CONSTRAINT turf_booking_no_overlap EXCLUDE USING gist
--   ("facilityId" WITH =, tsrange("startTime","endTime") WITH &&)
--   WHERE ("status" IN ('HOLD','CONFIRMED'));
-- Left commented: the exact prod definition (incl. HOLD expiry handling) must be read from the DB first.

ALTER TABLE "Facility" ENABLE ROW LEVEL SECURITY; -- TurfBooking already covered by 2026-10-14 migration
```

`providerPaymentId` keeps only real gateway ids going forward. The old `Booking` table is left in place.

## 6. Build slices

**S1 — Audit creation + document the constraint (no runtime schema change).**
- Files: `turf-bookings.ts` (`createCounterBooking` → `TURF_BOOKING_CREATED` {ids, source, amount, advancePaid}), `src/app/book/actions.ts` (`TURF_ONLINE_HOLD`, `TURF_UPI_REPORTED` with `userId` = org owner or a system user — see §9), `prisma/sql/2026-11-XX_turf_overlap_constraint.sql` (commented until prod is inspected).
- Permission/tenant: unchanged (`bookings.manage`, `orgId` from session; public paths resolve org from slug).
- Tests: none new (no pure logic); e2e note in `e2e/README.md` style.
- Acceptance: every booking row has a creation audit; constraint definition committed and reviewed.

**S2 — Payment method on bookings (flag `venues`).**
- Objective: distinguish offline vs UPI-confirmed vs gateway-verified.
- Files: SQL above; `prisma/schema.prisma`; `src/lib/turf-payment.ts` (`methodForAction(action, booking)`, `legacyMethod(booking)`) + `src/lib/__tests__/turf-payment.test.ts`; `turf-engine.ts` (`confirmPaidBooking` sets `ONLINE_VERIFIED` only from signature-verified paths; `confirmUpiBooking` sets `ADMIN_CONFIRMED_UPI`); `book/actions.ts` (`reportUpiPaid` writes `upiRef`, `PARENT_REPORTED_UPI`; stop writing marker once column is live — keep read fallback for `UPI_REPORTED%`); `turf-bookings.ts` (`COLLECT_BALANCE`/`COMPLETE` set `OFFLINE_RECORDED` for the balance); `TurfBoard.tsx` uses `paymentMethodLabel`.
- Audit: existing `TURF_BOOKING_*` plus `{paymentMethod}` in details.
- Acceptance: board shows "Verified online" only for webhook/signature-confirmed bookings.

**S3 — Batches block courts.**
- Objective: academy batch schedule reserves courts through `reserveSlot` with `source='BATCH'`, `batchId`.
- Files: `src/app/actions/turf-bookings.ts` (`blockCourtForBatch({facilityId, batchId, weekday, startHour, hours, weeks})`, `releaseBatchBlock`), `TurfBoard.tsx` (distinct colour, no money fields), `src/lib/turf.ts` (`BATCH` source constant) + test for weekly date generation.
- Permission/tenant: `bookings.manage` AND `batches.manage`; batch and facility both `orgId = session.orgId`.
- Audit: `TURF_BATCH_BLOCKED`, `TURF_BATCH_RELEASED`.
- Acceptance: a public customer cannot book an hour the U-14 batch holds; amount = 0, `paymentMethod` null.

**S4 — Public page gating + branches.**
- Files: `src/app/book/[slug]/page.tsx` (`notFound()` when `!FEATURES.bookings` or `businessType === 'ACADEMY'` with no active facility), `saveFacility` accepts `branchId` (validated `orgId`), `FacilitiesTab`/facility editor shows branch picker.
- Acceptance: flag off ⇒ `/book/*` 404; facilities filterable by branch.

**S5 — Daily cash-up.**
- Files: `src/lib/turf-cashup.ts` (pure: sum by method/day) + test; `getTurfCashup(date)` in `turf-bookings.ts` (`reports.view` or `bookings.manage`); card under TurfBoard.
- Acceptance: totals reconcile with rows; gateway-verified shown separately from offline.

## 7. Feature flag

Existing `bookings` (`NEXT_PUBLIC_FEATURE_BOOKINGS`, fallback **true**) keeps gating today's board.
New `venues` (`NEXT_PUBLIC_FEATURE_VENUES`, fallback **false**) gates S2–S5 additions (payment-method UI,
batch blocks, branch picker, cash-up). Backend writes of `paymentMethod` may run unflagged once the
column exists, since they only add information — founder to confirm.

## 8. Dependencies

- **Vertical 1 (Academy operations):** `Branch` (migration `2026-10-25_branches.sql` must be applied before S4), `Batch` schedules for S3, `PAYMENT_METHODS` convention from fees (`2026-10-25_fee_payment_method.sql`, not applied), Razorpay Connect (`src/app/actions/razorpay-connect.ts`).
- **Vertical 4 (Participation):** later adult drop-in play could sell court slots; not v1.
- **Vertical 6 (Competitions):** match fixtures should reserve courts with `source='EVENT'` via the same engine.

## 9. Risks and open questions

1. Does `turf_booking_no_overlap` exist in production? The script that created it is not in the repo. Needs a read-only check before S1's SQL is finalised.
2. Webhook delivery: the feature inventory records 0 Razorpay webhook events in prod; online turf confirmation currently relies on the client-side signature path. Run the payment smoke test (`docs/sprints/task-7-payment-smoke-test.md`) for a turf booking.
3. Audit rows require `userId` (FK to `User`). Public actions have no user — use the org owner, a system user, or make the audit optional for public events?
4. Should `COMPLETE` keep auto-setting `advancePaid = amount`? It assumes the balance was collected in cash.
5. Batch blocks vs leases: should a LEASE to another academy and a BATCH block share one UI?
6. Keep or drop the unused `Booking` model / `bookFacility` action? (Plan: leave untouched in v1.)
