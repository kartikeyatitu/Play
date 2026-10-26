# Vertical 3 — TRIQ Play (competitions & participation)

Status: spec + first build slices. Written 2026-10-26 against `main` (5ab2358). Replaces
`docs/roadmap/verticals/06-competitions.md` (old V6) and absorbs the competition parts of
`04-sports-participation.md` (old V4 — trial/waitlist work stays with TRIQ Business).

## 1. Product purpose and target users

Run real competitions — intra-academy leagues, knockout cups, invitational tournaments — with
persisted entries, fixtures, results and standings that follow explicit rules and stay consistent
under concurrent updates.

| User | Need |
|---|---|
| Organizer (academy owner/manager) | Create a competition, set format/dates/venue/eligibility, register entries, generate fixtures, record results |
| Match official (coach/staff assigned to a fixture) | Record the result of fixtures they officiate |
| Participant / parent | See schedule, results and standings (later slice) |
| Public | Read-only results page by share token (later slice) |

## 2. User roles and permissions

| Action | Who | Check |
|---|---|---|
| Create / edit / open / close / cancel competition | OWNER, MANAGER (or anyone with override) | `requirePermission("competitions.manage")` (new key in `src/lib/team.ts`) |
| Register / withdraw entries | same | `competitions.manage` |
| Generate fixtures, schedule fixtures, assign official | same | `competitions.manage` |
| Record / correct result | `competitions.manage` **or** the fixture's `officialUserId` with an ACTIVE membership in the org | custom check in `recordFixtureResult` |
| View competitions in admin | `competitions.manage` | — |
| Parent view of child's fixtures | parent of a `CompetitionEntry.studentId` | later |

Every query filters by `orgId` from the session; ids from the client are re-fetched with `{ id, orgId }`.

## 3. Feature inventory

| Group (scope) | v1 (this branch) | Later |
|---|---|---|
| Discovery | — | public competitions list (shares search infra with Spaces discovery) |
| Creation & configuration | name, sport, format, entry type, dates, venue text, capacity, age rule, batch rule, points, draws | facility link, fees |
| Formats | LEAGUE (single/double round-robin), KNOCKOUT (single elimination, byes) | groups→knockout, Swiss, double elimination |
| Team & individual registration | TEAM (named entry, optional source batch) and INDIVIDUAL (a student) | team rosters, self-registration |
| Eligibility rules | min/max age on a cutoff date (needs `Student.dob`), must be enrolled in batch | gender, rating, cross-org |
| Registration fees | — (never simulated) | via `Payment` + Razorpay webhook |
| Participant management | list, seed, withdraw before fixtures | substitutions |
| Fixtures & schedules | deterministic generation, date/time + venue per fixture | court reservation via turf engine |
| Officials | `officialUserId` per fixture | official pool, availability |
| Score & result recording | validated, versioned (optimistic concurrency), audited | sport-specific scorecards |
| Standings & leaderboards | computed from fixtures with documented tie-breakers; knockout bracket view | player stats |
| Notifications | — | WhatsApp/in-app on fixture/result |
| Withdrawals / cancellations / postponements | entry withdrawal pre-fixtures; fixture POSTPONED/CANCELLED; competition CANCELLED | walkovers after generation |
| History & profiles | completed competitions stay listed | athlete competition history (V2) |
| Organizer analytics | entries/fixtures played counts | participation trends |

## 4. Screens and navigation

- Admin → **Events** tab (`AdminClient.tsx`, only when `FEATURES.events`): `CompetitionManager`
  replaces the UI-only `TournamentBracket`.
  - List: competitions with status chip, format, entries/capacity.
  - Create form.
  - Detail: header + status actions; Entries (register/withdraw/seed); Fixtures by round (schedule,
    official, result entry); Standings table (LEAGUE) or bracket rounds (KNOCKOUT).
- Certificates widget stays as is.

## 5. Field-level definitions and validation

