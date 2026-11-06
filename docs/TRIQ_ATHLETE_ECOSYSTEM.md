# TRIQ Athlete Ecosystem

Date: 2026-11-06. Sources: the master blueprint (sections 5, 7–9, 16), the athlete flagship spec (2026-11-06) and `docs/TRIQ_AUDIT.md`. Status labels as in `TRIQ_PRODUCT_BLUEPRINT.md`.

TRIQ Athlete is the main differentiator. It develops the whole athlete, not only their match results. Two rules govern it:

1. **Athlete first.** The athlete (or guardian, for a minor) owns the passport and controls what is public.
2. **Wellbeing is not a performance score.** Nothing about wellbeing is ranked, rewarded, scored or shown to sponsors, selectors or opponents.

## 1. The six dimensions

| # | Dimension | Product area | Status today | Data tier |
|---|---|---|---|---|
| 1 | Physical performance | TRIQ Body | Schema only (`FitnessResult`, `Drill`, `SessionPlan`); `PerformanceResult` built, unused | Tier 1 |
| 2 | Mental performance | Mind & Performance (skills) | Missing | Content: none. Progress: tier 2 |
| 3 | Psychology and emotional wellbeing | Mind & Performance (wellbeing and services) | Missing | Tier 2 and 3 |
| 4 | Nutrition and recovery | TRIQ Nutrition, TRIQ Recovery | Missing | Education: none. Logs: tier 2. Professional records: tier 3 |
| 5 | Injury prevention and rehabilitation | TRIQ Recovery | Partial (`medical.ts`, `Incident` 0 rows) | Safety info: restricted tier 1. Rehab records: tier 3 |
| 6 | Career and personal development | Opportunities, Careers, Education, Sponsorship | Built, unused | Tier 1 (published by athlete) |

## 2. Athlete Passport

The central digital sporting identity. One passport per person across sports and academies.

**Today:** Partial. The `student/[id]` page and `athlete.ts` (achievements with staff review, goals) exist, per academy only, with no athlete login. `AthleteAchievement` and `AthleteGoal` have 0 production rows.

**Needs:** `AthleteProfile` (cross-academy identity, Planned), athlete login for 18+ (Planned), guardian access through `GuardianLink` (Schema only).

### Passport fields

| Field | Source today | Status | Visible to |
|---|---|---|---|
| Personal details | `Student` | Built and used | Athlete, guardian, own academy. Public: first name and last initial only for minors, with guardian consent |
| Sports, discipline | `Student`, `Batch.sport` | Built and used | Per profile mode |
| Playing position | — | Missing | Per profile mode |
| Skill level per sport | Computed from matches, results and assessments | Planned (Phase A). Never from wellbeing data | Per profile mode |
| Competition category | — | Missing | Per profile mode |
| Academy affiliation | `Student.orgId` | Built and used | Per profile mode |
| Club affiliation | `ProgramTeam` | Partial, unused | Per profile mode |
| Coaches | Batch `coachId` | Built and used | Per profile mode |
| Training history | `Attendance`, `Session` | Built and used | Athlete, guardian, academy, assigned coach |
| Competition history, results | `LiveMatch`, `AthleteMatchStat`, `PerformanceResult`, `CompetitionEntry` | Built, unused | Per profile mode |
| Achievements | `AthleteAchievement` (staff review) | Built, unused | Per profile mode |
| Certificates, awards | — | Missing | Per profile mode |
| Rankings (where verified) | — | Missing. Only from verified results | Per profile mode |
| Performance records | `PerformanceResult`, `FitnessResult`, `SkillReport` | Partial | Athlete, guardian, academy, assigned coach |
| Injury and rehabilitation information | `Incident`, `medical.ts` | Partial. Only where voluntarily provided and protected; **never on the passport's shared views** | Athlete, guardian, authorised professional |
| Career goals | `AthleteGoal` | Built, unused | Athlete chooses |
| Scholarships, sponsorships, opportunities | `ScholarshipProgram`, `Sponsorship*`, `Opportunity` | Built, unused | Athlete chooses |

