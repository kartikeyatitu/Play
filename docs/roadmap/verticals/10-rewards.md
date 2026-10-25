# Vertical 10 — Rewards

> Verified by reading code on branch `feat/academy-os-branches`, 2026-10-25. No DB or Vercel access used.

## 1. Goal

Give academies a simple, trustworthy incentive system: athletes earn points for showing up and
improving, coaches can add points with a reason, and families spend points on things the academy
offers (a jersey, an extra session, a kit discount). Parents earn a reward when a family they refer
actually enrols. Every point and every referral reward is traceable, reversible and scoped to one
academy, so owners can trust the balance and parents can see why it changed.

## 2. Verified today

| Capability | Evidence | Status |
|---|---|---|
| Points balance | `Student.points Int @default(0)`; shown on `/student/[id]` and `GamificationWidget.tsx` | working (single mutable int) |
| Manual award | `awardPoints` in `src/app/actions/gamification.ts`: `requireAuth(['ADMIN','COACH'])`, coach-scoped, `increment`; only caller `CoachActions.tsx` (+10 fixed). No reason, no audit, no upper bound on `points` arg | partial |
| Rule-based recalculation | `recalculatePoints` / `recalculateAllPoints` / `getPointBreakdown` in `src/app/actions/points.ts` (`students.manage`): **overwrites** `points` from attendance (+10/–5, +5 streak) and last 5 skill reports. No UI caller (grep). Would erase manual awards if run. Streak iterates attendances ordered by `sessionId` (cuid), not session date | partial / dormant |
| Comment vs code drift | `points.ts` header lists "+20 perfect week"; code does not implement it | — |
| Store | `Product`/`Order`; `createProduct` (`settings.manage`), `placeOrder` (parent own child / admin in-org), `fulfillOrder` (`fees.collect`) in `src/app/actions/store.ts`; `ProShop.tsx`, `StoreManager.tsx` | working (cash price only, no points) |
| Referral create | `src/app/actions/referral.ts` and `src/app/actions/referrals.ts` (two near-duplicate `createReferral`s); `Referral` has **no `orgId`**, `discount` default 500, `refereePhone` unvalidated | partial |
| Referral conversion | nothing sets `status: "CONVERTED"` except `src/app/actions/seed.ts`; `getReferralsCount` counts CONVERTED | missing |
| Referral link | `ReferralWidget.tsx` builds `/join?ref=<first 6 chars of userId>`; `src/app/join/page.tsx` reads only `academy` from `searchParams` | UI-only (link does nothing) |
| Referral admin | `ReferralProgram.tsx` rendered only in Marketing tab behind `FEATURES.experimental` (`AdminClient.tsx`) | hidden |
| Coupons | `createCoupon`/`getCoupons` (`fees.manage`) in `src/app/actions/coupons.ts`; `CouponManager.tsx` shown in fees area. `Coupon.code @unique` is global (two academies cannot both use "SUMMER10"); no redemption path, `usedCount` never incremented | UI-only (create/list) |
| Fee discount mechanics | `FeeRecord.amount` + `Student.feeOverride`; no discount/credit field | missing |

## 3. Gaps for a real v1

1. No ledger: points cannot be explained, reversed or audited, and the two write paths conflict
   (increment vs overwrite).
2. Points have nothing to be spent on.
3. Referral loop is broken end-to-end: link ignored, no conversion, no reward, no tenant column.
4. Coupons are decorative (no redemption) and globally unique across tenants.
5. Rules are hard-coded and partly wrong (ordering bug, perfect-week claim).

## 4. v1 scope

**In**
- `PointTransaction` ledger as source of truth; `Student.points` kept as a cached balance updated in the
  same transaction (existing UI keeps working unchanged).
- Manual award with reason and cap (replaces silent +10); coach and admin.
- Automatic attendance points written idempotently per `Attendance` row (fixes the ordering bug by not
  recomputing history). `recalculatePoints` retired behind flag (kept, not deleted).
- Redeem points for store items: `Product.pointsCost` (nullable) and `Order.pointsSpent`; fulfilment
  stays on the existing `fulfillOrder` path.
- Referral v1: add `orgId`, accept `?ref=` on `/join`, mark CONVERTED when the referee's phone becomes a
  student via `convertLeadToStudent` / `convertTrialToStudent` / `createStudent`, and grant the referrer
  **points** (not a fee discount).

