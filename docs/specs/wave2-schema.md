# Wave 2 schema

Status: **NOT APPLIED.** The founder must approve before anything runs on production.

- SQL: `prisma/sql/2026-10-29_wave2.sql`. It is one transaction, runs top to bottom, and can be run more than once.
- Prisma models: the `WAVE 2` block at the end of `prisma/schema.prisma`, plus three new fields on `Receipt`.
- Flags: `src/lib/features.ts`. Every wave 2 flag defaults to `false`. Code must not query a wave 2 table while its flag is off.
- This file replaces `prisma/sql/2026-10-29_trust_batch.sql`, which is now marked superseded. Its content is section 8 of the wave2 SQL.

## Deploy-order warning (Receipt)

`Receipt` now has `voidedAt`, `voidReason` and `voidedById` in the Prisma schema. A Prisma client generated from this schema selects these columns on every `receipt.findUnique`, `findFirst` and `create` that has no `select`. That includes `src/lib/receipt-service.ts` and `src/app/actions/payments.ts`. If this schema is deployed before the SQL runs, receipt reads and receipt creation (fee payment) fail with "column does not exist".

**Run the SQL before deploying any build generated from this schema.** No other wave 2 change has this risk. The new tables have no back-relations on existing models, so existing queries never touch them.

## Conventions

- Every id is a `TEXT` primary key holding a cuid (`@default(cuid())`).
- Every timestamp is `TIMESTAMP(3)`. Every table has `createdAt`. Mutable tables also have `updatedAt`.
- Append-only tables have no `updatedAt`, on purpose: `PointsLedger`, `XpLedger`, `MediaSubject`, `MediaAudit` and `WaiverSignature`. A correction is a new row, never an update.
- A tenant-scoped table carries `orgId` and has an index that starts with it.
- Foreign keys to existing models (Organization, User, Student, Batch, Session, Event and Subscription) exist only in the SQL. In Prisma they are plain fields. This follows the same pattern as the athlete and live-scoring blocks, and it means no existing model gets a back-relation.
- Actor columns such as `createdById`, `approvedById` and `recordedById` have no foreign key, matching the existing tables.
- Money is stored as integer minor units (paise).
- Points and XP balances are never stored. They are computed by summing the ledger.
- RLS is enabled on every new table with no policies, so anon and authenticated access is denied by default. The app connects as the table owner (service role) and is not affected.

## Models

