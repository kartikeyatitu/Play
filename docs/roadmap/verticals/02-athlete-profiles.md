# Vertical 2 — Athlete profiles

> Verified by reading code on branch `feat/academy-os-branches`, 2026-10-25. No DB or Vercel access used.

## 1. Goal

Turn the per-academy `Student` row into an athlete profile that coaches, parents and the child are proud
of: who the athlete is (sport, position, dominant side, photo), how they are developing (monthly
sport-specific ratings plus measured tests like sprint time or height), and what they have done
(highlights, incidents, attendance). Coaches record it in seconds from the roster; parents see a clean,
private profile and a printable "athlete card". Everything stays inside one academy in v1.

## 2. Verified today

| Capability | Evidence | Status |
|---|---|---|
| Profile page | `src/app/student/[id]/page.tsx` — role-scoped load (PARENT by `parentId`, COACH by own batches, ADMIN by `orgId`); shows batches, attendance (last 20), fees, `PlayerAnalytics`, incidents, media, `MedicalForm` | working |
| Medical display bug | same page renders `{student.medicalInfo}` raw, but `updateMedicalInfo` (`src/app/actions/medical.ts`) stores `JSON.stringify(rest)` → parents/admins see a JSON string. `parseMedicalInfo` in `src/lib/coach.ts` already parses it (used by `AthleteSpotlightModal.tsx`) | partial (bug) |
| Attendance order on profile | `attendances: { orderBy: { sessionId: "desc" } }` — cuid order, not session date (parent page correctly uses `session: { date: 'desc' }` in `src/app/parent/page.tsx`) | partial (bug) |
| Basic identity fields | `Student`: `name`, `dob?`, `bloodGroup?`, `medicalInfo?` (JSON string), `dietPlanUrl?`, `points`, `feeOverride?` | working; no photo, position, dominant side, gender |
| Monthly skill evaluation | `SkillReport` (unique `studentId+month`, legacy `technique/fitness/discipline`, `sport`, `metrics Json`); `submitSkillReport` in `src/app/actions/reports.ts` (coach-scope, upsert); `EvaluateModal.tsx` driven by `getSportConfig` in `src/lib/sport-metrics.ts` | working; no audit log; `SkillReport.orgId` nullable, no relation |
| Skill visualisation | `src/components/analytics/PlayerAnalytics.tsx`; parent `ProgressTimeline.tsx` (uses `unifyMetrics`), `MonthlyReport.tsx` (print window) | working |
| Auto progress summary | `src/components/parent/AutoProgressReport.tsx` (wa.me share) — not imported by any page (grep) | UI-only, unused |
| Highlight media | `Media` (title, `videoUrl`); `addHighlightReel` in `src/app/actions/media.ts` (coach-scope, `safeHttpUrl`); `MediaFeed.tsx` on parent page | working (links only, no upload; no audit) |
| Incidents | `Incident`; `reportIncident` in `src/app/actions/incidents.ts` (coach-scope, `type`/`severity` not validated, no audit); shown to parents on profile page | partial |
| Physical measurements over time | no model; sport-metrics are 1–5 ratings only | missing |
| Coach quick view | `src/components/coach/AthleteSpotlightModal.tsx` (medical, parent call/WhatsApp, evaluate, media, incident, +10 pts) | working |
| Athlete identity across academies | `Student.orgId` single, `parentId` single; no shared athlete id | missing (by design) |
| Flag | `FEATURES.athleteOS` in `src/lib/features.ts` (env `NEXT_PUBLIC_FEATURE_ATHLETE_OS`), referenced nowhere else | defined, unused |

## 3. Gaps for a real v1

1. Profile shows broken medical text and mis-ordered attendance (two small, user-visible bugs).
2. No athlete attributes (photo, primary sport/position, dominant side) — the profile is a fee/attendance page.
3. No measured tests (height, weight, 20 m sprint, beep test, etc.) with history; academies sell
   "assessments" and cannot record them.
