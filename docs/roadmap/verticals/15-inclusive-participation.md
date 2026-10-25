# Vertical 15 — Inclusive participation (light v1)

> Planning doc. Read-only audit of branch `feat/academy-os-branches` on 2026-10-25. Nothing here is built yet.
> "Verified" means the file was opened and the behaviour seen in code. It does not mean it was tested in production.
> **Light vertical:** deliberately minimal. The aim is one real lever (fee concessions) and one honest measure (who participates).

## 1. Goal

Make it easy and auditable for an academy to keep children training when money or circumstance would otherwise stop them, and give the academy an honest view of who participates. The v1 has three parts:
- Recorded scholarships and fee concessions that monthly fee generation actually applies.
- An optional, parent-controlled participation profile (gender, support needs).
- A simple inclusion report, e.g. "18% of students are girls; 6 students on concessions; ₹14,000/month foregone".

## 2. Verified today

Confirmed: there is **no dedicated code** for scholarships, waivers, accessibility, para-sport or girls' participation. A grep of `src/` and `prisma/schema.prisma` for scholarship, waiver, concession, disab, para-sport, gender, girls, sponsor and hardship found only the items below.

| Capability | Evidence | Status |
|---|---|---|
| Per-student fee override | `Student.feeOverride Int?`. Read by `resolveFeeAmount` in `src/lib/fees.ts` (`if (opts.feeOverride && opts.feeOverride > 0)`), which both `generateMonthlyFees` (`src/app/actions/auto-fees.ts`) and `generateMonthlyFeesForOrg` (`src/app/actions/fees.ts`) use. Also read in `src/app/coach/page.tsx` | partial. **No action or UI writes it** (grep finds reads only). **A value of 0 means "not set"**, so a full waiver cannot be expressed. There is no reason, approver or end date |
| Skipping zero-fee students | Both generators `continue` when the resolved amount is `<= 0`, so no `FeeRecord` is created | working. Relevant: a 100% concession can reuse this path |
| Coupons | `Coupon` model + `createCoupon`/`getCoupons` (`src/app/actions/coupons.ts`, `fees.manage`), `CouponManager.tsx`. Seed data uses `SIBLING15` | UI-only in effect. **Never redeemed**: no fee or store code reads `Coupon`. `Coupon.code` is `@unique` across **all** academies |
| Fee plans | `FeePlan` + `src/app/actions/fee-plans.ts`, `PaymentPlans.tsx` / `FeePlans.tsx` | working as a catalogue, but not linked to students |
| Gender / girls' participation | `Student` has no gender field. The only match is a comment in `src/lib/sport-metrics.ts` (`"Girls Football"` batch-name matching). A `gender` field exists only in the **commented-out** `Child` model in `prisma/schema.prisma` | missing |
| Accessibility / para-sport / support needs | Nothing on `Student`, `Batch` or `MedicalForm.tsx` | missing |
| Waiver form | `MedicalForm.tsx` is titled "Medical & Waiver Form" (a liability waiver, not a fee waiver). `src/app/join/JoinForm.tsx` references the academy's digital waiver | not related (liability) |

## 3. Gaps for a real v1

1. An academy cannot record "this child is on a 50% scholarship until March", and a full waiver is impossible because `feeOverride = 0` falls back to the batch fee.
2. Concessions given informally (seed DMs like "I'll apply SIBLING15") are never applied or audited.
3. There is no way to count girls, children with support needs, or concession holders, so the academy cannot show impact to sponsors, CSR partners or federations.

## 4. v1 scope

**In**
- **Fee concessions:** percent or fixed amount off, or a full waiver, per student. Category (SCHOLARSHIP, SIBLING, HARDSHIP, MERIT, STAFF_CHILD, OTHER), a start month, an optional end month, a private reason, and the approver. Monthly fee generation applies the active concession. A 100% concession creates no `FeeRecord`, reusing the existing `<= 0` skip.
- **Participation profile:** optional `Student.gender` (FEMALE / MALE / OTHER / UNDISCLOSED). Optional `Student.supportNeeds` short note (e.g. "hearing impaired; uses visual cues"), visible to admins and the batch coach only.
- **Inclusion report** (aggregates only) under `reports.view`.