| Model (table) | Purpose | Flag | Used by |
|---|---|---|---|
| `PointsLedger` | Append-only signed points rows. `idempotencyKey` is unique, so a retry cannot award twice. `expiresAt` is set on earned rows, and an expiry job writes negative rows. | `rewards` | Rewards: earning, balance, redemption debit, expiry |
| `XpLedger` | Append-only XP rows (levels). XP never expires and is never spent. | `rewards` | Rewards: levels |
| `BadgeDefinition` | Badge catalogue. `orgId` null means a global TRIQ badge, kept unique by a partial index on `key`. `rule` is the auto-award rule. | `rewards` | Rewards: badges admin, auto-award job |
| `StudentBadge` | A badge awarded to a student. Unique per student and badge. Can be revoked. | `rewards` | Rewards: athlete profile, parent app |
| `RewardItem` | Academy reward catalogue: `costPoints`, `stock` (null means unlimited), `eligibility` JSON, `active`. | `rewards` | Rewards: catalogue |
| `Redemption` | REQUESTED → APPROVED → FULFILLED, or CANCELLED. `pointsLedgerRef` points to the debit row. Stores a snapshot of `costPoints`. | `rewards` | Rewards: parent request, staff approval |
| `LeaderboardOptIn` | Guardian opt-in for leaderboards. A student is shown only while `optedOutAt` is null. | `rewards` | Rewards: leaderboards |
| `MediaAsset` | An uploaded photo or video. `contextType` is MATCH, SESSION, TOURNAMENT or GALLERY. `status` is PENDING, READY, QUARANTINED or DELETED. Also holds `storageKey`, `variants`, `durationSec`, `bytes` and `deleteAfter` (retention). | `media` | Media uploads, gallery, match and session media |
| `MediaSubject` | A student tagged in a media item. | `media` | Media tagging, per-student visibility |
| `MediaConsent` | Guardian consent per scope: `internal_coaching`, `parents_of_batch`, `academy_public` or `tournament_public`. Withdrawing sets `withdrawnAt`, and a new grant is a new row. | `media` | Media visibility checks |
| `MediaAudit` | Append-only media actions: upload, tag, share, quarantine, delete. | `media` | Media audit, DPDP evidence |
| `GuardianLink` | Links guardians and students many-to-many. One parent can have several children, and a child can have two or more guardians. A partial unique index allows at most one primary guardian. `Student.parentId` stays as the legacy primary. | `familyAccounts` | Family accounts, parent switcher, consent signers |
| `WaiverTemplate` | Versioned waiver text for each academy. | `waivers` | Waivers admin |
| `WaiverSignature` | Append-only guardian e-signature for a template version and a student. Stores `ipHash` only, never the raw IP. | `waivers` | Waiver signing, enrolment gate |
| `ConsentRecord` | DPDP verifiable parental consent for each purpose, with `method`, `noticeVersion` and grant and withdrawal times. | `consentLedger` | Consent centre, onboarding |
| `Drill` | A training drill. `orgId` null means a TRIQ library drill. Also holds sport, duration, equipment, age group and `skillKeys`. | `drillLibrary` | Drill library |
| `SessionPlan` | A coach's plan for a session, optionally tied to a batch and a date. | `drillLibrary` | Session planner |
| `SessionPlanItem` | An ordered item in a plan. It can be a drill or free text. | `drillLibrary` | Session planner |
| `EventWaitlist` | A waitlist for each `Event`: `position`, and `status` WAITING, OFFERED, ACCEPTED or EXPIRED, with offer expiry. | `eventWaitlist` | Events and RSVP when an event is full |
| `MessageDelivery` | Outbound delivery log with retries. `channel` is WHATSAPP, EMAIL or SMS, and `status` runs QUEUED → SENT → DELIVERED → READ, or FAILED. `toRef` is a hash of the recipient. Also holds `providerMessageId`, `nextAttemptAt`, an idempotency key and the related entity. | `messageDelivery` | Fee reminders, receipts, announcements, retry worker |
| `NotificationPreference` | A user's on/off setting for each channel and category. | `messageDelivery` | Notification settings, the send-time check |
| `DataRequest` | A DPDP delete or export request with a `referenceId`, tracked until resolved. Same as the trust_batch file. | `dataRequests` | Privacy request form, admin queue |
| `Receipt` (+3 columns) | `voidedAt`, `voidReason` and `voidedById`. A receipt is voided, never deleted. | `receiptVoid` | Receipt void action, receipt lists |
| `FitnessResult` | A standard fitness test result. `value` is `DECIMAL(12,3)` with a `unit` and an optional `sessionId`. | `fitnessTests` | Fitness testing, athlete profile trends |
| `SubscriptionInvoice` | TRIQ's own plan invoice for each period: `activeStudents`, `amountPaise`, `gstPaise`, a unique `invoiceNumber`, and `status` DRAFT, ISSUED, PAID or VOID. Uses the existing `Subscription`. | `triqBilling` | TRIQ billing |
| `ParentPlan` | A placeholder for the parent premium plan. | `parentPremium` | Parent premium (not built) |

## Reused instead of added

| Asked for | Decision | Existing model |
|---|---|---|
| Media | The table is named **`MediaAsset`**. A legacy `Media` model and table (student video links) already exists, and existing models must not be renamed. | `Media` (legacy, left untouched) |
| Fixture | **Not added.** It already exists with competitionId, round, slot, home and away entries, scheduledAt, venue, status, scores, winner and version. The link to live scoring is `LiveMatch.fixtureId`, so `Fixture.liveMatchId` would duplicate it. | `Fixture`, `Competition`, `CompetitionEntry`, `LiveMatch` |
| Standings | **No table.** Standings are computed from COMPLETED fixtures (`homeScore`, `awayScore` and `winnerEntryId`) using `Competition.pointsWin`, `pointsDraw` and `pointsLoss`. A league has at most a few hundred fixtures, so computing standings is cheap, and a stored table could drift after a result is corrected. | — |
| AbsenceNotice | **Not added**, as instructed, because `Attendance.status` already has `EXCUSED`. A parent-reported absence is stored as an `Attendance` row with status EXCUSED and the reason in `notes`, on a `Session` (status SCHEDULED is allowed in advance). Not covered: which guardian filed it and who acknowledged it. Record those in `AuditLog`, or add a table later if pilots need them. The `absenceNotices` flag gates the feature. | `Attendance`, `Session` |
| Subscription | Reused. | `Subscription` |
| SubscriptionInvoice | **Added**, although `BillingInvoice` exists. `BillingInvoice` stores whole rupees, has no GST split, no active-student count and no DRAFT or VOID lifecycle, and its columns cannot be changed. Legacy rows stay in `BillingInvoice`, and new TRIQ billing writes `SubscriptionInvoice`. | `BillingInvoice` (left as-is) |
| FitnessResult | **Added.** `PerformanceResult` stores only integers, has a fixed `measure` set (time, distance, height, points) and no unit column. Beep test levels (9.5), reps and bpm do not fit there cleanly. | `PerformanceResult` (left as-is) |
| EventWaitlist | Added. `Waitlist` is for batch enquiries (keyed by parent name and phone) and has no event support. | `Event`, `RSVP` |
| Student points | `Student.points` exists. It is legacy and not trusted. Rewards reads balances from `PointsLedger` only. | `Student.points` |
| Guardian consent | `OpportunityApplication.guardianConsent` and `FeeMandate.consent*` are consents specific to one feature and remain. `ConsentRecord` is the general DPDP ledger. | — |

