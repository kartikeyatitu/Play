# TRIQ Athlete — Vertical 2 specification

> Scope source: `docs/specs/SCOPE-11-VERTICALS.txt` (Vertical 2). Reuses verified findings from
> `docs/roadmap/verticals/02-athlete-profiles.md`, `08-recognition.md`, `14-international-opportunities.md`.
> Code verified on `origin/main` @ 5ab2358, 2026-10-26. No DB/Vercel access used.

## 1. Product purpose and target users

A persistent sporting identity and development pathway for an athlete, starting inside the academy that trains them.

| User | Need |
|---|---|
| Parent / guardian (`User.role=PARENT`, `Student.parentId`) | See progress, keep achievements, apply to opportunities for their child, consent to sharing |
| Coach (`OrgMembership.role=COACH`, coach of a batch the athlete is enrolled in) | Assess, give feedback, set development goals, review achievements |
| Academy admin (OWNER / MANAGER with `students.manage`) | Verify achievements, publish opportunities, manage applications |
| Athlete (child) | No self-login in v1 (no child accounts exist; `User` has no DOB) |

## 2. User roles and permissions

| Action | Parent (own child) | Coach (batch scope) | Admin `students.manage` | Notes |
|---|---|---|---|---|
| View profile / monthly progress report | yes | yes | yes | Same filter as `src/app/student/[id]/page.tsx` |
| Share report via WhatsApp | yes (wa.me share) | yes (wa.me to parent phone) | yes | Deep link only, nothing sent server-side |
| Submit achievement | yes → SUBMITTED | yes → SUBMITTED | yes → SUBMITTED | |
| Mark achievement REVIEWED | no | yes | yes | |
| VERIFY / REJECT achievement | no | no | yes | Only academy staff with `students.manage` |
| Set / update development goal | no (read) | yes | yes | |
| Publish opportunity | no | no | yes | |
| Apply to opportunity | yes, with guardian consent | no | no | |
| Change application status | no (withdraw only) | no | yes | Every change appended to history |

Coach batch scope = `student.enrollments.some.batch.coachId = session.id AND batch.orgId = session.orgId` (existing rule in `src/app/actions/reports.ts`).

## 3. Complete feature inventory

| # | Feature group (scope) | v1 slice | Flag |
|---|---|---|---|
| F1 | Athlete identity and sporting profile | existing `/student/[id]`; attributes (photo/position) later | `athleteOS` |
| F2 | Sport, position, level, experience | later (needs Student columns — deferred, see §16) | `athleteOS` |
| F3 | Achievements and competition history | **built**: `AthleteAchievement` with SUBMITTED/REVIEWED/VERIFIED/REJECTED | `athleteOS` |
| F4 | Training history and development goals | training history = attendance (exists); **goals built** (`AthleteGoal`) | `athleteOS` |
| F5 | Coach feedback and progress reports | **built**: monthly progress report page from attendance + `SkillReport` | `progressReport` |
| F6 | Skill and fitness assessments | `SkillReport` (exists); measured tests (`AthleteMeasurement`) later | — |
| F7 | Portfolio and permitted media | `Media` links exist; consent per media later | — |
| F8 | Profile privacy and verification status | achievements carry explicit status; no public profile exists | `athleteOS` |
| F9 | Trials, scholarships, recruitment opportunities | **built**: academy opportunities board | `opportunities` |
| F10 | Applications and application history | **built**: `OpportunityApplication` + `OpportunityApplicationEvent` | `opportunities` |
| F11 | Saved opportunities | later (status `SAVED` reserved, not exposed) | `opportunities` |
| F12 | Development timeline | later: merge attendance, reports, goals, achievements by date | `athleteOS` |
| F13 | Guardian consent, age-appropriate access | consent required on application; no child login; no public pages | all |

## 4. Screen and navigation specification

