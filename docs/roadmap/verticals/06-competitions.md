# Vertical 6 — Competitions

Status: PLAN ONLY. Nothing here is applied. Written 2026-10-25 against branch `feat/academy-os-branches`.

## 1. Goal

Let an academy run real competitions — intra-academy leagues, knockout cups and invitational
tournaments — with persisted teams, fixtures, results and standings that coaches, parents and players
can see and share. Today matches exist only as batch RSVP events and the bracket is a throwaway
client widget; v1 makes competitions a first-class, auditable record that later feeds coach careers
and athlete profiles.

## 2. Verified today

| Capability | Evidence | Status |
|---|---|---|
| Match / event records | `Event` (title, date, location, `batchId` NOT NULL, `orgId` nullable, optional `studentId`) + `RSVP` (`@@unique([eventId, studentId])`, status GOING/NOT_GOING/PENDING) in `prisma/schema.prisma` | working |
| Create match (coach/admin) | `createEvent` in `src/app/actions/events.ts`: `requireAuth(['ADMIN','COACH'])`, coach limited to own batches, auto-creates PENDING RSVPs for enrolled students; **no audit**, no permission key | working |
| RSVP | `updateRSVP` (`events.ts`) scoped by parent→child / coach→batch / admin→org; `RSVPButtons.tsx` in `ParentClient.tsx` (line 279), data from `src/app/parent/page.tsx` (`RSVP: { include: { event: true } }`) | working |
| Coach "Matches & events" | `src/app/coach/page.tsx` (lines ~94, 302–344) lists events + `RSVPBadge`, `CreateMatchModal` from `src/components/coach/MatchManager.tsx` — **not behind `FEATURES.events`** | working (ungated) |
| Event reminders | `src/app/actions/reminders.ts` line 179 queries upcoming events | working (not reviewed in depth) |
| Admin tournaments tab | `AdminClient.tsx` lines 196, 211, 673–680: "Tournaments & Certificates" tab only when `FEATURES.events` (fallback **false**, `src/lib/features.ts`) | gated |
| Bracket builder | `src/components/org/TournamentBracket.tsx`: all state in `useState`; knockout shuffles with `Math.random()` and generates **round 1 only** (odd team silently dropped, no byes, no advancement); league = all pairs, round 1; scores lost on reload; share = text | UI-only |
| Certificates | `src/components/org/CertificateGenerator.tsx` — `window.print()` of a template | UI-only |
| Teams, fixtures, results, standings models | None in schema (read in full) | missing |
| Inter-academy play | No model links two orgs | missing |
| Entry fees | None; would reuse `Payment` / `PAYMENT_METHODS` (`src/lib/payment-method.ts`) | missing |
| Court reservation for a match | `Event.location` is free text; no link to `Facility`/`TurfBooking` | missing |

## 3. Gaps for a real v1

1. Persisted competitions with format (KNOCKOUT / LEAGUE), teams and players drawn from the academy's students.
2. Correct fixture generation: round-robin (circle method), knockout with byes and advancement, deterministic seeding (no `Math.random` in server data).
3. Result entry with who-entered and audit; standings computed, not stored.
4. Parent visibility: fixtures for their child's team, match-day RSVP (reuse `Event`/`RSVP`).
5. Shareable public results page (read-only, no student phone/medical data; names shown only with academy opt-in).
6. A permission key: today any coach can create events for their batches with no audit.
7. Decide whether the ungated coach match feature should stay ungated (it is live behaviour).

## 4. v1 scope

**In**: single-academy competitions (intra-academy or vs named external teams entered as text), KNOCKOUT and LEAGUE formats, teams from students, fixtures with date/venue text, optional link to an `Event` for RSVP, score entry, standings (W/D/L/pts, goal or run difference as a generic `for/against`), public share page by token, audit everywhere, `competitions.manage` permission.

**Out**: multi-academy hosted tournaments with cross-org registrations, entry-fee collection online, sport-specific scorecards (cricket overs, tennis sets), player stats/leaderboards, live scoring, referee apps, court auto-reservation (planned with V5), certificates persistence.

## 5. Data model

Reuse: `Event` + `RSVP` for match-day availability (a fixture may point at an `Event`), `Student`,
`Batch`, `AuditLog`. New tables are needed because `Event` is bound to one batch (`batchId` NOT NULL)
and has no notion of teams, rounds or scores; overloading it would break `createEvent`/RSVP semantics.