## How to apply (after founder approval)

1. Take a backup or snapshot of the production database. On Supabase: Database → Backups.
2. Open the Supabase SQL editor for the production project. Paste the whole of `prisma/sql/2026-10-29_wave2.sql` and run it. It runs in one transaction, so it either applies fully or not at all.
3. Check the result:
   - `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Receipt' AND column_name LIKE 'void%';` should return 3 rows, with `voidedAt` as `timestamp without time zone`.
   - `SELECT count(*) FROM pg_tables WHERE tablename IN ('PointsLedger','MediaAsset','GuardianLink','DataRequest','SubscriptionInvoice','ParentPlan');` should return 6.
   - `SELECT relname FROM pg_class WHERE relrowsecurity AND relname IN ('PointsLedger','MediaAsset');` should return both.
4. Run `npx prisma generate`. The build also runs it. The models are already in `prisma/schema.prisma`, so no schema edit is needed.
5. Deploy. Only after the SQL has run (see the warning above).
6. Turn on flags one at a time with `NEXT_PUBLIC_FEATURE_<NAME>=1`, for example `NEXT_PUBLIC_FEATURE_RECEIPT_VOID=1`, then redeploy.

Do not use `prisma migrate` or `prisma db push`. This project applies hand-written SQL from `prisma/sql/`.

## Rollback

First turn off every wave 2 flag and redeploy. Nothing then reads these tables.

**Schema rollback, if needed.** This deletes all wave 2 data, so export it first if any flag was ever on:

```sql
BEGIN;
DROP TABLE IF EXISTS "SessionPlanItem", "SessionPlan", "Drill",
  "Redemption", "RewardItem", "StudentBadge", "BadgeDefinition",
  "PointsLedger", "XpLedger", "LeaderboardOptIn",
  "MediaAudit", "MediaSubject", "MediaConsent", "MediaAsset",
  "WaiverSignature", "WaiverTemplate", "ConsentRecord", "GuardianLink",
  "EventWaitlist", "MessageDelivery", "NotificationPreference",
  "DataRequest", "FitnessResult", "SubscriptionInvoice", "ParentPlan";
DROP INDEX IF EXISTS "Receipt_orgId_voidedAt_idx";
ALTER TABLE "Receipt" DROP COLUMN IF EXISTS "voidedAt",
                      DROP COLUMN IF EXISTS "voidReason",
                      DROP COLUMN IF EXISTS "voidedById";
COMMIT;
```

**Code side.** You must remove the `Receipt` void fields from `prisma/schema.prisma` and redeploy *before* dropping those columns, otherwise receipt queries fail. The wave 2 model block can stay in the schema harmlessly, or it can be removed. Then run `npx prisma generate`.

## Deploy order note (2026-10-29)

The three Receipt columns (`voidedAt`, `voidReason`, `voidedById`) are in the SQL but were removed from `prisma/schema.prisma` before committing. A Prisma client built with them would select those columns on every receipt query and break receipts and fee payments until the SQL runs. Apply order: 1) run `prisma/sql/2026-10-29_wave2.sql` on production (founder approval), 2) add the three fields and `@@index([orgId, voidedAt])` back to `model Receipt`, 3) deploy. All new tables are safe to ship before the SQL, as long as their flags stay off.
