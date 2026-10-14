-- Triq · Sprint 1 · Team memberships and staff attendance
-- Additive only: creates two new tables and backfills memberships for existing owners and coaches.
-- Safe to run more than once. Run it in the Supabase SQL editor BEFORE deploying the matching code.

BEGIN;

CREATE TABLE IF NOT EXISTS "OrgMembership" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "orgId"       TEXT NOT NULL,
  "role"        TEXT NOT NULL,
  "staffRole"   TEXT,
  "title"       TEXT,
  "permissions" TEXT,
  "status"      TEXT NOT NULL DEFAULT 'ACTIVE',
  "payType"     TEXT,
  "payAmount"   INTEGER,
  "joinedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt"   TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrgMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrgMembership_userId_orgId_key" ON "OrgMembership" ("userId", "orgId");
CREATE INDEX IF NOT EXISTS "OrgMembership_orgId_status_idx" ON "OrgMembership" ("orgId", "status");

CREATE TABLE IF NOT EXISTS "StaffAttendance" (
  "id"           TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "orgId"        TEXT NOT NULL,
  "date"         TIMESTAMP(3) NOT NULL,
  "status"       TEXT NOT NULL,
  "checkInAt"    TIMESTAMP(3),
  "checkOutAt"   TIMESTAMP(3),
  "note"         TEXT,
  "markedById"   TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StaffAttendance_membershipId_date_key" ON "StaffAttendance" ("membershipId", "date");
CREATE INDEX IF NOT EXISTS "StaffAttendance_orgId_date_idx" ON "StaffAttendance" ("orgId", "date");

DO $$ BEGIN
  ALTER TABLE "OrgMembership" ADD CONSTRAINT "OrgMembership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrgMembership" ADD CONSTRAINT "OrgMembership_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_membershipId_fkey"
    FOREIGN KEY ("membershipId") REFERENCES "OrgMembership" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "OrgMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffAttendance" ENABLE ROW LEVEL SECURITY;

-- Backfill: every existing academy admin becomes OWNER, every coach becomes COACH.
-- (The app also does this lazily, so this step is a convenience, not a requirement.)
INSERT INTO "OrgMembership" ("id", "userId", "orgId", "role", "status", "joinedAt", "createdAt", "updatedAt")
SELECT
  'm_' || replace(gen_random_uuid()::text, '-', ''),
  u."id",
  u."orgId",
  CASE WHEN u."role" = 'ADMIN' THEN 'OWNER' ELSE u."role" END,
  'ACTIVE',
  u."createdAt",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
WHERE u."orgId" IS NOT NULL
  AND u."role" IN ('ADMIN', 'COACH', 'STAFF')
ON CONFLICT ("userId", "orgId") DO NOTHING;

COMMIT;

-- Check: SELECT "role", count(*) FROM "OrgMembership" GROUP BY "role";
