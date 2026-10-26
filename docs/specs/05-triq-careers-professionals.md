# 05 — TRIQ Careers & Professionals

Status date: 2026-10-26. Branch `build/v-careers-wellness-creators`. Source of scope: `docs/specs/SCOPE-11-VERTICALS.txt` §Vertical 5. Prior plan reused: `docs/roadmap/verticals/03-coach-careers.md`.
Flags: `careers` (`NEXT_PUBLIC_FEATURE_CAREERS`, default off) for everything new; existing `coachOS` (`NEXT_PUBLIC_FEATURE_COACH_OS`, default off) for the public coach page surface.

## 1. Product purpose and target users
Connect sports professionals (coaches, assistant coaches, physios, trainers, groundstaff, admins) to jobs at academies, clubs, venues and schools, with a portable professional identity whose credentials say honestly whether they are submitted, reviewed or verified.
Users: professionals (any signed-in Triq user), employers (academy OWNER/MANAGER holding `careers.manage`), Triq ops verifiers (`SUPER_ADMIN`).

## 2. User roles and permissions
| Actor | How identified | Can |
|---|---|---|
| Professional | any signed-in user (`requireAuth()`) | own profile, experience, credentials (submit only), apply, withdraw, see own application history |
| Employer | `checkPermission("careers.manage")` (ADMIN app, OWNER/MANAGER by default) | create/edit/open/close jobs of the active org, move applications through the pipeline |
| Verifier | `requireAuth(["SUPER_ADMIN"])` | set credential `REVIEWED` / `VERIFIED` / `REJECTED` (only path to `VERIFIED`) |
| Public | none | read OPEN job listings (title, org name, city, sport, type, pay band) when `careers` on |

New permission key: `careers.manage` in `src/lib/team.ts` (OWNER/MANAGER get it through `ALL_PERMISSIONS`).

## 3. Feature inventory
| Feature group (scope) | v1 |
|---|---|
| Professional profiles | headline, bio, sports, city, years experience, `isPublic` opt-in |
| Job listings | org-owned, DRAFT/OPEN/CLOSED |
| Experience and qualifications | experience rows; credentials of kind QUALIFICATION |
| Skills and certifications | sports list + credentials of kind CERTIFICATION |
| Employer and organisation profiles | reuse public academy page `/academy/[slug]` (existing) |
| Job discovery and filtering | `/careers` list, filter by sport, city, type |
| Job applications | one per user per job, optional cover note |
| Applicant management | `/org/careers` pipeline per job |
| Interview / recruitment status | APPLIED → SHORTLISTED → INTERVIEW → OFFERED → HIRED, REJECTED, WITHDRAWN, each change stored in history |
| Saved jobs | later |
| Credential verification status | SUBMITTED / REVIEWED / VERIFIED / REJECTED, verifier + timestamp, audited |
| Careers outside competition, transition resources | later (content only, no data model) |

## 4. Screens and navigation
| Route | Who | Content |
|---|---|---|
| `/careers` | public | OPEN jobs, filters; 404 when flag off |
| `/careers/jobs/[jobId]` | public read, signed-in apply | job detail, apply form, own application status |
| `/careers/me` | signed-in | professional profile, experience, credentials, my applications with history |
| `/org/careers` | `careers.manage` | create job, list jobs, applicants per job, status change with note |
| `/ops/credentials` | SUPER_ADMIN | queue of SUBMITTED/REVIEWED credentials, review / verify / reject |
| `/c/[coachId]` (existing) | public | unchanged content; `noindex` + out of sitemap + share button hidden when `coachOS` off |

## 5. Field definitions and validation (`src/lib/careers.ts`)
- Profile: headline ≤120, bio ≤2000, sports ≤10 items each ≤40, city ≤80, yearsExperience 0–60 int.
- Experience: title 2–120, organization 2–120, startYear 1950–current, endYear ≥ startYear or null (current), description ≤1000.
- Credential: kind QUALIFICATION|CERTIFICATION, title 2–160, issuer ≤160, issuedYear 1950–current or null, evidenceUrl via `safeHttpUrl` or null. Editing title/issuer/evidence resets status to SUBMITTED.
- Job: title 3–120, role in `JOB_ROLES`, sport ≤40, city 2–80, employmentType in `EMPLOYMENT_TYPES`, description 20–5000, requirements ≤3000, payMin/payMax ≥0 ints with payMin ≤ payMax, monthly INR.
- Application: coverNote ≤2000.

## 6. User journeys
1. Professional opens `/careers/me`, saves profile, adds experience and a certification (status SUBMITTED).
2. Employer opens `/org/careers`, creates a job (DRAFT), publishes (OPEN).
3. Professional finds it on `/careers`, applies with a note; sees APPLIED on the job page and in `/careers/me`.
4. Employer shortlists, moves to INTERVIEW, OFFERED, HIRED or REJECTED; each change writes a `JobApplicationEvent` and an audit row.
5. Professional can WITHDRAW while not HIRED/REJECTED.
6. Verifier reviews evidence and marks credential VERIFIED; the label "Verified by Triq" appears only for VERIFIED credentials.

## 7. Business rules and state transitions
Application (`nextApplicationStatus` / `canTransitionApplication`):
| From | Employer may move to | Applicant may move to |
|---|---|---|
| APPLIED | SHORTLISTED, INTERVIEW, REJECTED | WITHDRAWN |
| SHORTLISTED | INTERVIEW, OFFERED, REJECTED | WITHDRAWN |
| INTERVIEW | OFFERED, REJECTED | WITHDRAWN |
| OFFERED | HIRED, REJECTED | WITHDRAWN |
| HIRED, REJECTED, WITHDRAWN | — (terminal) | — |
Applying requires job OPEN; closing a job keeps existing applications manageable. Duplicate application blocked by unique (jobId, applicantId).
Credential (`src/lib/credentials.ts`, shared with Wellness): owner may only create/reset to SUBMITTED; verifier may set SUBMITTED→REVIEWED, SUBMITTED|REVIEWED→VERIFIED, SUBMITTED|REVIEWED→REJECTED, VERIFIED→REVIEWED (revoke). Nobody else can produce VERIFIED.
Job: DRAFT→OPEN→CLOSED, CLOSED→OPEN allowed.

