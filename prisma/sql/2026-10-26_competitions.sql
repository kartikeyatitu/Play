-- TRIQ Play · Competitions, entries and fixtures (docs/specs/03-triq-play.md)
-- Additive only: three new tables. Safe to run more than once. NOT APPLIED.
-- Apply in the Supabase SQL editor BEFORE setting NEXT_PUBLIC_FEATURE_EVENTS=1.

BEGIN;

CREATE TABLE IF NOT EXISTS "Competition" (
  "id"              TEXT NOT NULL,
  "orgId"           TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "sport"           TEXT,
  "format"          TEXT NOT NULL,
  "entryType"       TEXT NOT NULL DEFAULT 'TEAM',
  "legs"            INTEGER NOT NULL DEFAULT 1,
  "status"          TEXT NOT NULL DEFAULT 'DRAFT',
  "startDate"       TIMESTAMP(3),
  "endDate"         TIMESTAMP(3),
  "venue"           TEXT,
  "maxEntries"      INTEGER NOT NULL,
  "minAge"          INTEGER,
  "maxAge"          INTEGER,
  "ageCutoffDate"   TIMESTAMP(3),
  "eligibleBatchId" TEXT,
  "pointsWin"       INTEGER NOT NULL DEFAULT 3,
  "pointsDraw"      INTEGER NOT NULL DEFAULT 1,
  "pointsLoss"      INTEGER NOT NULL DEFAULT 0,
  "allowDraws"      BOOLEAN NOT NULL DEFAULT true,
  "createdById"     TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Competition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Competition_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Competition_orgId_status_idx" ON "Competition" ("orgId", "status");

CREATE TABLE IF NOT EXISTS "CompetitionEntry" (
  "id"             TEXT NOT NULL,
  "orgId"          TEXT NOT NULL,
  "competitionId"  TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "studentId"      TEXT,
  "batchId"        TEXT,
  "seed"           INTEGER,
  "status"         TEXT NOT NULL DEFAULT 'REGISTERED',
  "registeredById" TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompetitionEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompetitionEntry_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompetitionEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompetitionEntry_competitionId_name_key" ON "CompetitionEntry" ("competitionId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "CompetitionEntry_competitionId_studentId_key" ON "CompetitionEntry" ("competitionId", "studentId");
CREATE INDEX IF NOT EXISTS "CompetitionEntry_orgId_idx" ON "CompetitionEntry" ("orgId");

CREATE TABLE IF NOT EXISTS "Fixture" (
  "id"             TEXT NOT NULL,
  "orgId"          TEXT NOT NULL,
  "competitionId"  TEXT NOT NULL,
  "round"          INTEGER NOT NULL,
  "slot"           INTEGER NOT NULL,
  "homeEntryId"    TEXT,
  "awayEntryId"    TEXT,
  "scheduledAt"    TIMESTAMP(3),
  "venue"          TEXT,
  "status"         TEXT NOT NULL DEFAULT 'SCHEDULED',
  "homeScore"      INTEGER,
  "awayScore"      INTEGER,
  "winnerEntryId"  TEXT,
  "officialUserId" TEXT,
  "resultById"     TEXT,
  "resultAt"       TIMESTAMP(3),
  "version"        INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Fixture_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Fixture_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Fixture_homeEntryId_fkey" FOREIGN KEY ("homeEntryId") REFERENCES "CompetitionEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Fixture_awayEntryId_fkey" FOREIGN KEY ("awayEntryId") REFERENCES "CompetitionEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Fixture_winnerEntryId_fkey" FOREIGN KEY ("winnerEntryId") REFERENCES "CompetitionEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Fixture_competitionId_round_slot_key" ON "Fixture" ("competitionId", "round", "slot");
CREATE INDEX IF NOT EXISTS "Fixture_orgId_scheduledAt_idx" ON "Fixture" ("orgId", "scheduledAt");
CREATE INDEX IF NOT EXISTS "Fixture_officialUserId_idx" ON "Fixture" ("officialUserId");

-- Same posture as 2026-10-14_enable_rls_on_exposed_tables.sql: the app connects as the table owner,
-- RLS with no policies blocks the public anon/authenticated PostgREST roles.
ALTER TABLE "Competition"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompetitionEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Fixture"          ENABLE ROW LEVEL SECURITY;

COMMIT;