**Out (explicitly)**
- Fee discounts / wallet credit against `FeeRecord` (needs a fee-adjustment model owned by V1 fees work).
- Coupon redemption at checkout (same reason). Per-org coupon uniqueness is listed as an open question.
- Cash value for points, expiry, transfer between siblings, cross-academy points.
- Configurable rule builder (rules live in `src/lib/points-rules.ts` with per-org on/off at most).

## 5. Data model

```prisma
model PointTransaction {
  id          String   @id @default(cuid())
  orgId       String
  studentId   String
  delta       Int                // + earn, – spend/reversal
  reason      String             // ATTENDANCE | MANUAL | REDEMPTION | REFERRAL | REVERSAL | OPENING_BALANCE
  sourceType  String?            // "Attendance" | "Order" | "Referral" | "Recognition"
  sourceId    String?
  note        String?
  createdById String?            // null = system
  createdAt   DateTime @default(now())
  student     Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  @@unique([sourceType, sourceId, reason])   // idempotency for system grants
  @@index([orgId, createdAt])
  @@index([studentId, createdAt])
}
// Additive fields:
//   Product.pointsCost  Int?     // null = cash only
//   Order.pointsSpent   Int?
//   Referral.orgId      String?  // nullable for legacy rows; always set on new rows
//   Referral.convertedStudentId String?
//   Referral.convertedAt DateTime?
```

Why a new table: a cached int cannot be audited or reversed, and idempotent system grants need a unique
key per source. Reuse elsewhere: redemption reuses `Product`/`Order`; referral reuses `Referral`.
`Referral.discount` is left in place but ignored by v1 (points instead).

```sql
-- prisma/sql/<date>_points_ledger.sql — additive. NOT APPLIED. Needs founder approval.
CREATE TABLE IF NOT EXISTS "PointTransaction" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "studentId" TEXT NOT NULL REFERENCES "Student"("id") ON DELETE CASCADE,
  "delta" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "sourceType" TEXT, "sourceId" TEXT, "note" TEXT,
  "createdById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "PointTransaction_source_key"
  ON "PointTransaction"("sourceType","sourceId","reason");
CREATE INDEX IF NOT EXISTS "PointTransaction_orgId_createdAt_idx" ON "PointTransaction"("orgId","createdAt");
CREATE INDEX IF NOT EXISTS "PointTransaction_studentId_createdAt_idx" ON "PointTransaction"("studentId","createdAt");
ALTER TABLE "PointTransaction" ENABLE ROW LEVEL SECURITY;
-- Opening balance so ledger sum == current Student.points (idempotent via sourceType/sourceId).
INSERT INTO "PointTransaction" ("id","orgId","studentId","delta","reason","sourceType","sourceId")
SELECT 'pt_open_' || s."id", s."orgId", s."id", s."points", 'OPENING_BALANCE', 'Student', s."id"
FROM "Student" s WHERE s."orgId" IS NOT NULL AND s."points" <> 0
ON CONFLICT ("sourceType","sourceId","reason") DO NOTHING;

-- prisma/sql/<date>_rewards_redemption_referral.sql — additive. NOT APPLIED.
ALTER TABLE "Product"  ADD COLUMN IF NOT EXISTS "pointsCost" INTEGER;
ALTER TABLE "Order"    ADD COLUMN IF NOT EXISTS "pointsSpent" INTEGER;
ALTER TABLE "Referral" ADD COLUMN IF NOT EXISTS "orgId" TEXT REFERENCES "Organization"("id") ON DELETE CASCADE;
ALTER TABLE "Referral" ADD COLUMN IF NOT EXISTS "convertedStudentId" TEXT REFERENCES "Student"("id") ON DELETE SET NULL;
ALTER TABLE "Referral" ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Referral_orgId_idx" ON "Referral"("orgId");
-- Backfill Referral.orgId from the referrer (same rule getReferrals uses today).
UPDATE "Referral" r SET "orgId" = u."orgId" FROM "User" u WHERE r."referrerId" = u."id" AND r."orgId" IS NULL;
```
(RLS on `Referral`, `Product`, `Order` was not in `2026-10-14_enable_rls_on_exposed_tables.sql`; whether it is
enabled elsewhere is unverified — check before applying.)

## 6. Build slices

**S1 — Rules library (no schema).** Files: `src/lib/points-rules.ts` (attendance grant per status via
`attendanceStatusOf`, skill bonus, manual cap e.g. 1–50) + `src/lib/__tests__/points-rules.test.ts`;
correct `points.ts` comment. Rule: pure. Audit: none. Accept: tests cover LATE/EXCUSED, cap, negative input.

