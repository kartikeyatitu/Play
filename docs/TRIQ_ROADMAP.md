# TRIQ Roadmap

Date: 2026-11-06. Source: `docs/TRIQ_AUDIT.md` sections 7 and 8, ordered by the blueprint's priorities (P0 foundation → P5 intelligence). Day counts start from 2026-11-06.

Estimates assume the current team. Recalculate once team size is confirmed. A vertical is released only when its workflows, safeguards, tests and customer validation are ready, not because a date arrives.

`docs/roadmap/README.md` and `docs/roadmap/verticals/` (2026-10-25) hold the earlier per-vertical plans. They remain useful detail; where their order differs, the sequence in this file takes precedence.

## Days 1–30: consolidate and connect two journeys

| # | Work | Status |
|---|---|---|
| 1 | Consolidate branches; close the security warnings | Security merges done on `release/sprint-1`; trial-status fix already on main (in `src/lib/enums.ts`), nothing to port; branch deletion approved but blocked from this environment (proxy refuses deletes); founder deletes the 20 branches in GitHub; `rls_auto_enable` revoke applied to production and verified 2026-11-06 |
| 2 | Migration discipline: `_migrations` ledger, staging database, retire runtime DDL | Planned (staging option not yet chosen) |
| 3 | Release process: feature branches and Vercel previews on staging | Process adopted; preview environment variables not yet set |
| 4 | **Academy journey end to end**: enquiry → trial → enrolment approval → batch → attendance → fee plan → invoice → reminder → payment → receipt → parent home → monthly progress report | Partial; gaps are fee plans and instalments, overdue panel, one-tap reminders, parent home |
| 5 | **Athlete Passport v1** from existing data, verified and self-reported marked | Planned |
| 6 | Remove the missed-session points penalty; restrict coaches to safety-critical medical fields | Planned |
| 7 | The ten `docs/TRIQ_*.md` documents | Written 2026-11-06 |

### Sprint 1 backlog (two weeks)

All items approved by the founder on 2026-11-06.

| # | Item | Acceptance criteria |
|---|---|---|
| 1 | Merge `de21216` and `c933409` (security) | Their tests and all existing tests pass; a coach without a permission is refused; joining a second academy requires consent |
| 2 | Port the trial-status fix (`a827d8d`) | Converting a trial from the Trials screen succeeds for every status it sends; test added |
| 3 | Merge Vercel Analytics, excluding child and parent pages | No analytics script on `/parent`, `/student`, `/live` or receipt pages |
| 4 | Delete the 20 fully merged branches | Listed branches gone; nothing unique lost |
| 5 | Revoke EXECUTE on `rls_auto_enable()` from `anon` and `authenticated` | Advisor no longer reports it |
| 6 | Migration ledger and staging database | Each SQL file recorded once; wave 2 SQL runs cleanly on staging |
| 7 | Preview deployments with a staging database | A pushed feature branch gets a preview URL that works end to end against staging |
| 8 | Academy journey gaps: fee plans and instalments, overdue panel, one-tap reminders, parent home | The full journey passes on preview with test data, phone-first at 390px |
| 9 | Athlete Passport v1 | A coach finishes a live match and each linked athlete's passport shows it; parents see only their own children; outsiders see no child name; no medical or wellbeing field on the passport |
| 10 | Remove the missed-session penalty; restrict coach medical view | Missing a session never lowers points; coaches see only safety-critical medical fields |
| 11 | Docs | The ten `docs/TRIQ_*.md` files exist and match the audit |
| 12 | Tenant-isolation tests against staging | One academy can't read another's students, fees or receipts through any action tested |

Item status is tracked in `TRIQ_FEATURE_MATRIX.md`.

## Days 31–60: athlete and business foundations

- Coach OS: availability, roster, training plans, assessments with sport rubrics.
- Physical performance: fitness tests and session plans (needs the wave 2 migration, staging first).
- Mind & Performance **C1**: mental-skills library and sport packs, no personal data, reviewed by a sports psychologist.
- Professional onboarding and verification for psychologists, physiotherapists and nutritionists.
- Shared scheduling and payments for professional bookings.

## Days 61–90: health, performance and participation

- Mind & Performance **C2** (private wellbeing) and **C3** (professional consultations): **only after counsel and clinical sign-off.** If sign-off has not happened, these move out; nothing else waits on them.
- Nutrition professional workspace and education.
- Physiotherapy and recovery workflow, with return-to-sport decisions recorded from the qualified professional.
- TRIQ Play and communities.
- Competition management: draws and standings.

## Days 91–180: commercial, extended and intelligence

In the blueprint's order:

1. Commercial ecosystem (P3): sponsorship, Brand Studio, marketplace, rewards, careers, creators. Main gaps: real users, minors' protections, settlement.
2. Extended ecosystem (P4): corporate, wellness, global, education, inclusive.
3. Intelligence (P5): athlete and coach assistants, sports-science insights, permission-aware retrieval, consent enforcement, evaluations, cost controls.
4. Mobile: installable PWA, then native apps through Capacitor; external integrations.

Gym OS (P1 in the blueprint, entirely missing) is scheduled after the Academy and Athlete journeys are working; place it when the first gym customer is confirmed.

## Stop list

- **Stop switching on verticals that have no users.** Several flags are on for verticals with zero production rows. Keep them visible only where they are tested.
- **Stop building screens without the backend, permissions and tests behind them.**
- No direct pushes to `main`.
- No production migration without a staging run and founder approval.
- No personal data in Mind & Performance before counsel and clinical sign-off.

## Decisions still open

From `TRIQ_AUDIT.md`:

1. Staging database: Supabase branch of `triq` or a separate Mumbai project.
2. Whether the `xplay` Vercel project keeps deploying from `main`.
3. Named advisors for sports psychology, safeguarding and counsel.
4. Approval to run the wave 2 migration on production after staging.