| Screen | Route / component | Who |
|---|---|---|
| Athlete profile (existing) | `/student/[id]` (`src/app/student/[id]/page.tsx`) | parent, coach, admin |
| Monthly progress report (printable) | `/student/[id]/report?month=YYYY-MM` | same access as profile |
| Achievements + goals panel | section on `/student/[id]` (`src/components/athlete/AthletePanel.tsx`) | all three, role-dependent buttons |
| Opportunities admin | Admin More → "Opportunities" tab (`src/components/org/OpportunitiesPanel.tsx`) | admin |
| Opportunities for parents | Parent "More" tab card (`src/components/parent/OpportunitiesCard.tsx`) | parent |

Entry points: profile header links "Monthly report"; parent "My Children" card links to the profile/report when flags are on.

## 5. Field-level definitions and validation

**Monthly report input**: `month` = `YYYY-MM`, must be ≤ current month in org timezone; default current month.

**AthleteAchievement** (`src/lib/athlete.ts` `parseAchievementInput`)

| Field | Type | Rule |
|---|---|---|
| kind | enum ACHIEVEMENT, COMPETITION | required |
| title | string | 3–120 chars, trimmed |
| competition | string? | ≤ 120 |
| level | enum CLUB, SCHOOL, DISTRICT, STATE, NATIONAL, INTERNATIONAL, OTHER | default OTHER |
| result | string? | ≤ 80 (e.g. "Gold", "Runner-up", "3rd of 24") |
| eventDate | date | required, not in the future, not before 1990 |
| evidenceUrl | string? | http(s) only via `safeHttpUrl` |
| notes | string? | ≤ 500 |

**AthleteGoal** (`parseGoalInput`): title 3–120; `metric` ≤ 60; `baseline`/`target` optional numbers; `dueDate` optional, not in the past at creation; notes ≤ 500.

**Opportunity** (`src/lib/opportunities.ts` `parseOpportunityInput`): title 3–120; kind ∈ TRIAL, SCHOLARSHIP, CAMP, TOURNAMENT, RECRUITMENT, OTHER; sport ≤ 40; location ≤ 120; `applyBy` ≥ today at publish; `startDate ≤ endDate`; `ageMin ≤ ageMax` within 3–30; `url` http(s); description ≤ 2000; `batchId` must belong to org.

**OpportunityApplication**: `guardianConsent` must be `true`; note ≤ 500.

## 6. End-to-end user journeys

1. *Create athlete profile* — admin registers student (existing V1 flow); profile exists at `/student/[id]`.
2. *Connect to academy/coach* — enrollment in a batch (existing).
3. *View training history and progress* — profile attendance + monthly report page for any past month.
4. *Receive coach assessments* — coach submits `SkillReport` (existing `EvaluateModal`); report page shows ratings, deltas vs previous month, coach note.
5. *Maintain achievements* — parent adds "District U-14 — Runner-up" → SUBMITTED; coach marks REVIEWED; admin VERIFIES; profile shows a "Verified by academy" badge only when VERIFIED.
6. *Discover trials/scholarships* — admin publishes opportunity targeted at a batch; parent sees it in the parent app if a child is eligible.
7. *Apply and track status* — parent applies with consent; admin moves APPLIED → SHORTLISTED → SELECTED / NOT_SELECTED; parent sees status and history.
8. *Share selected profile info* — v1: parent shares report via WhatsApp themselves; organization-to-organization sharing deferred (§16).

## 7. Business rules and state transitions

**Achievement status** (`nextAchievementStatus` in `src/lib/athlete.ts`)

```
SUBMITTED --review(coach|admin)--> REVIEWED --verify(admin)--> VERIFIED
SUBMITTED|REVIEWED --reject(admin, reason)--> REJECTED
SUBMITTED --verify(admin)--> VERIFIED          (admin may verify directly)
any --edit by submitter/staff--> SUBMITTED     (editing a verified record drops verification)
VERIFIED --unverify(admin, reason)--> REVIEWED
```
Parents can edit/delete only their own SUBMITTED/REJECTED entries. Verified entries can only be deleted by admin.

