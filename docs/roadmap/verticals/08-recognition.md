# Vertical 8 — Recognition

> Verified by reading code on branch `feat/academy-os-branches`, 2026-10-25. No DB or Vercel access used.

## 1. Goal

Let academies celebrate athletes in a way that is fair, durable and shareable with family: automatic
badges for effort (attendance streaks, consistency, improvement), coach-given awards ("Player of the
Month", "Best Bowler — Summer Camp"), and certificates that carry a number and can be verified. Parents
see a trophy shelf for their child; coaches can recognise a kid in two taps from the roster; owners get a
retention tool that costs nothing. Recognition is about status, not currency — points and redeemable
rewards are Vertical 10.

## 2. Verified today

| Capability | Evidence | Status |
|---|---|---|
| Badge catalogue (10 badges) | `src/components/parent/AchievementBadges.tsx` — computed client-side from attendances, `points`, skill reports; nothing stored | UI-only, **not rendered anywhere** (grep: no importer) |
| Streak indicator | `src/components/parent/AttendanceStreak.tsx`, rendered in `ParentClient.tsx` "children" tab; input is last 10 attendances ordered by `session.date desc` (`src/app/parent/page.tsx`) | working (display only) |
| Badge streak logic correctness | `AchievementBadges` counts streak from array order; on `/student/[id]` attendances are ordered by `sessionId` (cuid), not date | partial (would be wrong if reused there) |
| Academy leaderboard (admin) | `src/components/org/Leaderboard.tsx` (top 10 by points) | UI-only, **not rendered anywhere** |
| Parent leaderboard | `GamificationWidget.tsx` in `ParentClient.tsx`; data = top 10 students of the org by `points` with `name` (`src/app/parent/page.tsx`) — every parent sees other children's first names and points | working (privacy concern) |
| Certificates | `src/components/org/CertificateGenerator.tsx` — free-text name/sport/duration, `window.print()`, not stored, no number; rendered only in the Events tab (`AdminClient.tsx`, behind `FEATURES.events`, default off) | UI-only, hidden |
| "Spotlight" | `src/components/coach/AthleteSpotlightModal.tsx` is a coach quick-view of one athlete (medical, evaluate, media, +10 pts). It does not publish recognition, despite `docs/audits/feature-inventory.md` describing it as "Highlight a standout performance" | not recognition |
| Coach "+10 PTS" | `CoachActions.tsx` → `awardPoints` (`src/app/actions/gamification.ts`): no reason, no audit | working (V10 owns it) |
| Shareable public page precedent | `src/app/r/[token]` (receipt by token), `Receipt.token @unique` | working pattern to copy |
| Scheduled jobs precedent | `vercel.json` cron `/api/cron/monthly-fees`; route fails closed without `CRON_SECRET` | working pattern to copy |
| Stored awards / history | no model | missing |

Note: `docs/audits/feature-inventory.md` marks `AchievementBadges`, `Leaderboard`, `CertificateGenerator`
as ✅. The code shows the first two are never mounted and the third is behind an off flag — treat those
ticks as *claimed*, not verified.

## 3. Gaps for a real v1

1. Nothing is stored: a badge "earned" disappears if attendance data changes; there is no history or date earned.
2. No coach/admin-given awards with a reason.
3. Certificates are untracked prints with typed names — no link to the student, no number, no verification.
4. Leaderboard exposes minors' names and scores to all parents with no opt-out.
5. No notification to parents when their child is recognised.

## 4. v1 scope

**In**
- Badge rules moved into a pure, tested library (`src/lib/recognition.ts`), with streak computed from
  date-ordered attendance.
- `Recognition` table storing auto badges (idempotent) and manual awards (coach/admin with reason).
- Trophy shelf on parent "children" tab and on `/student/[id]`; "Recognise" button in the coach roster/spotlight.
- Certificates issued *from* a recognition: numbered, printable, verifiable at `/v/[token]` showing
  minimal data (first name + last initial, academy, title, date).
- Leaderboard privacy: academy setting to hide the parent leaderboard or show first names only (default: first names only, as today).
- Parent notification through V1's logged channel (deep-link fallback).

**Out (explicitly)**
- Custom badge designer / academy-defined badge rules (catalogue is code-defined in v1).
- Cross-academy or public athlete trophy pages, social auto-posting (`InstagramGenerator.tsx` stays experimental).
- Tournament results / medals (Events vertical).
- Points side-effects of recognition (V10 decides whether an award grants points).

## 5. Data model

```prisma
model Recognition {
  id            String    @id @default(cuid())
  orgId         String
  studentId     String
  kind          String    // BADGE | AWARD
  key           String?   // BADGE: catalogue key (e.g. STREAK_10). AWARD: null
  title         String    // "10-Session Streak", "Player of the Month"
  reason        String?   // required for AWARD
  period        String?   // "YYYY-MM" for monthly awards
  batchId       String?   // optional context
  awardedById   String?   // null = system (auto badge)
  certificateNo String?   @unique  // e.g. "TRQ-<orgslug>-000123", set when a certificate is issued
  verifyToken   String?   @unique  // random, only set with certificateNo
  revokedAt     DateTime?
  revokedReason String?
  createdAt     DateTime  @default(now())
  student       Student   @relation(fields: [studentId], references: [id], onDelete: Cascade)
  @@unique([studentId, key])   // one row per auto badge per student; NULL keys (awards) are not constrained
  @@index([orgId, createdAt])
  @@index([studentId])
}
// Additive on Organization: leaderboardMode String @default("FIRST_NAME") // HIDDEN | FIRST_NAME | FULL
```

Why a new table: no existing model holds per-student achievements. `AuditLog` is for staff actions and has
no student column; `Media` is links to videos. One table covers badges, awards and certificates so the
trophy shelf is one query. Certificates are a property of a recognition, not a separate entity.

```sql
-- prisma/sql/<date>_recognition.sql — additive. NOT APPLIED. Needs founder approval.
CREATE TABLE IF NOT EXISTS "Recognition" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "studentId" TEXT NOT NULL REFERENCES "Student"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "key" TEXT,
  "title" TEXT NOT NULL,
  "reason" TEXT,
  "period" TEXT,
  "batchId" TEXT REFERENCES "Batch"("id") ON DELETE SET NULL,
  "awardedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "certificateNo" TEXT,
  "verifyToken" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revokedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Recognition_studentId_key_key" ON "Recognition"("studentId","key");
CREATE UNIQUE INDEX IF NOT EXISTS "Recognition_certificateNo_key" ON "Recognition"("certificateNo");
CREATE UNIQUE INDEX IF NOT EXISTS "Recognition_verifyToken_key" ON "Recognition"("verifyToken");
CREATE INDEX IF NOT EXISTS "Recognition_orgId_createdAt_idx" ON "Recognition"("orgId","createdAt");
CREATE INDEX IF NOT EXISTS "Recognition_studentId_idx" ON "Recognition"("studentId");
ALTER TABLE "Recognition" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "leaderboardMode" TEXT NOT NULL DEFAULT 'FIRST_NAME';
```

## 6. Build slices

**S1 — Badge rules library (no schema).**
- Objective: one tested source of truth for badge eligibility; fixes order-dependence.
- Files: add `src/lib/recognition.ts` (`BADGES` catalogue, `evaluateBadges({attendances:[{date,isPresent}], skillAverages, ...})`
  → earned keys; streak computed after sorting by date); `AchievementBadges.tsx` switched to call it
  (component stays unmounted unless flag on).
- Rule: pure; no data access. Audit: none.
- Tests: `src/lib/__tests__/recognition.test.ts` — unsorted input, absence breaks streak, LATE/EXCUSED via
  `attendanceStatusOf` (`src/lib/coach.ts`), no sessions → only none earned.
- Accept: same 10 badges as today, deterministic regardless of input order. Decision needed: drop the two
  points-based badges ("Century Club", "Diamond Player") since points are currency (V10)?

**S2 — Recognition table + manual awards.**
- Files: model + SQL; `src/app/actions/recognition.ts` (`giveAward`, `revokeRecognition`, `listRecognitions`);
  `src/lib/recognition-input.ts` (title ≤ 80, reason 3–280 chars, period format) + test;
  `src/components/coach/RecognizeModal.tsx` opened from `AthleteSpotlightModal.tsx`.
- Rule: ADMIN with `students.manage`, or COACH of a batch the student is in (same scope as `submitSkillReport`);
  revoke = ADMIN `students.manage` only. All reads `where: { orgId: session.orgId }`; parents via
  `studentId` in their children (V1 `student-access.ts`).
- Audit: `RECOGNITION_AWARDED` (`recognitionId`, `studentId`, `title`), `RECOGNITION_REVOKED` (`reason`).
- Accept: coach gives "Player of the Month — Oct 2026"; parent sees it on the children tab; revoked items hidden from parents.

**S3 — Persist auto badges.**
- Files: `src/app/actions/recognition.ts` add `syncBadgesForOrg(orgId)` (internal, not exported from a page);
  `src/app/api/cron/recognition/route.ts` (Bearer `CRON_SECRET`, fail closed, same as monthly-fees);
  `vercel.json` cron daily (founder approves the config change).
- Rule: cron iterates orgs; every write carries the student's `orgId`; `createMany({ skipDuplicates: true })`
  on `(studentId, key)` makes it idempotent. Badges are never auto-removed (revocation is manual).
- Audit: one `BADGES_SYNCED` row per org per run (`created` count), `userId` = org owner (AuditLog.userId is required).
- Tests: diff helper "earned minus already stored" in `src/lib/recognition.ts`.
- Accept: re-running the cron creates zero new rows; trophy shelf shows the date each badge was earned.

**S4 — Numbered certificates + verification page.**
- Files: `src/app/actions/recognition.ts` `issueCertificate(recognitionId)`; `src/lib/certificate.ts`
  (number format, token via `crypto.randomBytes`) + test; printable `src/app/student/[id]/certificate/[rid]/page.tsx`
  reusing `CertificateGenerator` layout; public `src/app/v/[token]/page.tsx` modelled on `src/app/r/[token]`.
- Rule: issue = ADMIN `students.manage`; public page shows first name + last initial, academy name, title,
  date, and "revoked" if so — no DOB, phone, photo. Rate-limit lookups with `src/lib/rate-limit.ts`.
- Audit: `CERTIFICATE_ISSUED` (`certificateNo`).
- Accept: printed certificate shows number + QR/URL; revoking flips the public page to "revoked".

**S5 — Leaderboard privacy + parent notification.**
- Files: `Organization.leaderboardMode` (SQL above), toggle in `AcademySettings.tsx`; `src/app/parent/page.tsx`
  respects mode (HIDDEN → skip query); on award, send via V1 S4 comms helper.
- Rule: `settings.manage` for the toggle. Audit: `LEADERBOARD_MODE_CHANGED`, `RECOGNITION_NOTIFIED`.
- Accept: HIDDEN removes the leaderboard card from `GamificationWidget` without other UI changes.

## 7. Feature flag

`NEXT_PUBLIC_FEATURE_RECOGNITION` → `FEATURES.recognition`, default **off**. Gates trophy shelf, Recognize
button, certificate issue/verify routes, cron work (route returns 204 when off). S1 ships dark.
`CertificateGenerator` in the Events tab is left as-is (preserve existing frontend).

## 8. Dependencies

- V1: `student-access.ts` (parent visibility incl. extra guardians) and S4 logged comms for notifications.
- V2: trophy shelf and certificate shown on the athlete profile/card.
- V10: whether awards also grant points is decided there (a ledger entry keyed by `recognitionId`).

## 9. Risks and open questions

- Public verify page exposes a minor's name. Accept first name + initial, or require login? Founder call.
- Should coaches be allowed to give awards without admin approval? (Proposed: yes, with audit; admin can revoke.)
- Certificate numbering per academy vs global; academy logo/signature on certificates (needs upload).
- Retroactive badges: first cron run will award many badges at once — notify parents or backfill silently?
- Parent leaderboard is live today without consent; changing default to HIDDEN alters existing UI — decide.