## 8. Database models (additive, `prisma/sql/2026-10-26_careers.sql`)
`ProfessionalProfile`(userId unique), `ProfessionalExperience`(userId), `ProfessionalCredential`(userId, status, reviewedById/At, verifiedById/At, rejectReason), `JobListing`(**orgId**), `JobApplication`(**orgId**, jobId, applicantId, unique pair), `JobApplicationEvent`(**orgId**, applicationId, from, to, actorId, note). User-owned tables are not org-scoped. Org-scoped tables are deleted in `src/app/actions/delete.ts` (only when the flag is on, so production does not fail before the SQL is applied). No Prisma relations added to existing models (keeps the change additive and merge-safe).

## 9. API contracts (server actions, `src/app/actions/careers.ts`, all async, FormData in, redirect/revalidate out)
`saveProfessionalProfile`, `addExperience`, `removeExperience`, `addCredential`, `removeCredential`, `applyToJob`, `withdrawApplication` (signed-in user; userId always from session) · `createJob`, `setJobStatus`, `updateApplicationStatus` (`careers.manage`, orgId from session) · `reviewCredential` (SUPER_ADMIN, `src/app/ops/credentials/actions.ts`). Every action re-checks `FEATURES.careers`.

## 10. Errors and edge cases
Flag off → pages `notFound()`, actions return without writing. Invalid input → redirect back with `?error=` message. Job of another org → "Job not found". Apply to closed job → error. Duplicate apply → error. Invalid transition → error, nothing written. Credential edit by non-owner → not found.

## 11. Security and privacy
Tenant scoping on every employer query (`orgId: session.orgId`). Applicant contact (email/phone) is shown to the employer only for applications to that employer's jobs, and the apply form says so. Applications are never public. Profiles are private unless `isPublic`. No ID-document storage; evidence is a link validated by `safeHttpUrl`. Audit rows: `JOB_CREATED`, `JOB_STATUS_CHANGED`, `JOB_APPLIED`, `JOB_APPLICATION_STATUS_CHANGED`, `JOB_APPLICATION_WITHDRAWN`, `CREDENTIAL_SUBMITTED`, `CREDENTIAL_REVIEWED|VERIFIED|REJECTED|REVOKED`.

## 12. Shared platform dependencies
Identity/session (`src/lib/auth.ts`), memberships and permissions (`src/lib/membership.ts`, `src/lib/team.ts`), audit log, verification states (shared `src/lib/credentials.ts`), search/pagination (simple take/where for v1), notifications (none in v1: status visible in app).

## 13. Acceptance criteria
- Flag off: no new route renders; `/c/*` noindex and absent from sitemap when `coachOS` off.
- An employer of org B cannot read or change org A's jobs or applications.
- A professional cannot set VERIFIED; only SUPER_ADMIN path writes it and it is audited.
- Every application status change has a history row with actor and time.

## 14. Tests
Unit (Vitest): `src/lib/__tests__/careers.test.ts` (transitions, validation), `src/lib/__tests__/credentials.test.ts` (verifier-only VERIFIED), `src/lib/__tests__/coach-public.test.ts` (index rule). Integration/E2E: not yet (needs DB); manual script listed in §16.

## 15. Implementation status (verified 2026-10-26)
| Feature group | Status | Evidence |
|---|---|---|
| Public coach page | Partial → gated | `src/app/c/[coachId]/page.tsx` live for all coaches; this branch adds noindex when `coachOS` off; `src/app/sitemap.ts` skips `/c/*` when off; share button hidden in `src/components/coach/CoachMePanel.tsx` |
| Coach credential checklist (legacy) | Partial | `src/app/actions/coach-verification.ts` (JSON in `User.verificationData`, academy-attested, no audit); `src/app/actions/verification.ts` `toggleCoachVerification` |
| Org CoachProfile editor | Mocked (orphan, state only) | `src/components/org/CoachProfile.tsx` not imported |
| Professional profile / experience / credentials | Missing → built (flag `careers`) | `src/app/careers/me/page.tsx`, `src/app/actions/careers.ts`, `src/lib/careers.ts`, `src/lib/credentials.ts` |
| Credential verification by authorised verifier | Missing → built | `src/app/ops/credentials/page.tsx`, `src/app/ops/credentials/actions.ts` |
| Job listings, discovery, applications, pipeline + history | Missing → built | `src/app/careers/page.tsx`, `src/app/careers/jobs/[jobId]/page.tsx`, `src/app/org/careers/page.tsx` |
| Employer profiles | Partial (reuse) | `src/app/academy/[slug]` public academy page |
| Saved jobs, career resources, notifications | Missing | — |

## 16. Release dependencies and open decisions
- Apply `prisma/sql/2026-10-26_careers.sql` before turning `careers` on.
- Decide: should academies (not only Triq ops) attest credentials ("Verified by <Academy>")? v1: Triq ops only.
- Decide: when `coachOS` is off, keep `/c/*` reachable (current: yes, noindex) or 404.
- Notification on status change (email/WhatsApp) needs the shared notification layer.
- Manual test: two orgs, one professional; apply, move statuses, confirm history and cross-org 404.
