-- TRIQ Play · multi-sport live scoring (docs/specs/live-scoring.md). Additive only. APPLIED to production 2026-10-28 with founder approval.
-- One shared match + append-only event log for every sport family; sport rules live in src/lib/scoring/*.
-- Apply in Supabase only after founder approval, then add the Prisma models and turn on NEXT_PUBLIC_FEATURE_LIVE_SCORING.

BEGIN;

CREATE TABLE IF NOT EXISTS "LiveMatch" (
  "id"            TEXT PRIMARY KEY,
  "orgId"         TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "sport"         TEXT NOT NULL,                 -- cricket | football | badminton | swimming | ...
  "family"        TEXT NOT NULL,                 -- cricket | goals | rally | tennis | performance | bout | chess
  "config"        JSONB NOT NULL DEFAULT '{}',   -- overs, periods, points to win, sets, rounds...
  "title"         TEXT NOT NULL,
  "fixtureId"     TEXT REFERENCES "Fixture"("id") ON DELETE SET NULL,  -- when part of a competition
  "eventId"       TEXT REFERENCES "Event"("id") ON DELETE SET NULL,    -- when created from a batch match/event
  "homeName"      TEXT NOT NULL,
  "awayName"      TEXT,                          -- null for multi-athlete events (races, meets)
  "venue"         TEXT,
  "scheduledAt"   TIMESTAMP(3),
  "status"        TEXT NOT NULL DEFAULT 'SCHEDULED', -- SCHEDULED | LIVE | COMPLETED | ABANDONED
  "visibility"    TEXT NOT NULL DEFAULT 'ACADEMY',   -- PRIVATE | ACADEMY | LINK (anyone with the share link)
  "shareToken"    TEXT UNIQUE,
  "scorerUserId"  TEXT,                          -- coach/staff allowed to score; admins always can
  "state"         JSONB,                         -- cached result of replaying the events (recomputable)
  "version"       INTEGER NOT NULL DEFAULT 0,    -- optimistic concurrency for scorers
  "startedAt"     TIMESTAMP(3),
  "endedAt"       TIMESTAMP(3),
  "createdById"   TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LiveMatch_orgId_status_idx" ON "LiveMatch" ("orgId", "status");
CREATE INDEX IF NOT EXISTS "LiveMatch_orgId_scheduledAt_idx" ON "LiveMatch" ("orgId", "scheduledAt");

CREATE TABLE IF NOT EXISTS "LiveMatchPlayer" (
  "id"          TEXT PRIMARY KEY,
  "orgId"       TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "matchId"     TEXT NOT NULL REFERENCES "LiveMatch"("id") ON DELETE CASCADE,
  "side"        TEXT NOT NULL,                   -- home | away | field (races/meets)
  "studentId"   TEXT REFERENCES "Student"("id") ON DELETE SET NULL, -- null for opposition players
  "displayName" TEXT NOT NULL,
  "shirt"       TEXT,
  "role"        TEXT,                            -- captain, keeper, lane 4, white/black...
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "LiveMatchPlayer_matchId_studentId_key" ON "LiveMatchPlayer" ("matchId", "studentId");
CREATE INDEX IF NOT EXISTS "LiveMatchPlayer_studentId_idx" ON "LiveMatchPlayer" ("studentId");

-- Append-only: corrections void an event (never delete), so every score can be audited and replayed.
CREATE TABLE IF NOT EXISTS "LiveMatchEvent" (
  "id"          TEXT PRIMARY KEY,
  "orgId"       TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "matchId"     TEXT NOT NULL REFERENCES "LiveMatch"("id") ON DELETE CASCADE,
  "seq"         INTEGER NOT NULL,
  "type"        TEXT NOT NULL,                   -- ball, score, point, card, period_start, result...
  "payload"     JSONB NOT NULL,
  "clientId"    TEXT,                            -- idempotency key from the scorer's phone (offline sync)
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voidedAt"    TIMESTAMP(3),
  "voidedById"  TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "LiveMatchEvent_matchId_seq_key" ON "LiveMatchEvent" ("matchId", "seq");
CREATE UNIQUE INDEX IF NOT EXISTS "LiveMatchEvent_matchId_clientId_key" ON "LiveMatchEvent" ("matchId", "clientId");

-- Per-athlete stats for one finished match, written when the match completes (profiles and leaderboards read these).
CREATE TABLE IF NOT EXISTS "AthleteMatchStat" (
  "id"          TEXT PRIMARY KEY,
  "orgId"       TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "matchId"     TEXT NOT NULL REFERENCES "LiveMatch"("id") ON DELETE CASCADE,
  "studentId"   TEXT NOT NULL REFERENCES "Student"("id") ON DELETE CASCADE,
  "sport"       TEXT NOT NULL,
  "stats"       JSONB NOT NULL,                  -- e.g. {"runs":42,"balls":30,"fours":5} or {"goals":2,"assists":1}
  "playedAt"    TIMESTAMP(3) NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "AthleteMatchStat_matchId_studentId_key" ON "AthleteMatchStat" ("matchId", "studentId");
CREATE INDEX IF NOT EXISTS "AthleteMatchStat_studentId_sport_idx" ON "AthleteMatchStat" ("studentId", "sport", "playedAt");

-- Timed / measured results (swimming, athletics, skating, cycling). Base units: ms for time, cm for distance/height.
CREATE TABLE IF NOT EXISTS "PerformanceResult" (
  "id"             TEXT PRIMARY KEY,
  "orgId"          TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "matchId"        TEXT REFERENCES "LiveMatch"("id") ON DELETE SET NULL, -- the meet/heat, optional for training trials
  "studentId"      TEXT NOT NULL REFERENCES "Student"("id") ON DELETE CASCADE,
  "sport"          TEXT NOT NULL,
  "eventName"      TEXT NOT NULL,                -- "50m freestyle", "Long jump", "500m rink"
  "measure"        TEXT NOT NULL,                -- time | distance | height | points
  "value"          INTEGER,                      -- null with DNS/DNF/DQ
  "status"         TEXT NOT NULL DEFAULT 'OK',   -- OK | DNS | DNF | DQ
  "attempt"        INTEGER,
  "isPersonalBest" BOOLEAN NOT NULL DEFAULT false,
  "recordedById"   TEXT NOT NULL,
  "recordedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PerformanceResult_studentId_event_idx" ON "PerformanceResult" ("studentId", "sport", "eventName", "recordedAt");
CREATE INDEX IF NOT EXISTS "PerformanceResult_orgId_idx" ON "PerformanceResult" ("orgId");

ALTER TABLE "LiveMatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LiveMatchPlayer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LiveMatchEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AthleteMatchStat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerformanceResult" ENABLE ROW LEVEL SECURITY;

COMMIT;