**Competition**: `name` 3–80 chars; `sport` ≤40; `format` LEAGUE|KNOCKOUT; `entryType` TEAM|INDIVIDUAL;
`legs` 1|2 (LEAGUE only); `startDate`/`endDate` optional ISO dates, end ≥ start; `venue` ≤120;
`maxEntries` 2–128 (KNOCKOUT ≤64); `minAge`/`maxAge` 3–80, min ≤ max; `ageCutoffDate` required if an
age rule is set (defaults to `startDate`); `eligibleBatchId` must belong to org; `pointsWin` 0–10,
`pointsDraw` 0–10, `pointsLoss` 0–10 with win ≥ draw ≥ loss; `allowDraws` (LEAGUE only; KNOCKOUT never).
**Entry**: `name` 2–60, unique per competition (case-insensitive); INDIVIDUAL requires `studentId` of
org, unique per competition; TEAM may carry `batchId`; `seed` 1–128 optional, unique per competition.
**Result**: `homeScore`/`awayScore` integers 0–999; KNOCKOUT tie needs `winnerEntryId` ∈ {home, away};
LEAGUE draw only if `allowDraws`; `expectedVersion` integer required.

## 6. End-to-end journeys

1. Organizer creates competition (DRAFT) → configures format/dates/venue/eligibility.
2. Opens registration (OPEN).
3. Registers entries; server validates status, capacity, duplicates, eligibility (one transaction
   with a per-competition advisory lock, so concurrent registrations cannot exceed capacity).
4. Generates fixtures (OPEN/DRAFT → SCHEDULED, needs ≥2 entries); registration closes.
5. Schedules fixtures, assigns officials.
6. Official/organizer records results; knockout winners advance.
7. Standings recompute from fixtures on every read.
8. When every fixture is decided, organizer marks COMPLETED.

## 7. Business rules and state transitions

Competition: `DRAFT → OPEN → SCHEDULED → COMPLETED`; `DRAFT|OPEN|SCHEDULED → CANCELLED`;
`OPEN → DRAFT` allowed while no fixtures exist. Config is editable only in DRAFT/OPEN.
Entry: `REGISTERED → WITHDRAWN` (only before fixtures exist).
Fixture: `SCHEDULED → COMPLETED | POSTPONED | CANCELLED`; `POSTPONED → SCHEDULED`; `BYE` is terminal
(created by generation). `COMPLETED` can be corrected unless the knockout winner already played the
next round (`COMPLETED` next fixture) — then blocked.

Engine rules (`src/lib/competition.ts`, pure, tested):
- **Seeding**: entries with a seed first (ascending), then unseeded by registration time, then id.
  Same input → same output. No randomness.
- **Round-robin**: circle method; odd count adds a bye (the entry sitting out has no fixture that
  round). n entries → n(n−1)/2 fixtures per leg, each pair once per leg; leg 2 swaps home/away.
- **Single elimination**: bracket size = next power of two; standard seed placement (1 v N, 2 v N−1,
  …, top seeds meet latest); byes go to the top seeds; bye fixtures are `BYE` with the present entry as
  winner, pre-filled into round 2. Fixture (r, s) feeds (r+1, ⌊s/2⌋) — home if s even, away if odd.
- **Standings tie-breakers** (in order): points → head-to-head points among the tied group →
  overall score difference → scores for → wins → entry name (A–Z, deterministic). Only COMPLETED
  fixtures count. Withdrawn entries stay in the table if they have results.
- **Concurrency**: `Fixture.version` increments on every write; result writes use
  `updateMany({ where: { id, orgId, version: expectedVersion } })` — 0 rows ⇒ "changed by someone
  else, reload". Knockout advancement happens in the same transaction. Standings are derived, never
  stored, so they cannot drift.

## 8. Database models and relationships

New (additive, `prisma/sql/2026-10-26_competitions.sql`): `Competition` (orgId → Organization),
`CompetitionEntry` (competitionId cascade, optional studentId → Student cascade, batchId),
`Fixture` (competitionId cascade, home/away/winner → CompetitionEntry set null, officialUserId,
`version`). Unique: entry `(competitionId, name)`, `(competitionId, studentId)`; fixture
`(competitionId, round, slot)`. All have `orgId`; added to `deleteAllData` order (flag-gated).
Reused: `Student`, `Batch`, `AuditLog`, `OrgMembership`.

## 9. API contracts (server actions, `src/app/actions/competitions.ts`)