### Passport features

| Feature | Status |
|---|---|
| Public and private profile modes | Missing |
| Verified achievements | Partial (staff review exists) |
| Evidence uploads | Missing (needs private storage; `MediaAsset` schema only) |
| Coach endorsements | Missing |
| Sporting CV, career portfolio | Missing |
| Shareable profile | Missing for the passport. Live-match share links exist with minors masked |
| Opportunity applications | Built, unused (guardian consent for minors) |

### Never on a passport

Wellbeing check-ins, journal entries, mental-state scores, clinical notes, diagnoses, full medical summaries, fee information. This is an acceptance criterion for every passport release.

## 3. Verified vs self-reported

The blueprint requires that self-reported and independently verified information are always distinguishable.

| Level | Meaning | Examples | How shown |
|---|---|---|---|
| **Verified by system** | Recorded by TRIQ during the event | Live-scored match stats, attendance marked by a coach | "Recorded on TRIQ" with the organisation and date |
| **Verified by organisation** | Entered or approved by an academy, organiser or verified professional | Achievement approved by staff, result entered by an organiser, coach assessment | "Verified by <organisation>" with the verifier and date |
| **Self-reported** | Entered by the athlete or guardian, not checked | Past results, external certificates without evidence | "Self-reported" label; never counted in rankings or levels |

Rules:

- Rankings use verified results only.
- An evidence upload does not by itself make an item verified. A named verifier does.
- Editing a verified item makes it self-reported again until re-verified.
- Status today: **Planned.** The existing staff review on achievements is the starting point.

## 4. The connected athlete journey

The blueprint's example: a young badminton athlete joins TRIQ. The athlete should experience one platform, not separate apps.

| # | Step | What it needs | Status today |
|---|---|---|---|
| 1 | Creates an account | Login; guardian-led for minors | Partial. Login built; no athlete login; guardian-led signup via academy |
| 2 | Builds an Athlete Passport | `AthleteProfile`, passport UI | Partial (Phase A) |
| 3 | Discovers a nearby badminton academy | Academy discovery | Built (`/academies`, city pages) |
| 4 | Joins a batch | Enquiry, trial, enrolment | Built and used |
| 5 | Connects with a coach | Batch coach, coach profile | Partial |
| 6 | Receives a training programme | Session plans, drill library | Schema only |
| 7 | Completes physical assessments | Fitness tests, sport rubrics | Schema only / Partial (skill reports) |
| 8 | Accesses mental performance education | Mind & Performance C1 | Planned |
| 9 | Books a qualified sports psychologist when needed | C3, provider verification, booking | Missing |
| 10 | Receives nutrition guidance from a qualified professional | Nutrition workspace | Missing |
| 11 | Tracks rehabilitation with a physiotherapist if injured | Recovery workflow | Missing |
| 12 | Joins activities through TRIQ Play | TRIQ Play | Missing |
| 13 | Registers for badminton competitions | Competition registration and fees | Partial (entries built, unused; no registration fees) |
| 14 | Records verified tournament results | Live scoring, organiser results | Built, unused |
| 15 | Builds a sporting CV | Passport CV view | Missing |
| 16 | Discovers sponsorship opportunities | Sponsorship OS with minors' protections | Built, unused; protections missing |
| 17 | Receives relevant brand offers | Rewards and Perks, Brand Studio | Partial / Schema only |
| 18 | Applies for advanced training and scholarships | Opportunities, scholarships | Built, unused |
| 19 | Builds a long-term sports career | Careers, Education | Built, unused |

## 5. Release phases

Each phase ships as a working end-to-end workflow: roles, screens, backend, permissions, tests and acceptance criteria. Phase A criteria come from the founder-approved Sprint 1 backlog and the athlete spec. Criteria for B–E are **proposed** and need confirming when each phase is planned.

### Phase A — Athlete Passport v1 and competition history (no new tables)

