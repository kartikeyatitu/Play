# TRIQ vertical roadmap

One plan per vertical lives in `verticals/NN-name.md`. Each plan has the same nine sections:
goal, verified today (with file paths), gaps, v1 scope, data model (additive SQL, not applied),
build slices with acceptance criteria, feature flag, dependencies, open questions.

Rules for every slice: one PR, small, tested; new behaviour behind a feature flag (default off);
additive migrations written to `prisma/sql/` and applied only with founder approval;
bug fixes may ship unflagged.

Last verified: 2026-10-25 against branch `feat/academy-os-branches` and the production database (read-only).

## Status of all 16 verticals

| # | Vertical | Today (verified) | First slice | Flag |
|---|---|---|---|---|
| 1 | Academy operations | Working core. In flight: fee payment method (PR #2), branches. Gaps: one guardian per student, no Program above Batch, WhatsApp is deep links only, OTP not configured | `src/lib/student-access.ts` — one shared student-visibility helper, no behaviour change | `academyOpsV2` |
| 2 | Athlete profiles | Partial. `/student/[id]`, skill reports, media work. Bugs: medical info shown as raw JSON, attendance ordered by id not date | Fix both bugs + tested `src/lib/athlete-profile.ts` (unflagged bug fix) | `athleteOS` |
| 3 | Coach careers | Partial. Public `/c/[coachId]` is live although `coachOS` is off; verification is academy-set and unaudited | Put public coach pages behind `coachOS` (sitemap + noindex) | `coachOS` |
| 4 | Sports participation | Partial. Trial → lead → student and `/join` work. Trial buttons were broken (hotfix PR #3) | Trial status normalisation + audit on status change | `participation` |
| 5 | Venues | Mostly working: counter bookings, leases, Razorpay holds, admin board. Double-booking constraint exists in prod | Audit entries for every booking creation | `bookings` (on) |
| 6 | Competitions | Coach matches/RSVP work. Tournament bracket is UI-only, random, round 1 only | Pure fixture + standings engine `src/lib/competition.ts` | `events` |
| 7 | Communities | One-way announcements, broadcasts, durable DMs work. No replies, moderation or audit | Flag + `community.moderate` permission + audit on posts | `communities` |
| 8 | Recognition | UI-only: badges and leaderboard are never mounted; nothing stored | Pure badge rules `src/lib/recognition.ts` | `recognition` |
| 9 | Sponsorship *(light)* | Missing (archived Brand models have no orgId) | Sponsor tracker: `Sponsorship` + payments | `sponsorship` |
| 10 | Rewards | Partial/broken: points have no ledger, referrals never convert, coupons never redeem | Pure `src/lib/points-rules.ts`, then a `PointTransaction` ledger | `rewards` |
| 11 | Marketplace | Kit store partial and ungated: no stock checks, no price on order, no payment | Pure `src/lib/store.ts` + `store.manage` permission + audit | `marketplace` |
| 12 | Wellness *(light)* | Medical profile, SOS, incidents work. Medical edits unpermissioned and unaudited | `health.view` / `health.manage`, medical field whitelist, audit (field names only) | `wellness` |
| 13 | Corporate sports *(light)* | Missing (flag only). Weekly court leases exist but aren't linked to a company | Corporate clients list | `corporate` |
| 14 | International opportunities *(light)* | Missing. Multi-country locale support works | Opportunities board for admins (publishes as an announcement) | `opportunities` |
| 15 | Inclusive participation *(light)* | Missing. Fee override can't express a full waiver; coupons never apply | `FeeConcession` table applied by monthly fee generation | `inclusive` |
| 16 | AI assistance *(light)* | Missing: no AI provider or calls. "AI Insights" are fixed formulas | AI groundwork + "Draft with AI" for announcements (PII stripped, usage logged, rate-limited) | `ai` |

## Build order

Dependencies decide the order. Each vertical's slice 1 is small enough to land in a day or two.

0. **Bug fixes now (unflagged):** trial buttons (PR #3), admin confirm + payment method (PR #2), athlete profile medical/attendance bugs (V2 slice 1).
1. **V1 Academy operations** — finish branches, guardians, programs. Everything else builds on it.
2. **V2 Athlete profiles** — the athlete record that V8, V10, V14 reuse.
3. **V4 Sports participation** and **V5 Venues** — revenue-adjacent, mostly built, need audit and fixes.
4. **V10 Rewards** then **V8 Recognition** — share points and attendance data.
5. **V3 Coach careers** and **V6 Competitions**.
6. **V7 Communities** and **V11 Marketplace**.
7. Light v1s: **V12 Wellness**, **V15 Inclusive**, **V14 International** (needs V2), **V13 Corporate**, **V9 Sponsorship**, **V16 AI**.

## Cross-cutting issues found while planning

- Several screens the inventory lists as working are never mounted (AchievementBadges, Leaderboard, CoachProfile, TrainingPlan) or keep data only in local state. `docs/audits/feature-inventory.md` should be treated as claimed, not verified.
- Flags `athleteOS`, `coachOS`, `marketplace`, `corporate` are defined but read nowhere. Public coach pages and the kit store are live and ungated.
- `Coupon.code` is unique across all academies; making it per-academy is not purely additive.
- Sponsorship (V9) and Corporate (V13) both change the profit calculation in `src/app/actions/payroll.ts` — do that once.
- Every new table must be added to the deletion order in `src/app/actions/delete.ts`.
- `checkPermission` only admits the ADMIN app role; coach/physio paths need their own checks.
- A parent registered at one academy cannot be added at another (`User.phone` unique, single `User.orgId`).

## Decisions needed from the founder

1. Apply the two pending migrations (fee payment method, branches)?
2. Keep public coach pages and the kit store live, or put them behind their flags?
3. Parents with children at two academies: support in v1 or not?
4. Public pages showing minors (certificates, competitions): first name + last initial, with consent?
5. Parent leaderboard on by default?
6. Can points turn into fee credit? Per-academy coupon codes?
7. Should parents see their child's MISCONDUCT incidents?
8. AI provider, model, monthly cost cap and data-processing region.
9. Corporate: GST invoices, or monthly statements?