**Goal status**: ACTIVE → ACHIEVED (sets `achievedAt`) | DROPPED; ACHIEVED/DROPPED → ACTIVE (reopen).

**Opportunity status**: DRAFT → OPEN → CLOSED; CLOSED → OPEN allowed if `applyBy` still in future. Applications only while OPEN and before end of `applyBy` day.

**Application status** (`canTransitionApplication`): APPLIED → SHORTLISTED | NOT_SELECTED | WITHDRAWN; SHORTLISTED → SELECTED | NOT_SELECTED | WITHDRAWN; SELECTED, NOT_SELECTED, WITHDRAWN terminal (admin may reopen NOT_SELECTED → SHORTLISTED). WITHDRAWN only by parent (from APPLIED/SHORTLISTED); a guardian may re-apply after withdrawing while the opportunity is open (new consent recorded). Each transition writes one `OpportunityApplicationEvent`.

**Eligibility**: child belongs to org; enrolled in target batch (or batch null); age from `Student.dob` within `ageMin/ageMax` on `startDate ?? applyBy` (if dob missing and an age band exists, application allowed but flagged "age not on file").

**Progress report attendance**: denominator = non-cancelled sessions in the month for the athlete's batches, on/after enrollment, up to now. LATE counts as attended, EXCUSED shown separately, sessions with no attendance row shown as "not marked" (never counted as absent). Skills from the month's `SkillReport` via `unifyMetrics`; delta vs most recent earlier report.

## 8. Database models and relationships

New tables only (no new columns on hot tables, so production keeps working before the SQL is applied). SQL: `prisma/sql/2026-10-26_athlete_vertical.sql`.

| Model | Key fields | Relations / indexes |
|---|---|---|
| `AthleteAchievement` | orgId, studentId, kind, title, competition?, level, result?, eventDate, evidenceUrl?, notes?, status, submittedById, reviewedById?, reviewedAt?, verifiedById?, verifiedAt?, rejectionReason? | FK Student (cascade), Organization (cascade); `@@index([orgId, status])`, `@@index([studentId, eventDate])` |
| `AthleteGoal` | orgId, studentId, setById, title, metric?, baseline?, target?, dueDate?, status, notes?, achievedAt? | FK Student; `@@index([orgId])`, `@@index([studentId, status])` |
| `Opportunity` | orgId, title, kind, sport?, location?, startDate?, endDate?, applyBy, ageMin?, ageMax?, url?, description?, batchId?, status, createdById | `@@index([orgId, status])` |
| `OpportunityApplication` | orgId, opportunityId, studentId, parentId, status, guardianConsent, consentAt, note? | `@@unique([opportunityId, studentId])`, `@@index([orgId, status])` |
| `OpportunityApplicationEvent` | orgId, applicationId, fromStatus?, toStatus, actorId, note?, createdAt | `@@index([applicationId, createdAt])` |

All added to `deleteAllData` order (`src/app/actions/delete.ts`) before `student`.

## 9. API contracts (server actions)

Monthly report: server-rendered in `src/app/student/[id]/report/page.tsx` (no action; reads `Session`, `Attendance`, `SkillReport` with the profile access filter from `src/lib/athlete-access.ts`).

`src/app/actions/athlete.ts` ("use server", all return `{ success: boolean; error?: string; ... }`, all refuse when flag off):

| Action | Input | Auth |
|---|---|---|
| `listAthleteRecords(studentId)` | | profile access → `{ achievements, goals, canReview, canVerify, canSetGoals }` |
| `submitAchievement(studentId, input)` / `updateAchievement(id, input)` / `deleteAchievement(id)` | | parent own child, coach scope, admin |
| `reviewAchievement(id, action, reason?)` action ∈ review, verify, reject, unverify | | review: coach scope or admin; others `students.manage` |
| `saveGoal(studentId, input, goalId?)` / `setGoalStatus(id, status)` | | coach scope or admin |