All return `{ success: true, ... } | { success: false, error }` and return an error when `FEATURES.events` is off.
`listCompetitions()`, `getCompetition(id)` (entries, fixtures, standings, bracket),
`createCompetition(input)`, `updateCompetition(id, input)`, `setCompetitionStatus(id, status)`,
`registerEntry(competitionId, {name?, studentId?, batchId?, seed?})`, `withdrawEntry(entryId)`,
`generateFixtures(competitionId)`, `scheduleFixture(fixtureId, {scheduledAt?, venue?, officialUserId?, status?, expectedVersion})`,
`recordFixtureResult(fixtureId, {homeScore, awayScore, winnerEntryId?, expectedVersion})`.
Audit actions: `COMPETITION_CREATED|UPDATED|STATUS_<S>`, `COMPETITION_ENTRY_REGISTERED|WITHDRAWN`,
`COMPETITION_FIXTURES_GENERATED`, `FIXTURE_SCHEDULED`, `FIXTURE_RESULT_RECORDED|CORRECTED`.

## 10. Errors and edge cases

Capacity reached; duplicate name/student; student without DOB under an age rule ("Add date of birth
to check age eligibility"); student not in eligible batch; generating with <2 entries; regenerate
attempt after results exist (blocked); stale version ("This match was updated by someone else");
knockout draw without winner; correcting a result whose winner already played; result on BYE /
CANCELLED fixture; official not a member any more.

## 11. Security and privacy

Tenant-scoped everything; minors' names only inside the org's admin UI in v1 (no public page yet;
when added, `showNames` default off). No DOB/medical data returned — eligibility computed server-side
and only the verdict is returned. Every mutation writes `AuditLog`.

## 12. Shared platform dependencies

Identity/permissions (`checkPermission`, new `competitions.manage`), audit log, scheduling (later:
turf engine `reserveSlot` for fixture courts), notifications (later), payments (later, fees),
search/discovery (later), V2 athlete history.

## 13. Acceptance criteria

- Same entries ⇒ identical fixtures every time; 5-team knockout ⇒ 8-slot bracket, 3 byes to seeds 1–3.
- League of n has n(n−1)/2 fixtures per leg, no entry twice in a round.
- Registration can't exceed `maxEntries` even with concurrent requests (advisory lock + count in txn).
- Two officials submitting the same fixture with the same version ⇒ one succeeds, one gets the stale error.
- Knockout winner appears in the next-round fixture; correcting after the next round is played is blocked.
- Standings ordering matches the documented tie-breakers.
- Flag off ⇒ Events tab hidden and actions refuse.

## 14. Tests

Unit (Vitest, `src/lib/__tests__/competition.test.ts`): seeding, round-robin counts/uniqueness/byes/
legs, knockout sizes/byes/placement/advancement, result validation, standings tie-breakers,
eligibility. Integration (needs DB, not in CI yet): register race, version conflict. E2E (Playwright,
later): create → register → generate → record → standings.

## 15. Implementation status (verified against `main` 5ab2358, then this branch)

| Feature group | Status | Evidence |
|---|---|---|
| Match events + RSVP (batch-bound) | Complete (ungated, separate from competitions) | `Event`/`RSVP` in `prisma/schema.prisma`; `src/app/actions/events.ts`; `src/components/coach/MatchManager.tsx` used by `src/app/coach/page.tsx` |
| Tournament bracket (main) | Mocked | `src/components/org/TournamentBracket.tsx`: `useState` only, `Math.random()` shuffle, round 1 only, odd team dropped, scores lost on reload |
| Certificates | Mocked (print template) | `src/components/org/CertificateGenerator.tsx` |
| Competition engine | Missing on main (building) | `src/lib/competition.ts`, `src/lib/__tests__/competition.test.ts` |
| Persisted competitions/entries/fixtures | Missing on main (building) | `prisma/schema.prisma`, `prisma/sql/2026-10-26_competitions.sql`, `src/app/actions/competitions.ts` |
| Organizer UI (create/register/generate/results/standings) | Missing on main (building) | `src/components/org/CompetitionManager.tsx` mounted in `AdminClient.tsx` |
| Officials recording results | Missing on main (building) | `recordFixtureResult` |
| Discovery, fees, notifications, public page, parent view, analytics | Missing | — |

## 16. Release dependencies and open decisions

- Apply `prisma/sql/2026-10-26_competitions.sql` **before** turning `NEXT_PUBLIC_FEATURE_EVENTS` on.
- Inter-academy competitions need a cross-tenant consent model — v1 uses named external TEAM entries.
- Public results page and showing minors' names: needs per-academy (and possibly parent) consent.
- Sport-specific scoring (cricket, racquet sets) — generic for/against for now.
- Entry fees must use `Payment` + webhook verification; never simulated.
- Should coaches get a results screen in the coach app (assigned official flow)?