```prisma
model Competition {
  id          String   @id @default(cuid())
  orgId       String
  name        String
  sport       String?
  format      String   // KNOCKOUT | LEAGUE
  status      String   @default("DRAFT") // DRAFT | ACTIVE | COMPLETED | CANCELLED
  pointsWin   Int      @default(3)
  pointsDraw  Int      @default(1)
  shareToken  String?  @unique // public read-only results page; null = private
  showNames   Boolean  @default(false) // student names on public page only when true
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  teams       CompetitionTeam[]
  fixtures    Fixture[]
  @@index([orgId, status])
}

model CompetitionTeam {
  id            String  @id @default(cuid())
  orgId         String
  competitionId String
  name          String
  batchId       String? // optional source batch
  isExternal    Boolean @default(false) // opponent not on Triq
  seed          Int?
  competition   Competition @relation(fields: [competitionId], references: [id], onDelete: Cascade)
  members       CompetitionTeamMember[]
  @@unique([competitionId, name])
}

model CompetitionTeamMember {
  id        String @id @default(cuid())
  orgId     String
  teamId    String
  studentId String
  team      CompetitionTeam @relation(fields: [teamId], references: [id], onDelete: Cascade)
  @@unique([teamId, studentId])
  @@index([studentId])
}

model Fixture {
  id            String    @id @default(cuid())
  orgId         String
  competitionId String
  round         Int
  slot          Int       // position within the round (bracket order)
  homeTeamId    String?   // null = TBD (winner of earlier fixture) or bye
  awayTeamId    String?
  scheduledAt   DateTime?
  venue         String?
  eventId       String?   @unique // optional Event for RSVP
  homeScore     Int?
  awayScore     Int?
  winnerTeamId  String?   // knockout tie-break (penalties etc.)
  status        String    @default("SCHEDULED") // SCHEDULED | PLAYED | WALKOVER | CANCELLED
  resultById    String?
  resultAt      DateTime?
  competition   Competition @relation(fields: [competitionId], references: [id], onDelete: Cascade)
  @@unique([competitionId, round, slot])
  @@index([orgId, scheduledAt])
}
```

```sql
-- prisma/sql/2026-11-XX_competitions.sql
-- Additive only. NOT APPLIED. Requires founder approval.
CREATE TABLE IF NOT EXISTS "Competition" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL, "sport" TEXT, "format" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "pointsWin" INTEGER NOT NULL DEFAULT 3, "pointsDraw" INTEGER NOT NULL DEFAULT 1,
  "shareToken" TEXT UNIQUE, "showNames" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL REFERENCES "User"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Competition_orgId_status_idx" ON "Competition"("orgId","status");
ALTER TABLE "Competition" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "CompetitionTeam" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "competitionId" TEXT NOT NULL REFERENCES "Competition"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "batchId" TEXT REFERENCES "Batch"("id") ON DELETE SET NULL,
  "isExternal" BOOLEAN NOT NULL DEFAULT false, "seed" INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompetitionTeam_competitionId_name_key" ON "CompetitionTeam"("competitionId","name");
ALTER TABLE "CompetitionTeam" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "CompetitionTeamMember" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "teamId" TEXT NOT NULL REFERENCES "CompetitionTeam"("id") ON DELETE CASCADE,
  "studentId" TEXT NOT NULL REFERENCES "Student"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompetitionTeamMember_teamId_studentId_key" ON "CompetitionTeamMember"("teamId","studentId");
CREATE INDEX IF NOT EXISTS "CompetitionTeamMember_studentId_idx" ON "CompetitionTeamMember"("studentId");
ALTER TABLE "CompetitionTeamMember" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "Fixture" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "competitionId" TEXT NOT NULL REFERENCES "Competition"("id") ON DELETE CASCADE,
  "round" INTEGER NOT NULL, "slot" INTEGER NOT NULL,
  "homeTeamId" TEXT REFERENCES "CompetitionTeam"("id") ON DELETE SET NULL,
  "awayTeamId" TEXT REFERENCES "CompetitionTeam"("id") ON DELETE SET NULL,
  "scheduledAt" TIMESTAMP(3), "venue" TEXT,
  "eventId" TEXT UNIQUE REFERENCES "Event"("id") ON DELETE SET NULL,
  "homeScore" INTEGER, "awayScore" INTEGER,
  "winnerTeamId" TEXT REFERENCES "CompetitionTeam"("id") ON DELETE SET NULL,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "resultById" TEXT, "resultAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "Fixture_competitionId_round_slot_key" ON "Fixture"("competitionId","round","slot");
CREATE INDEX IF NOT EXISTS "Fixture_orgId_scheduledAt_idx" ON "Fixture"("orgId","scheduledAt");
ALTER TABLE "Fixture" ENABLE ROW LEVEL SECURITY;
```

`orgId` is denormalised onto every row (same convention as `StaffAttendance`/`StaffPayout`) so every query can filter by tenant directly.

## 6. Build slices

**S1 — Pure fixture & standings engine (no schema).**
- Files: `src/lib/competition.ts` (`roundRobin(teamIds)` circle method with bye for odd counts; `knockoutBracket(teamIds, seeds)` padding to next power of two with byes; `advanceWinner(fixtures, fixtureId)`; `standings(fixtures, pointsWin, pointsDraw)`; `validateScore`), `src/lib/__tests__/competition.test.ts`. No Prisma import.
- Tests: n teams ⇒ n(n-1)/2 league fixtures, each pair once; 5-team knockout ⇒ 3 byes, 4 rounds total including byes resolved; standings tie-break order (points, for-against, head-to-head, name).
- Acceptance: deterministic output for the same input; replaces the round-1-only logic in `TournamentBracket.tsx` later.