`src/app/actions/opportunities.ts`: `listOpportunitiesAdmin()`, `saveOpportunity(input, id?)`, `setOpportunityStatus(id, status)`, `listApplications(opportunityId)`, `setApplicationStatus(applicationId, status, note?)` (permission `students.manage`); `listOpportunitiesForParent()`, `applyToOpportunity(opportunityId, studentId, consent, note?)`, `withdrawApplication(applicationId)` (PARENT).

## 10. Error and edge-case behavior

- Flag off → actions return `{ success:false, error:"Not enabled" }`; UI not rendered; no new tables queried.
- Table missing (SQL not applied, flag on by mistake) → caught, returns "Feature not set up yet" instead of 500.
- Month with no sessions → report says "No sessions held this month", no percentage.
- No skill report → "Coach evaluation not submitted for this month"; never invent scores.
- Duplicate application → unique constraint → idempotent "Already applied".
- Opportunity closed between page load and apply → rejected with message.
- Student moved to another org → all queries scoped by `orgId`, record invisible.

## 11. Security and privacy requirements

- Every query includes `orgId` from the session; student access uses the same filter as the profile page.
- No public routes. No achievement, goal, report or application is reachable without login.
- Report page and WhatsApp text exclude medical info, blood group, DOB, diet plan, phone numbers.
- Only `students.manage` holders can set VERIFIED; the UI labels SUBMITTED/REVIEWED entries as "Not verified".
- Application requires explicit guardian consent (`guardianConsent=true`, `consentAt`), recorded in history.
- All mutations write `AuditLog` (`ACHIEVEMENT_SUBMITTED|REVIEWED|VERIFIED|REJECTED|UNVERIFIED|UPDATED|DELETED`, `GOAL_SAVED`, `GOAL_STATUS_CHANGED`, `OPPORTUNITY_SAVED`, `OPPORTUNITY_STATUS_CHANGED`, `OPPORTUNITY_APPLIED`, `APPLICATION_STATUS_CHANGED`, `APPLICATION_WITHDRAWN`). Details hold ids/status only, no free text about the child.

## 12. Dependencies on shared platform capabilities

