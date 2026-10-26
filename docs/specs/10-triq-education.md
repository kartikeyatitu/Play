# TRIQ Education — Vertical 10 specification

> Scope source: `docs/specs/SCOPE-11-VERTICALS.txt` (Vertical 10). No old 16-vertical plan covers schools;
> reuses V1 batch/attendance model and V2 opportunity model. Code verified on `origin/main` @ 5ab2358, 2026-10-26.

## 1. Product purpose and target users

Run sports participation inside schools, colleges and universities on the same tenant model as academies.

| User | Need |
|---|---|
| Institution sports admin / director of sport (OWNER/MANAGER of the org) | Set up institution profile, programs, teams; see participation |
| PE teacher / coach (COACH membership) | Run team/squad sessions, mark attendance, record participation |
| Student (minor or adult) | No login in v1 (same as academy athletes) |
| Parent / guardian (PARENT) | See own child's participation |

## 2. User roles and permissions

| Action | Admin `batches.manage` | Admin `students.manage` | Coach (team coach) | Parent |
|---|---|---|---|---|
| Edit institution profile | `settings.manage` | — | — | — |
| Create / archive programs | yes | — | — | — |
| Link a batch as team/squad | yes | — | — | — |
| Record participation | yes | yes | for own team's students | — |
| View participation | yes | yes | own teams | own child only |
| Institution report | `reports.view` | | | |

An institution is an `Organization` with an `InstitutionProfile` row; the existing membership/permission system applies unchanged.

## 3. Complete feature inventory

| # | Feature group | v1 | Status after this branch |
|---|---|---|---|
| E1 | Institution profiles | `InstitutionProfile` (kind SCHOOL/COLLEGE/UNIVERSITY, affiliation, levels) | **built (flagged)** |
| E2 | Sports departments and programs | `SportsProgram` | **built (flagged)** |
| E3 | Teams and squads | `ProgramTeam` maps a program to an existing `Batch` (roster, coach, sessions reused) | **built (flagged)** |
| E4 | Coaches and staff | existing `OrgMembership` + `Batch.coachId` | reused |
| E5 | Training schedules | existing `Batch.schedule` + `Session` | reused |
| E6 | Inter-school / inter-university events | later — depends on V3 Play competitions | Missing |
| E7 | Student participation records | `ParticipationRecord` + attendance of linked batches | **built (flagged)** |
| E8 | Competition results | participation record kind COMPETITION with result text; structured results via V3 later | Partial |
| E9 | Scholarships and applications | reuse V2 `Opportunity` (kind SCHOLARSHIP) | via V2 |
| E10 | Sports internships | reuse V2 `Opportunity` (kind OTHER→INTERNSHIP later) / V5 Careers | Missing |
| E11 | Institution-level reports | per-program counts (teams, students, sessions, attendance rate, records) | **built (flagged)** |
| E12 | Guardian permissions and age-appropriate access | parent sees only own child; no public pages; no student login | Partial |

## 4. Screen and navigation specification

| Screen | Where |
|---|---|
| Institution tab | Admin More → "Institution" (`src/components/org/InstitutionPanel.tsx`), only when `FEATURES.education` |
| — Profile card | kind, affiliation/board, levels offered, website |
| — Programs list | name, sport, team count, students, attendance %, archive |
| — Program detail | linked teams (batches) with coach + roster size; "Link batch as team"; participation records list + "Record participation" |

Students, batches, attendance and fees keep using the existing People / Batches screens.

## 5. Field-level definitions and validation (`src/lib/education.ts`)