Scope: passport page from existing data (sports, academy, coach, level per sport, season stats from `AthleteMatchStat`, personal bests from `PerformanceResult`, achievements and goals, latest skill report); coach view scoped to own batches; parent view scoped to own children; season stats per sport family (cricket, goal sports, rally and tennis, bouts, chess, performance); remove the missed-session points penalty; restrict coach medical view to safety-critical fields.

Status: **Planned / in progress** (Sprint 1 items 9 and 10). The penalty rule is still in `src/app/actions/points.ts` on `release/sprint-1` at the time of writing.

Acceptance criteria:

- A coach finishes a live cricket match, and each linked athlete's passport shows the match and updated season totals within one refresh.
- A parent sees only their own child's passport; a request for another child's passport returns not found.
- An outsider with a share link sees no child's name.
- No wellbeing or medical field appears on a passport.
- Missing a session never reduces points or level.
- Coaches see only allergies, emergency contact and conditions flagged "coach must know".
- Verified and self-reported items are clearly marked.
- Works at 390px; passes keyboard and contrast checks.

### Phase B — Training and physical assessment (needs the wave 2 migration)

Scope: sport rubrics for skill assessments (1–5 with descriptors, trend against last assessment); fitness tests (30 m sprint, 5-10-5 shuttle, beep test, vertical jump, sit-and-reach, plank, 1 km run) with units and better-direction; session plans from a drill library attached to batches; goals linked to tests.

Needs: `FitnessResult`, `Drill`, `SessionPlan`, `SessionPlanItem` in production (wave 2, staging first).

Proposed acceptance criteria:

- A coach records a fitness test with decimal value and unit; the athlete's chart updates and shows the better direction.
- No chart compares athletes across age groups, disciplines or protocols.
- A goal linked to a test shows progress without manual updates.
- A session plan attached to a batch is visible to that batch's coach only, and to staff with permission.
- All flags stay off until the tables exist in the target database.

### Phase C — Mind & Performance

Three steps with separate gates: C1 content only; C2 private wellbeing space; C3 access to professionals. Full design and gates in `TRIQ_MIND_AND_PERFORMANCE.md`.

Proposed acceptance criteria (C1):

- No C1 screen stores personal data about the reader.
- Every exercise and sport pack has a recorded sports-psychologist review.
- Age versions exist: guardian-led under 13, athlete-facing 13–17, full 18+.

C2 and C3 criteria are set with counsel and the clinical advisor before build.

### Phase D — Nutrition and recovery

Scope: education first (fuelling, hydration, recovery nutrition, sleep), age-appropriate, with no calorie targets for children and no weight-loss content; optional athlete-owned recovery log (sleep, soreness, energy) in tier 2; injury support: record an incident, link to a professional, track the professional's return-to-sport plan.

Proposed acceptance criteria:

- No content promotes weight cutting, restrictive diets, unverified supplements or automated dietary prescriptions.
- The recovery log is invisible to coaches and academies unless the athlete shares it.
- Return to sport can be marked only by a verified professional; coaches and AI cannot set it.
- Recovery log and rehab records do not hold real data until the `care` schema and counsel sign-off are in place.

### Phase E — Career and sponsorship

Scope: trials, scholarships and opportunities with guardian mediation under 18; sponsors see only what the athlete or guardian publishes (achievements, competition history, public profile for 18+); life after sport via Education and Careers.

Proposed acceptance criteria:

- A sponsor or selector can never reach wellbeing, medical, recovery or clinical data through any screen, export or API.
- An under-18 application requires recorded guardian consent.
- Unpublishing a profile removes it from sponsor views immediately.

## 6. Risks to fix before the athlete pillar goes further

1. The missed-session points penalty (a sick or injured child loses points). Phase A.
2. Coaches see minors' full medical summaries. Phase A.
3. No consent ledger in production. C2, D and E depend on it.
4. No safeguarding protocol. Required before any wellbeing feature collects personal data.