4. Writes to `SkillReport`, `Media`, `Incident` are not audited and `Incident.type/severity` are free strings.
5. No parent-friendly, printable/shareable athlete card (the `MonthlyReport` print is per-month only).
6. No consent/visibility model — required before anything leaves the academy (public profiles, scouting).

## 4. v1 scope

**In**
- Fix the two profile bugs (render parsed medical summary; order attendance by session date).
- Profile attributes on `Student`: `photoUrl`, `gender`, `primarySport`, `position`, `dominantSide`.
- `AthleteMeasurement` history: coach/admin records a test value; profile charts the trend.
- Audit + validation for skill reports, media, incidents (behaviour otherwise unchanged).
- Private, printable athlete card at `/student/[id]/card` (same access rules as the profile).

**Out (explicitly)**
- Public profiles, shareable public URLs, scouting/marketplace exposure (`marketplace`, `coachOS` flags stay off).
- Cross-academy athlete identity / transfer of history between academies.
- Video upload/hosting (keep link-based `Media`), AI analysis, wearables.
- Child self-login.

## 5. Data model

```prisma
// Additive fields on Student (all nullable — existing rows untouched)
//   photoUrl     String?   // http(s) only, validated with safeHttpUrl
//   gender       String?   // M | F | X — optional, for age-group/gender categories
//   primarySport String?   // defaults in UI to first enrolled batch sport
//   position     String?   // free text per sport, e.g. "Wicketkeeper", "Striker"
//   dominantSide String?   // LEFT | RIGHT | BOTH

// New: measured tests over time (units differ, many per month, so SkillReport cannot hold them)
model AthleteMeasurement {
  id           String   @id @default(cuid())
  orgId        String
  studentId    String
  kind         String   // catalog key from src/lib/measurements.ts, e.g. HEIGHT_CM, SPRINT_20M_S
  value        Float
  unit         String   // denormalised from catalog at write time
  measuredAt   DateTime
  recordedById String
  notes        String?
  createdAt    DateTime @default(now())
  student      Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  @@index([orgId])
  @@index([studentId, kind, measuredAt])
}
```

Why a new table: `SkillReport` is unique per `(studentId, month)` and holds 1–5 ratings; tests are
real-unit values, often several per month, and need their own trend per kind. Measurement *definitions*
stay in code (`src/lib/measurements.ts`) — no definitions table in v1.

```sql
-- prisma/sql/<date>_athlete_profile.sql — additive. NOT APPLIED. Needs founder approval.
-- Apply BEFORE deploying code that selects the new Student columns.
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "gender" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "primarySport" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "position" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "dominantSide" TEXT;

CREATE TABLE IF NOT EXISTS "AthleteMeasurement" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "studentId" TEXT NOT NULL REFERENCES "Student"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "measuredAt" TIMESTAMP(3) NOT NULL,
  "recordedById" TEXT NOT NULL REFERENCES "User"("id"),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AthleteMeasurement_orgId_idx" ON "AthleteMeasurement"("orgId");
CREATE INDEX IF NOT EXISTS "AthleteMeasurement_student_kind_idx"
  ON "AthleteMeasurement"("studentId","kind","measuredAt");
ALTER TABLE "AthleteMeasurement" ENABLE ROW LEVEL SECURITY;
```

## 6. Build slices

**S1 — Profile bug fixes + profile view model (no schema).**
- Objective: correct what users already see; prepare a pure summary builder for later slices.
- Files: `src/app/student/[id]/page.tsx` (render `parseMedicalInfo(...)` summary instead of raw string;
  `orderBy: { session: { date: "desc" } }`); add `src/lib/athlete-profile.ts` (attendance %, current
  streak, latest skill average, per-dimension trend from `unifyMetrics`).
- Rule: unchanged access filter (later via V1 `src/lib/student-access.ts`).
- Audit: none. Tests: `src/lib/__tests__/athlete-profile.test.ts` (empty data, streak broken by absence, mixed legacy/metric reports).
- Accept: medical shows "Allergies: …" not `{"allergies":…}`; dots ordered by date. Ships unflagged (bug fix).