**S2 — Schema + permission key.**
- Files: `prisma/schema.prisma`, `prisma/sql/2026-11-XX_competitions.sql`; `src/lib/team.ts` add `"competitions.manage": "Run tournaments, fixtures and results"` (OWNER/MANAGER get it automatically via `ALL_PERMISSIONS`; COACH via per-person override). Update `src/lib/__tests__` if any test enumerates permissions.
- Acceptance: `prisma generate` passes; nothing reads the tables until SQL is applied.

**S3 — Create competition, teams, generate fixtures (admin).**
- Files: `src/app/actions/competitions.ts` (`createCompetition`, `addTeam`, `addTeamMembers`, `generateFixtures`, `listCompetitions`, `getCompetition`), `src/components/org/CompetitionManager.tsx` mounted in the existing events tab in place of `<TournamentBracket />` (keep the old widget reachable until parity).
- Permission/tenant: `requirePermission("competitions.manage")`; every `studentId`/`batchId` re-fetched with `orgId = session.orgId`; competition lookups always `{ id, orgId }`. Fixture generation only in DRAFT; regenerate deletes and recreates fixtures in a transaction.
- Audit: `COMPETITION_CREATED`, `COMPETITION_TEAM_ADDED`, `COMPETITION_FIXTURES_GENERATED`.
- Acceptance: admin can create a 6-team league and an 8-team cup; reload keeps everything.

**S4 — Results, standings, knockout advancement.**
- Files: `competitions.ts` (`recordResult`, `correctResult`, `setFixtureSchedule`), `CompetitionManager.tsx`, coach view in `src/app/coach/page.tsx` (results entry for fixtures involving teams sourced from the coach's batches).
- Permission/tenant: `competitions.manage`, or COACH whose batch is a team's `batchId`; fixture fetched with `orgId`.
- Audit: `FIXTURE_RESULT_RECORDED` {fixtureId, home, away}, `FIXTURE_RESULT_CORRECTED` {before, after}.
- Acceptance: knockout winner fills the next-round slot; standings recompute; correcting a result after the next round was played is blocked with a clear message.

**S5 — Match-day RSVP + parent view.**
- Files: `competitions.ts` (`linkFixtureEvent` creates an `Event` via the same logic as `createEvent` for team members only, sets `Fixture.eventId`), parent tab section listing child's fixtures/results (`src/app/parent/page.tsx`, `ParentClient.tsx`).
- Permission/tenant: parent sees fixtures only where their child is a `CompetitionTeamMember` (query via `student.parentId = session.id`).
- Audit: `FIXTURE_EVENT_LINKED`.
- Acceptance: RSVPs reuse `RSVPButtons`; no new RSVP model.

**S6 — Public results page.**
- Files: `src/app/t/[token]/page.tsx` (read-only, `noindex` by default), `competitions.ts` (`setSharing(competitionId, on, showNames)`), share button reusing WhatsApp text from `TournamentBracket.shareResults`.
- Permission/tenant: public by unguessable `shareToken`; selects team names, fixtures, scores; student names only if `showNames`.
- Audit: `COMPETITION_SHARING_CHANGED`.
- Acceptance: token revoke ⇒ 404; no phones, DOB or medical fields ever selected.

## 7. Feature flag

Existing `events` (`NEXT_PUBLIC_FEATURE_EVENTS`), fallback **false** in `src/lib/features.ts`, already
gates the admin tab. It will also gate: competition actions (return error when off), coach results
entry, parent fixtures section and `/t/[token]`. The existing ungated coach "Matches & events"
(`createEvent`/RSVP) is left as-is unless the founder decides otherwise (§9).

## 8. Dependencies

- **Vertical 1 (Academy operations):** students, batches, enrolments are the team source; `Student` deletion cascades out of teams; branches could later scope competitions by centre.
- **Vertical 5 (Venues):** fixtures should reserve courts through `reserveSlot` with a new `source='EVENT'` — deferred until V5 S3 (batch blocks) proves the pattern.
- **Vertical 3 (Coach careers):** competition results as coach achievements — out of v1.
- **Vertical 4 (Participation):** a public competition page is a discovery source (`source='COMPETITION'`) — later.
- **Athlete OS (`athleteOS` flag):** player stats would build on `CompetitionTeamMember` + fixtures.

## 9. Risks and open questions

1. The coach match/RSVP feature is live while `events` is off. Keep it ungated (it is used day-to-day) or move it under the flag? Recommendation: keep; only the new competition engine is flagged.
2. Inter-academy tournaments (two Triq orgs) need a cross-tenant model and consent; v1 treats opponents as external text teams. Is that acceptable for the Noida/Gurgaon pilots?
3. Showing minors' names publicly: default off (`showNames=false`). Does the academy need parent consent per child?
4. Entry fees: if needed, they must go through `Payment` + Razorpay webhook (`ONLINE_VERIFIED`) or be recorded as `OFFLINE_RECORDED`; not in v1.
5. Sport-specific scoring (cricket runs/wickets, badminton sets) — generic for/against may be too thin for cricket-first academies.
6. RLS status of existing `Event`/`RSVP` tables is not in `2026-10-14_enable_rls_on_exposed_tables.sql`; could not verify from code.