**Out (explicitly)**
- Coupon redemption (a separate fees decision). Sponsor-funded scholarship pools or matching donors (see Vertical 9 Sponsorship). Public "scholarship available" listings and applications. Para-sport classification. Disability categories or medical diagnoses. Caste, religion or income data. Automated eligibility rules.
- Changing how `feeOverride` behaves. It stays exactly as it is for existing users.

## 5. Data model

**New table `FeeConcession`.** We need one because `feeOverride` cannot represent 0 and has no reason, approver or time window, and `Coupon` is a code-based promotion with a globally unique code that is never redeemed. Concessions need history: a student can have several over time, and the report needs "foregone per month".

```prisma
model Student {
  // ...existing fields unchanged...
  gender       String?  // V15: FEMALE | MALE | OTHER | UNDISCLOSED; optional, parent-editable
  supportNeeds String?  // V15: <= 300 chars; admins + batch coach only
}

/// V15: a scholarship / concession applied by monthly fee generation.
model FeeConcession {
  id           String    @id @default(cuid())
  orgId        String
  studentId    String
  category     String    // SCHOLARSHIP | SIBLING | HARDSHIP | MERIT | STAFF_CHILD | OTHER
  percentOff   Int?      // 1..100 (exactly one of percentOff / amountOff)
  amountOff    Int?      // whole currency units per month
  startMonth   String    // "YYYY-MM"
  endMonth     String?   // inclusive; null = until revoked
  reason       String?   // <= 300 chars, staff-only, never shown to other parents
  approvedById String
  revokedAt    DateTime?
  revokedById  String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  @@index([orgId, studentId])
}
```

`prisma/sql/YYYY-MM-DD_v15_inclusive.sql`:

```sql
-- Additive only. NOT APPLIED to production. Requires founder approval before running.
-- Apply BEFORE deploying code that selects Student.gender / Student.supportNeeds.
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "gender" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "supportNeeds" TEXT;

CREATE TABLE IF NOT EXISTS "FeeConcession" (
  "id"           TEXT PRIMARY KEY,
  "orgId"        TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "studentId"    TEXT NOT NULL REFERENCES "Student"("id") ON DELETE CASCADE,
  "category"     TEXT NOT NULL,
  "percentOff"   INTEGER,
  "amountOff"    INTEGER,
  "startMonth"   TEXT NOT NULL,
  "endMonth"     TEXT,
  "reason"       TEXT,
  "approvedById" TEXT NOT NULL,
  "revokedAt"    TIMESTAMP(3),
  "revokedById"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeeConcession_one_kind" CHECK (("percentOff" IS NULL) <> ("amountOff" IS NULL)),
  CONSTRAINT "FeeConcession_percent_range" CHECK ("percentOff" IS NULL OR ("percentOff" BETWEEN 1 AND 100)),
  CONSTRAINT "FeeConcession_amount_pos" CHECK ("amountOff" IS NULL OR "amountOff" > 0)
);
CREATE INDEX IF NOT EXISTS "FeeConcession_orgId_studentId_idx" ON "FeeConcession"("orgId","studentId");
ALTER TABLE "FeeConcession" ENABLE ROW LEVEL SECURITY;
```

Add `feeConcession` to the academy-deletion order in `src/app/actions/delete.ts`, before `student`.

## 6. Build slices

**Slice 1: Concessions applied to fee generation**
- Objective: record a concession and have the next monthly run apply it.
- Files: `src/lib/features.ts` (add `inclusive`). New pure `src/lib/concessions.ts`: `activeConcession(list, month)` picks the most recent non-revoked concession whose window covers the month, `applyConcession(baseAmount, c)` floors at 0 and rounds to whole units, and `validateConcessionInput`. Constants live here, not in the `"use server"` file. `src/lib/fees.ts` is unchanged. Both generators (`auto-fees.ts`, `fees.ts → generateMonthlyFeesForOrg`) add `feeConcessions` to the student `include`, call `applyConcession(resolveStudentFee(...), activeConcession(...))`, and only do so when `FEATURES.inclusive` is on. New `src/app/actions/concessions.ts` (`grantConcession`, `revokeConcession`, `listConcessions`). New `src/components/org/ConcessionsPanel.tsx` on the student profile / Fees tab.
- Permission/tenancy: `checkPermission("fees.manage")`. The student is loaded with `{id, orgId: session.orgId}`, and `orgId` is always taken from the session. Granting a concession never edits existing `FeeRecord` rows. The admin can adjust the current month by hand (open question 2).
- Audit: `FEE_CONCESSION_GRANTED` `{concessionId, studentId, category, percentOff|amountOff, startMonth, endMonth}` (no `reason` text), `FEE_CONCESSION_REVOKED`.
- Tests: `src/lib/__tests__/concessions.test.ts` covering window edges (start, end, open-ended), revoked ignored, 100% → 0, fixed amount larger than the fee → 0, latest wins, invalid input (both or neither kind set, percent > 100, bad month string).
- Acceptance: a student with a 100% concession gets no `FeeRecord` in the next run. A student with 50% off a ₹2,000 fee gets ₹1,000. With the flag off, generation output is identical to today.