| Model.field | Rule |
|---|---|
| InstitutionProfile.kind | SCHOOL, COLLEGE, UNIVERSITY (required) |
| .affiliation | ≤ 80 (e.g. "CBSE", "Delhi University") |
| .levels | ≤ 80 free text (e.g. "Grades 1–12") |
| .website | http(s) via `safeHttpUrl` |
| SportsProgram.name | 2–80 chars, unique per org (case-insensitive check in action) |
| .sport | 2–40 |
| .description | ≤ 500 |
| ProgramTeam.batchId | batch in same org; a batch belongs to at most one program (`@@unique([batchId])`) |
| .squadType | TEAM, SQUAD, CLUB |
| .ageGroup | ≤ 20 (e.g. "U-14") |
| .gender | BOYS, GIRLS, MIXED, or null |
| ParticipationRecord.kind | TRAINING, EVENT, COMPETITION, SELECTION, ACHIEVEMENT |
| .title | 3–120 |
| .date | required, not in the future |
| .role | ≤ 60 (e.g. "Captain") |
| .result | ≤ 80 |
| .notes | ≤ 500 |

## 6. End-to-end user journeys

1. *Institution establishes sports profile* — owner opens Institution tab, chooses SCHOOL, affiliation "CBSE".
2. *Staff create programs and teams* — manager creates "Football" program, links existing batch "U-14 Boys Football" as TEAM.
3. *Students join approved activities* — students are enrolled in the batch (existing enrollment; staff-approved by construction).
4. *Coaches manage schedules and participation* — coach marks session attendance (existing) and records "Inter-house final — Captain — Won".
5. *Institutions organize events* — deferred to V3 Play.
6. *Students discover scholarships* — via V2 opportunities board (kind SCHOLARSHIP).
7. *Administrators review participation* — program report: students, sessions held, attendance rate, records by kind.

## 7. Business rules and state transitions

- Program status ACTIVE ⇄ ARCHIVED; archived programs hidden from pickers but records retained.
- Linking a batch already linked to another program is refused. Unlinking removes the mapping only (batch, roster, attendance untouched).
- Participation record student must be enrolled in one of the program's team batches at record time (or the record is refused).
- Coaches can record only for students in batches they coach.
- Report metrics (documented): *students* = distinct students enrolled in linked batches; *sessions held* = non-cancelled sessions of linked batches dated ≤ now within the window (default last 90 days); *attendance rate* = attended (PRESENT/LATE) ÷ attendance rows marked in those sessions; unmarked sessions excluded and shown.

## 8. Database models and relationships

New tables only (SQL: `prisma/sql/2026-10-26_education.sql`). Organization is reused unchanged (no new column, so pre-migration production is unaffected).

| Model | Key fields | Constraints |
|---|---|---|
| `InstitutionProfile` | orgId (unique), kind, affiliation?, levels?, website?, updatedById | FK Organization cascade |
| `SportsProgram` | orgId, name, sport, description?, status | `@@index([orgId, status])` |
| `ProgramTeam` | orgId, programId, batchId (unique), squadType, ageGroup?, gender? | FK program cascade, batch cascade |
| `ParticipationRecord` | orgId, programId, studentId, teamId?, kind, title, date, role?, result?, notes?, recordedById | `@@index([orgId, programId, date])`, `@@index([studentId])` |

All in `deleteAllData` before `batch`/`student`.

## 9. API contracts (`src/app/actions/education.ts`)

| Action | Auth |
|---|---|
| `getInstitutionOverview()` → profile, programs with teams + metrics, linkable batches | member ADMIN (any active owner/manager) |
| `saveInstitutionProfile(input)` | `settings.manage` |
| `saveProgram(input, id?)`, `setProgramStatus(id, status)` | `batches.manage` |
| `linkTeam(programId, input)`, `unlinkTeam(teamId)` | `batches.manage` |
| `listParticipation(programId)` | `students.manage` or `reports.view` |
| `recordParticipation(programId, input)`, `deleteParticipation(id)` | `students.manage` (admin) |

Coach-side recording UI is a later slice (rule already in `canCoachRecord` design; action enforces batch scope when called by a coach).

## 10. Error and edge-case behavior

- Flag off → tab hidden, actions return "Not enabled".
- Tables missing → "Education is not set up yet (database migration pending)".
- Batch deleted → `ProgramTeam` cascades; participation records keep `programId`, `teamId` set null.
- Program with no teams → metrics show 0 and a prompt to link a batch.

## 11. Security and privacy requirements