Identity/membership (`src/lib/membership.ts`), permissions (`src/lib/team.ts`), org locale/timezone (`src/lib/i18n.ts`), WhatsApp deep links (`waLink`), audit log, `safeHttpUrl`. Future: guardian relationships (multi-guardian `student-access.ts`, V1), notifications service, verification/trust service (shared submitted/reviewed/verified states — this vertical's enum is designed to match).

## 13. Acceptance criteria

- AC1 With `progressReport` on, a parent opens `/student/<own child>/report?month=2026-09` and sees real held/attended/late/excused/unmarked counts, coach ratings with deltas and notes; prints on one A4 page; WhatsApp button opens wa.me with the text summary. Another parent's child → "Student not found".
- AC2 With `athleteOS` on, a parent's submitted achievement shows "Submitted — not verified"; a coach cannot verify (no button; action refuses); an admin verifies and the badge reads "Verified by <academy>".
- AC3 Editing a verified achievement resets it to SUBMITTED.
- AC4 Coach sets a goal; parent sees it; marking achieved stamps the date.
- AC5 With `opportunities` on, admin publishes a trial for batch B; only parents of children in B see it; applying without consent is refused; status changes appear in the parent's history list in order.
- AC6 All flags off → no UI change and no query against new tables.

## 14. Unit, integration and end-to-end tests

| Level | Test | File |
|---|---|---|
| Unit | report building (attendance buckets, unmarked, deltas, empty month, WhatsApp text excludes sensitive data) | `src/lib/__tests__/progress-report.test.ts` |
| Unit | achievement/goal input validation and status transitions incl. role rules | `src/lib/__tests__/athlete.test.ts` |
| Unit | opportunity parsing, eligibility, application transitions | `src/lib/__tests__/opportunities.test.ts` |
| Integration (todo) | actions against a test DB: tenancy, coach cannot verify, parent cannot apply for other child | needs DB harness (none in repo) |
| E2E (todo) | Playwright journey AC1–AC5 | `/e2e` |

## 15. Implementation status against the existing repository

| Feature group | Status | Evidence (verified) |
|---|---|---|
| Athlete identity / profile page | Partial | `src/app/student/[id]/page.tsx` — role-scoped load; medical summary already parsed (`parseMedicalInfo`), attendance ordered by `session.date` (both old-plan bugs fixed on main). No photo/position/level. |
| Sport, position, level, experience | Missing | `Student` has only name/dob/bloodGroup/medicalInfo/dietPlanUrl/points/feeOverride (`prisma/schema.prisma`) |
| Achievements & competition history | Missing → **built (flagged)** | no model before; now `AthleteAchievement` |
| Training history | Partial | attendance on profile (last 20) and parent page; no full history view |
| Development goals | Missing → **built (flagged)** | `AthleteGoal` |
| Coach feedback | Complete (basic) | `SkillReport` + `submitSkillReport` (`src/app/actions/reports.ts`, no audit log) + `EvaluateModal.tsx` |
| Progress reports | Partial → **built (flagged)** | `src/components/parent/MonthlyReport.tsx` uses last 10 attendances and legacy 3 ratings regardless of month (inaccurate); `AutoProgressReport.tsx` unused. New report page uses real month data. |
| Skill & fitness assessments | Partial | 1–5 ratings via `src/lib/sport-metrics.ts`; no measured tests |
| Portfolio & media | Partial | `Media` links, `src/app/actions/media.ts`; no consent per item |
| Privacy & verification status | Missing → **Partial** | achievement status; no profile visibility settings (no public profile exists, which is the safe default) |
| Opportunities, applications, history | Missing → **built (flagged)** | grep for scholarship/trial-abroad found nothing before |
| Saved opportunities | Missing | — |
| Development timeline | Missing | — |
| Guardian consent | Missing → **Partial** | consent on applications only |
| Flags | `athleteOS` (previously unread) now gates achievements/goals; `progressReport`, `opportunities` added in `src/lib/features.ts` |

Built on branch `build/v-athlete-education` (all default OFF):
- `progressReport`: `src/lib/progress-report.ts`, `src/app/student/[id]/report/page.tsx`, `src/components/athlete/ReportActions.tsx`, links in `src/app/student/[id]/page.tsx` and `src/components/parent/ParentClient.tsx`.
- `athleteOS`: `src/lib/athlete.ts`, `src/app/actions/athlete.ts`, `src/components/athlete/AthletePanel.tsx` (on the profile page).
- `opportunities`: `src/lib/opportunities.ts`, `src/app/actions/opportunities.ts`, `src/components/org/OpportunitiesPanel.tsx` (Admin More), `src/components/parent/OpportunitiesCard.tsx` (Parent More).
- Shared: `src/lib/athlete-access.ts`, `src/lib/schema-pending.ts`; deletion order in `src/app/actions/delete.ts`.

## 16. Release dependencies and unresolved decisions

- SQL `prisma/sql/2026-10-26_athlete_vertical.sql` must be applied before enabling `athleteOS` / `opportunities` (`progressReport` needs no SQL).
- Athlete attributes (photo, position, level) need new `Student` columns; deferred because Prisma selects all columns by default, so the SQL must be applied before that deploy. Alternative: `AthleteProfile` side table (preferred).
- Should coaches be allowed to verify? Current decision: no (scope: "only academy staff verify" = `students.manage`).
- Cross-academy athlete identity and org-to-org profile sharing: blocked on shared identity model (single `Student.orgId`, single `parentId`).
- Opportunity liability copy ("Shared by <academy>; TRIQ does not verify this opportunity") — included in UI; founder to confirm wording.
- Integration test harness with a disposable Postgres is missing repo-wide.