**S2 — Ledger + audited manual award.**
- Files: model + SQL; `src/app/actions/gamification.ts` `awardPoints(studentId, points, note)` writes ledger +
  `increment` in one `db.$transaction` when flag on (flag off: today's behaviour); `CoachActions.tsx` adds a
  reason picker behind flag; `src/app/actions/points.ts` `getPointHistory` (ledger list).
- Rule: COACH scope = `staffStudentWhere` (existing); ADMIN needs `students.manage`; `orgId` from session only.
  `recalculatePoints*` return an error when flag on (prevents overwrite).
- Audit: `POINTS_AWARDED` (`studentId`, `delta`, `note`). Tests: ledger-balance reducer in `points-rules.ts`.
- Accept: balance == sum(ledger) for a test student; parent sees "why" list.

**S3 — Attendance points, idempotent.**
- Files: `src/app/actions/attendance.ts` (`markAttendance`, `markBatchAttendance`) call a ledger helper after save:
  upsert grant keyed `("Attendance", attendanceId, "ATTENDANCE")`; status change → `REVERSAL` row.
- Rule: inherits `authoriseBatch` in `attendance.ts` (role COACH/ADMIN + batch in `orgId` + coach owns batch;
  note it does not check the `attendance.mark` permission key today). Audit: none per row (volume);
  ledger is the trail. Tests: grant/reversal planner (pure) for PRESENT→ABSENT→PRESENT.
- Accept: re-marking the same session never double-counts; hot path adds ≤ 1 query per batch (use `createMany`).

**S4 — Redeem points in the store.**
- Files: `StoreManager.tsx` (optional points price), `src/app/actions/store.ts` `redeemWithPoints(productId, studentId)`
  (balance check + negative ledger row + `Order.pointsSpent` + stock decrement in one transaction);
  `ProShop.tsx` "Redeem" button behind flag; cancelling an undelivered order refunds via `REVERSAL`.
- Rule: parent for own child (V1 guardian helper), admin `fees.collect`; product must share the student's `orgId`
  (existing `placeOrder` check). Audit: `POINTS_REDEEMED`, `REDEMPTION_REFUNDED`.
- Accept: concurrent double-tap cannot overspend (conditional `updateMany` on `points >= cost`).

**S5 — Working referral loop.**
- Files: `src/app/join/page.tsx` + `JoinForm.tsx` + `src/app/join/actions.ts` carry `ref`; replace 6-char userId
  prefix with a per-parent code (`src/lib/referral-code.ts` + test); conversion hook in `convertLeadToStudent`
  (`leads.ts`), `convertTrialToStudent` (`trial-convert.ts`), `createStudent` (`users.ts`) matching normalised
  `refereePhone` within the same `orgId`; grant ledger `("Referral", referralId, "REFERRAL")`. Consolidate the
  duplicate `referral.ts`/`referrals.ts` actions.
- Rule: referral rows always carry `orgId`; self-referral (same phone) rejected. Audit: `REFERRAL_CONVERTED`.
- Accept: parent A refers B, B's child is enrolled, A's child gets points once; `ReferralWidget` count increments.

## 7. Feature flag

`NEXT_PUBLIC_FEATURE_REWARDS` → `FEATURES.rewards`, default **off**. Gates ledger writes, reason picker,
history, attendance grants, points redemption, referral conversion + `?ref=` handling. With the flag off,
`awardPoints`, store and referrals behave exactly as today.

## 8. Dependencies

- V1: guardian-aware access (who may redeem), lead/trial conversion actions, logged comms for "you earned points".
- V8: recognitions may grant points (`sourceType: "Recognition"`); V8 S1 decides whether points-based badges remain.
- V2: profile shows balance and history. Fees work (V1/PR #2 lineage) owns any future fee credit.

## 9. Risks and open questions

- Should points ever be worth money (fee credit)? It turns points into a liability and touches GST/receipts.
- Opening balance: trust current `Student.points` (could include unaudited +10s) or recompute once from rules?
- Per-academy coupon codes need `@@unique([orgId, code])`, which means dropping the global unique — not
  strictly additive. Approve or keep global?
- Referral reward size and who receives it (referrer's eldest child? choice?). Fraud: same household phones.
- Is a public leaderboard of points (today's parent widget) compatible with points becoming spendable?