**Slice 2: Participation profile + inclusion report**
- Objective: optional gender and support-needs fields, and an aggregate report.
- Files: schema + SQL. A small form section on `/student/[id]` (parent edits their own child, admin edits in-org). `CoachBatchRoster.tsx` shows the support-needs note to the batch coach. New `src/app/actions/inclusion-report.ts` (`getInclusionReport()`), using `groupBy` on gender and batch plus concession sums. A pure helper `summariseInclusion(rows)` in `src/lib/concessions.ts` (or `src/lib/inclusion.ts`). A card on the admin Analytics tab.
- Permission/tenancy: the report requires `checkPermission("reports.view")` and returns **counts only**, never names. It suppresses any cell with fewer than 3 students (shown as "<3") so a single child cannot be identified. `supportNeeds` is readable only by ADMIN-app members and coaches of the student's batch, and is never included in exports, the public `/academy/[slug]` page or community feeds.
- Audit: `STUDENT_PARTICIPATION_UPDATED` `{studentId, fields}` (no values).
- Tests: `summariseInclusion` covering percentages, small-cell suppression, and UNDISCLOSED/null bucketed together.
- Acceptance: the report matches a manual count on seed data. A parent cannot read another child's fields.

## 7. Feature flag

`FEATURES.inclusive = flag("INCLUSIVE", false)`, i.e. `NEXT_PUBLIC_FEATURE_INCLUSIVE`. It gates the concession UI and actions, applying concessions in both fee generators, the participation fields and the inclusion report. Default **off**. Because applying concessions changes billing, flipping the flag affects money: turn it on per academy pilot only after slice 1 tests pass.

## 8. Dependencies

- **Vertical 1 (Academy operations):** the fee engine (`src/lib/fees.ts`, both monthly generators, the `api/cron/monthly-fees` route), the student profile, `fees.manage`/`reports.view` permissions, and the audit log. Any refactor of fee generation in V1 must keep the single `resolveStudentFee` → `applyConcession` path.
- **Vertical 12 (Wellness):** `supportNeeds` borders on health data. If the founder classes it as health data, gate it on `health.view` instead.
- **Vertical 9 (Sponsorship):** sponsor-funded scholarships would link to `FeeConcession`, perhaps through an optional `sponsorId` later. Not in v1.
- **Vertical 7 (Communities):** none. Concession status must never appear on boards.
- **Vertical 11 (Marketplace):** free kit for scholarship students is out of scope for v1.

## 9. Risks and open questions for the founder

1. **Fix `feeOverride = 0`?** Today 0 means "not set". Leaving it alone and using `FeeConcession` for waivers is the safest choice. Agree?
2. **Current-month records.** When a concession is granted mid-month, should the existing PENDING `FeeRecord` be reduced automatically (an audited write to a money record), or left for the admin to adjust?
3. **Coupons.** They exist but are never applied, and `Coupon.code` is unique across all academies (two academies cannot both have `SIBLING15`). Should coupons be retired in favour of concessions, or fixed in Vertical 1?
4. **Gender field.** Is an optional, parent-controlled gender field acceptable for pilots? Should girls-only batches simply be named batches (no new field), or do you want `Batch.audience` later?
5. **Support needs vs health data.** Should `supportNeeds` follow the V12 `health.view` rule?
6. **Reporting threshold.** Is a small-cell suppression threshold of 3 acceptable, given that pilot academies may have few students per batch?