**S2 — Audit + validation on existing athlete writes.**
- Files: `src/app/actions/reports.ts`, `media.ts`, `incidents.ts`; add `src/lib/incident-input.ts`
  (type ∈ INJURY|MISCONDUCT|OTHER, severity ∈ LOW|MEDIUM|HIGH, length caps) + test.
- Rule: keep current coach-scope (`enrollments.some.batch.coachId = session.id`) and admin `orgId` scope.
- Audit: `SKILL_REPORT_SAVED` (`studentId`, `month`), `MEDIA_ADDED`, `INCIDENT_REPORTED` (`severity`).
- Accept: invalid incident type rejected with a message; audit rows visible in `AuditLogViewer.tsx`.

**S3 — Athlete attributes.**
- Files: schema fields + SQL above; `src/app/actions/athlete.ts` (`updateAthleteAttributes`);
  `src/lib/athlete-input.ts` (enum + `safeHttpUrl` for photo) + test; header block on profile page and an
  edit form in `AthleteSpotlightModal.tsx`, both behind `FEATURES.athleteOS`.
- Rule: ADMIN with `students.manage`, or COACH of a batch the student is enrolled in (`requireMember(["ADMIN","COACH"])`
  + scoped `findFirst`); PARENT may set `photoUrl` only for own child.
- Audit: `ATHLETE_PROFILE_UPDATED` (changed field names only, not values).
- Accept: flag off → page identical to S1; flag on → attributes editable and shown.

**S4 — Measurements.**
- Files: model + SQL; `src/lib/measurements.ts` (catalog: key, label, unit, min/max, "lower is better") + test;
  `src/app/actions/measurements.ts` (`recordMeasurement`, `deleteMeasurement`, `listMeasurements`);
  `src/components/coach/MeasureModal.tsx`; trend card on profile using existing recharts.
- Rule: same as S3 for write; read follows profile access; every query `where: { orgId: session.orgId, studentId }`.
- Audit: `MEASUREMENT_RECORDED`, `MEASUREMENT_DELETED`.
- Tests: catalog validation (range, unit), "personal best" helper respecting lower-is-better.
- Accept: coach records 20 m sprint for 3 dates; parent sees trend and personal best.

**S5 — Printable athlete card.**
- Files: `src/app/student/[id]/card/page.tsx` (server component, print CSS like `MonthlyReport.tsx`),
  reusing `athlete-profile.ts`.
- Rule: identical to profile access; no public token. Audit: none (read).
- Accept: A4/print renders photo, attributes, latest ratings, best measurements, attendance %; no medical data on the card.

## 7. Feature flag

`FEATURES.athleteOS` (`NEXT_PUBLIC_FEATURE_ATHLETE_OS`), already defined, default **off**. Gates S3–S5 UI
and actions (actions return `{ success:false }` when off). S1 and S2 are fixes and ship unflagged.

## 8. Dependencies

- V1: `src/lib/student-access.ts` (V1 S1) so multi-guardian access applies to profiles automatically.
- V8 Recognition shows awards on the profile and card; V10 Rewards shows points balance from the ledger.
- Later identity work (cross-academy athlete) is blocked by `User.phone` uniqueness + single `User.orgId` (see V1 risks).

## 9. Risks and open questions

- Photos of minors: store as links (like `Media`) or Vercel Blob (as `Organization.photos` does)? Need
  parental consent wording before upload goes live.
- Which measurement tests per sport should ship in the catalog? Need 1–2 academy coaches to pick.
- Should coaches (role default only `attendance.mark` in `src/lib/team.ts`) need a new permission like
  `athletes.assess`, or is "coach of the batch" enough? Current code uses batch-scope for coaches.
- `SkillReport.orgId`, `Media.orgId`, `Incident.orgId` are nullable with no FK; legacy null rows not checked
  (no DB access). `src/app/actions/store.ts` cites `scripts/tenancy-check.ts`, but that file is not in
  `scripts/` on this branch — a read-only count query should be run (with approval) before relying on `orgId`.
- Should incidents be visible to parents by default? Today they are, on the profile page.
