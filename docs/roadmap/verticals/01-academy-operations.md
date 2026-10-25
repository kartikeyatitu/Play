# Vertical 1 — Academy operations (remaining gaps)

> Branch at time of writing: `feat/academy-os-branches` (HEAD `2246ee2 feat(academy-os): branches`).
> Scope here is only what is still missing after PR #2 (FeeRecord.paymentMethod) and the Branch work.
> "Verified" = file opened and read on 2026-10-25. Nothing below was run against a database.

## 1. Goal

Give an academy owner one dependable back office: every child has the right guardians attached, batches
roll up into programs the academy actually sells ("U-12 Cricket Foundation"), and parents hear from the
academy through a channel that is logged, not just a `wa.me` link someone may or may not have tapped.
Coaches get a roster they can trust; parents get a login that works without staff minting links by hand.

## 2. Verified today

| Capability | Evidence | Status |
|---|---|---|
| Branches (locations) | `prisma/schema.prisma` model `Branch`, `Batch.branchId`; `src/app/actions/branches.ts` (list/create/update/delete, audited `BRANCH_*`); `prisma/sql/2026-10-25_branches.sql` (not applied) | working on branch, migration pending |
| Payment method on fees | `FeeRecord.paymentMethod` in schema; `prisma/sql/2026-10-25_fee_payment_method.sql`; `src/lib/payment-method.ts` + `src/lib/__tests__/payment-method.test.ts` | in flight (PR #2) |
| Single guardian per student | `Student.parentId String` (required) → one `User`; `createStudent` in `src/app/actions/users.ts` find-or-creates one parent by phone | working, but single |
| Guardian across academies | `createStudent` throws "This phone number is registered with another academy" (`User.phone @unique`, `User.orgId` single) | missing (blocked by design) |
| Parent access scope | `studentAccessWhere` in `src/app/actions/medical.ts`, access filter in `src/app/student/[id]/page.tsx`, `src/app/parent/page.tsx` all use `parentId: session.id` | working for one guardian; `parentId` appears in 25 files under `src/app` + `src/components` |
| Program above Batch | no `Program` model; `Batch` has `name`, `sport`, `schedule`, `monthlyFee`, `capacity`, `branchId`; `FeePlan` (name/duration/amount/sport) is a pricing table, not linked to batches | missing |
| Fee resolution | `resolveStudentFee` in `src/lib/fees.ts`: `feeOverride → first batch monthlyFee → org.defaultMonthlyFee → 0` | working |
| Announcements | `src/app/actions/announcements.ts` `broadcastAnnouncement` (requires `settings.manage`, writes `Announcement`, no audit, no delivery); `Announcement.batchId` exists but the action never sets it | partial |
| WhatsApp to parents | `generateWhatsAppLink` (`src/lib/whatsapp.ts`) used by `BulkWhatsApp.tsx`, `WhatsAppTemplates.tsx` — opens `wa.me` per parent | UI-only (deep links) |
| WhatsApp Cloud API sender | `sendWhatsAppTemplate` in `src/lib/whatsapp.ts`; only caller is OTP in `src/app/actions/auth.ts`; `WHATSAPP_CONFIG.isConfigured` = `!!WHATSAPP_ACCESS_TOKEN` | built, unused for parent comms |
| Reminder log | `markReminderSent` in `src/app/actions/reminders.ts` writes `AuditLog` action `REMINDER_SENT_<type>` | working (manual "I sent it") |
| OTP login | `src/app/actions/auth.ts` (MSG91 / Twilio / WhatsApp-auth providers, `OTP_TEST_PHONES`), `src/lib/msg91.ts` | code present; provider env not configured (per brief — not verified in Vercel) |
| One-tap login links | `src/app/actions/login-links.ts` (`createLoginLink`, hashed token, 7-day TTL) | working (current workaround for OTP) |
| Rate limiting | `src/lib/rate-limit.ts` in-memory `Map` (known issue 4.G in `docs/known-issues.md`) | partial |

## 3. Gaps for a real v1

1. **Multi-guardian.** Separated parents, grandparents and drivers all need access and messages. Today the
   second guardian either shares the first parent's login or does not exist.
2. **Program entity.** Owners think in programs (fee, age band, curriculum) with several batches each.
   Today every batch repeats the fee and sport; reporting by program is impossible.
3. **Logged parent communication.** Messages leave via `wa.me` with no record of what was sent to whom,
   except the manual `REMINDER_SENT_*` audit rows. Batch-targeted announcements are modelled but unused.
4. **OTP live in production.** Provider keys + DLT template (India) and a shared rate limiter (4.G).
5. **Integrity debt that touches ops daily** (from `docs/known-issues.md`): 4.A enrolment update not
   atomic, 4.C duplicate conversions, 4.F trial booking not transactional. Tracked there, not re-planned here.

## 4. v1 scope

**In**
- `StudentGuardian` join table; primary guardian stays `Student.parentId` (no behaviour change for
  existing rows). Secondary guardians: view child, receive messages, pay fees.
- `Program` table + optional `Batch.programId`; program default fee slots into `resolveStudentFee`
  between batch fee and org default.
- Batch-targeted announcements (use existing `Announcement.batchId`) and an opt-in server-side
  WhatsApp template send when `WHATSAPP_CONFIG.isConfigured`, falling back to today's `wa.me` links.
  Every send (either path) logged in `AuditLog` (reusing the `REMINDER_SENT_*` convention).
- OTP go-live checklist (config only) + Upstash limiter swap (already specified in known issue 4.G).

**Out (explicitly)**
- Guardians that belong to a *different* academy (needs a cross-academy identity; see V2 risks).
- Program-level curriculum, term calendars, program pricing tiers (use existing `FeePlan`).
- Two-way WhatsApp inbox, delivery webhooks, SMS fallback for announcements.
- Re-modelling `Student.parentId` away. It stays the primary guardian.

## 5. Data model

```prisma
// New: many-to-many between students and guardian users (same academy only in v1).
model StudentGuardian {
  id            String   @id @default(cuid())
  orgId         String
  studentId     String
  userId        String
  relation      String   // MOTHER | FATHER | GUARDIAN | GRANDPARENT | OTHER
  isPrimary     Boolean  @default(false) // mirrors Student.parentId; exactly one per student
  receivesComms Boolean  @default(true)
  canPayFees    Boolean  @default(true)
  createdAt     DateTime @default(now())
  student       Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  user          User     @relation("GuardianOf", fields: [userId], references: [id], onDelete: Cascade)
  @@unique([studentId, userId])
  @@index([orgId])
  @@index([userId])
}

// New: commercial grouping above Batch.
model Program {
  id                String   @id @default(cuid())
  orgId             String
  org               Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  name              String
  sport             String?
  ageMin            Int?
  ageMax            Int?
  defaultMonthlyFee Int?
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  batches           Batch[]
  @@unique([orgId, name])
  @@index([orgId])
}

// Back-relations: Student.guardians StudentGuardian[]; User.guardianOf StudentGuardian[] @relation("GuardianOf");
// Organization.programs Program[]
// Additive field on Batch
//   programId String?
//   program   Program? @relation(fields: [programId], references: [id], onDelete: SetNull)
//   @@index([programId])
```

Why new tables: guardianship is many-to-many and cannot live on `Student` or `User` without breaking
`parentId`; `Program` has its own lifecycle (fee, age band, active flag) shared by many batches —
`FeePlan` is a price list with nullable `orgId` and no link to batches, so reusing it would overload it.
No new table for message logging: reuse `AuditLog` (`orgId, createdAt` index already exists).

```sql
-- prisma/sql/<date>_student_guardians.sql — additive. NOT APPLIED. Needs founder approval.
CREATE TABLE IF NOT EXISTS "StudentGuardian" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "studentId" TEXT NOT NULL REFERENCES "Student"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "relation" TEXT NOT NULL DEFAULT 'GUARDIAN',
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "receivesComms" BOOLEAN NOT NULL DEFAULT true,
  "canPayFees" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "StudentGuardian_studentId_userId_key" ON "StudentGuardian"("studentId","userId");
CREATE INDEX IF NOT EXISTS "StudentGuardian_orgId_idx" ON "StudentGuardian"("orgId");
CREATE INDEX IF NOT EXISTS "StudentGuardian_userId_idx" ON "StudentGuardian"("userId");
ALTER TABLE "StudentGuardian" ENABLE ROW LEVEL SECURITY;
-- Backfill primary guardian rows (idempotent). Skips legacy students with NULL orgId.
INSERT INTO "StudentGuardian" ("id","orgId","studentId","userId","relation","isPrimary")
SELECT 'sg_' || s."id", s."orgId", s."id", s."parentId", 'GUARDIAN', true
FROM "Student" s WHERE s."orgId" IS NOT NULL
ON CONFLICT ("studentId","userId") DO NOTHING;

-- prisma/sql/<date>_programs.sql — additive. NOT APPLIED. Apply BEFORE deploying code with Batch.programId.
CREATE TABLE IF NOT EXISTS "Program" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL, "sport" TEXT, "ageMin" INTEGER, "ageMax" INTEGER,
  "defaultMonthlyFee" INTEGER, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Program_orgId_name_key" ON "Program"("orgId","name");
CREATE INDEX IF NOT EXISTS "Program_orgId_idx" ON "Program"("orgId");
ALTER TABLE "Program" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Batch" ADD COLUMN IF NOT EXISTS "programId" TEXT REFERENCES "Program"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "Batch_programId_idx" ON "Batch"("programId");
```

## 6. Build slices

**S1 — Guardian access helper (no schema).**
- Objective: one place that builds "students this parent may see", so S2 is a one-line swap.
- Files: add `src/lib/student-access.ts` (pure: returns a Prisma-shaped `where` object, no Prisma import);
  replace inline filters in `src/app/student/[id]/page.tsx`, `src/app/actions/medical.ts`,
  `src/app/parent/page.tsx` (read paths only in this slice).
- Rule: PARENT → `parentId = session.id`; COACH → `orgId` + enrolled in a batch with `coachId = session.id`;
  ADMIN → `orgId` (callers keep their existing `requirePermission`).
- Audit: none (read-only refactor). Tests: `src/lib/__tests__/student-access.test.ts` (each role, null orgId → `__no_org__`).
- Accept: identical query output for all three roles; no UI change.

**S2 — Additional guardians.**
- Objective: admin adds a second guardian by phone; that guardian logs in and sees the child.
- Files: schema `StudentGuardian`; SQL above; `src/app/actions/guardians.ts` (`addGuardian`, `removeGuardian`,
  `listGuardians`); `src/lib/guardian-input.ts` (+ test); extend `student-access.ts` PARENT branch to
  `OR: [{ parentId }, { guardians: { some: { userId } } }]`; small "Guardians" card in `StudentDetailDrawer.tsx` behind flag.
- Rule: `checkPermission("students.manage")`; student and new user must share `session.orgId`; reuse
  `createStudent`'s cross-academy phone refusal. Cannot remove the primary guardian here.
- Audit: `GUARDIAN_ADDED`, `GUARDIAN_REMOVED` (`studentId`, `userId`, `relation`).
- Tests: input parsing (relation enum, phone normalisation via `src/lib/phone.ts`); access helper OR branch.
- Accept: with flag off, nothing renders and access is unchanged; with flag on, guardian 2 sees the child on `/parent`.

**S3 — Programs.**
- Files: schema `Program` + `Batch.programId`; SQL above; `src/app/actions/programs.ts`;
  `src/lib/program-input.ts` (+ test); extend `resolveStudentFee` in `src/lib/fees.ts` with a
  `programFees` input (+ new `src/lib/__tests__/fees.test.ts`); `ProgramsCard.tsx` modelled on `BranchesCard.tsx`.
- Rule: list needs `batches.manage`; create/update/delete need `batches.manage` (not settings — programs are
  day-to-day); every lookup `where: { id, orgId: session.orgId }`; batch assignment checks both rows share orgId.
- Audit: `PROGRAM_CREATED|UPDATED|DELETED`, `BATCH_PROGRAM_SET`.
- Accept: fee order becomes `feeOverride → batch → program → org default`; batches without a program unchanged.

**S4 — Batch-targeted, logged announcements.**
- Files: `src/app/actions/announcements.ts` (accept optional `batchId`, validate in-org); `src/lib/comms.ts`
  (pure: recipient list from guardians with `receivesComms`, dedupe by phone; + test); send path calls
  `sendWhatsAppTemplate` only if `WHATSAPP_CONFIG.isConfigured`, else returns `wa.me` links as today.
- Rule: keep `settings.manage` for whole-academy; allow `batches.manage` for a single batch.
- Audit: `ANNOUNCEMENT_SENT` (`announcementId`, `batchId`, `recipientCount`, `channel: API|DEEPLINK`).
- Accept: parent `/parent` shows only academy-wide + own-batch announcements; one audit row per send.

**S5 — OTP go-live (config + limiter).** Ops checklist (MSG91 `authkey`, DLT template id, `SMS_PROVIDER`)
plus the Upstash swap specified in known issue 4.G. Audit: existing. Tests: limiter key builder.
Accept: a real (non-test) Indian number receives an OTP on preview; 6th attempt in window is refused across instances.

## 7. Feature flag

`NEXT_PUBLIC_FEATURE_ACADEMY_OPS_V2` → `FEATURES.academyOpsV2`, default **off**. Gates: guardian card +
guardian-aware parent access (S2), Programs card and program fee step (S3), batch targeting + API send (S4).
S1 is a behaviour-neutral refactor and ships unflagged. S5 is config.

## 8. Dependencies

- Needs: Branch SQL and PR #2 SQL applied first (Prisma selects all columns).
- Feeds V2 (profile page uses `student-access.ts`), V8/V10 (who gets notified of awards/rewards = guardians
  with `receivesComms`), referral conversion in V10 (lead/trial conversion in `src/app/actions/leads.ts`,
  `src/app/actions/trial-convert.ts`).

## 9. Risks and open questions

- **Cross-academy parents.** `User.phone` is globally unique and `User.orgId` is single, so a parent with
  kids at two academies is refused today. Do we accept that for v1? (Recommend yes; fix with identity work.)
- Do secondary guardians get *fee reminders*, or only the primary? (`canPayFees` default proposed: true.)
- WhatsApp Cloud API cost and template approval per academy vs one Triq-wide sender number — whose number?
- Program vs `FeePlan`: should quarterly/annual plans hang off Program later? Not in v1.
- `Announcement` has no audit or read tracking; "did the parent see it" is out of scope.
- Unverified: whether OTP env vars are set in Vercel (I did not check Vercel).