- All queries scoped by `session.orgId`; ids from the client are re-checked with `findFirst({ id, orgId })`.
- No public routes; institution profile is not listed in the public directory in v1.
- Student data never leaves the institution; reports aggregate counts, list names only to staff.
- Participation records hold no health data. Audit: `INSTITUTION_PROFILE_SAVED`, `PROGRAM_SAVED`, `PROGRAM_STATUS_CHANGED`, `TEAM_LINKED`, `TEAM_UNLINKED`, `PARTICIPATION_RECORDED`, `PARTICIPATION_DELETED`.
- Guardian consent: needed before any external sharing (none in v1). Student login for 18+ college students deferred.

## 12. Dependencies on shared platform capabilities

Org/membership/permissions (V1 + shared), batches/sessions/attendance (V1), opportunities (V2) for scholarships, competitions (V3) for inter-school events, careers (V5) for internships, enterprise hierarchy (V11) for multi-campus universities.

## 13. Acceptance criteria

- AC1 Flag on: owner sets kind COLLEGE; reload shows it; audit row written.
- AC2 Manager creates program and links two batches; a third program cannot link an already-linked batch.
- AC3 Participation for a student not in the program's batches is refused.
- AC4 Program metrics match a hand count of sessions/attendance for the window; unmarked sessions are not counted as absent.
- AC5 A user from another org cannot read or mutate any program by id.
- AC6 Flag off: no Institution tab, no query against new tables.

## 14. Unit, integration and end-to-end tests

| Level | Test | File |
|---|---|---|
| Unit | input parsing, metric computation, link rules | `src/lib/__tests__/education.test.ts` |
| Integration (todo) | tenancy on actions | needs DB harness |
| E2E (todo) | AC1–AC4 | `/e2e` |

## 15. Implementation status against the existing repository

| Feature group | Status | Evidence |
|---|---|---|
| Institution profiles | Missing → **built (flagged)** | no school/college/university concept in `src` (grep hits only seed text, import heuristics, pricing copy); `Organization.businessType` = ACADEMY/TURF/BOTH (`src/app/actions/onboarding.ts`) |
| Departments / programs | Missing → **built (flagged)** | — |
| Teams / squads | Partial → **built (flagged)** | `Batch` + `BatchEnrollment` serve as rosters; now mapped via `ProgramTeam` |
| Coaches and staff | Complete (reused) | `OrgMembership`, `src/lib/team.ts` |
| Training schedules | Complete (reused) | `Batch.schedule`, `Session`, `src/app/actions/auto-sessions.ts` |
| Inter-institution events | Missing | `Event`/`TournamentBracket.tsx` behind `FEATURES.events` (off) — V3 scope |
| Participation records | Missing → **built (flagged)** | — |
| Competition results | Partial | text result on participation record only |
| Scholarships / internships | Missing (V2 opportunities give scholarships) | — |
| Institution reports | Missing → **Partial** | program metrics only |
| Guardian permissions | Partial | parent access is own-child only (existing pattern); no consent flow |

Built on branch `build/v-athlete-education` (flag `education`, default OFF): `src/lib/education.ts`, `src/app/actions/education.ts`, `src/components/org/InstitutionPanel.tsx` (Admin More → Institution), schema + `prisma/sql/2026-10-26_education.sql`, deletion order in `src/app/actions/delete.ts`. Coach-side recording UI not built (action already allows coaches of a linked batch). Parents do not yet see participation records.

## 16. Release dependencies and unresolved decisions

- Apply `prisma/sql/2026-10-26_education.sql` before enabling `NEXT_PUBLIC_FEATURE_EDUCATION`.
- Onboarding option "School / College / University" (businessType) — deferred; would touch onboarding validation and pricing copy (pricing is off-limits for this branch).
- Pricing/plan for institutions — founder decision.
- Multi-campus universities need V11 hierarchy.
- College students 18+ logging in themselves — needs child/adult identity model.
- Should participation records feed V2 achievements automatically? Proposed: no; keep separate, staff can promote later.
