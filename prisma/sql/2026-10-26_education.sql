-- V10 TRIQ Education. Additive only. NOT APPLIED to production. Requires founder approval before running.
-- Apply BEFORE setting NEXT_PUBLIC_FEATURE_EDUCATION=1.

CREATE TABLE IF NOT EXISTS "InstitutionProfile" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "affiliation" TEXT,
  "levels" TEXT,
  "website" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstitutionProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "InstitutionProfile_orgId_key" ON "InstitutionProfile" ("orgId");

CREATE TABLE IF NOT EXISTS "SportsProgram" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sport" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SportsProgram_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SportsProgram_orgId_status_idx" ON "SportsProgram" ("orgId", "status");

CREATE TABLE IF NOT EXISTS "ProgramTeam" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "squadType" TEXT NOT NULL DEFAULT 'TEAM',
  "ageGroup" TEXT,
  "gender" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgramTeam_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProgramTeam_batchId_key" ON "ProgramTeam" ("batchId");
CREATE INDEX IF NOT EXISTS "ProgramTeam_orgId_idx" ON "ProgramTeam" ("orgId");
CREATE INDEX IF NOT EXISTS "ProgramTeam_programId_idx" ON "ProgramTeam" ("programId");

CREATE TABLE IF NOT EXISTS "ParticipationRecord" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "teamId" TEXT,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "role" TEXT,
  "result" TEXT,
  "notes" TEXT,
  "recordedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParticipationRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ParticipationRecord_orgId_programId_date_idx" ON "ParticipationRecord" ("orgId", "programId", "date");
CREATE INDEX IF NOT EXISTS "ParticipationRecord_studentId_idx" ON "ParticipationRecord" ("studentId");

DO $$ BEGIN ALTER TABLE "InstitutionProfile" ADD CONSTRAINT "InstitutionProfile_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "SportsProgram" ADD CONSTRAINT "SportsProgram_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ProgramTeam" ADD CONSTRAINT "ProgramTeam_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ProgramTeam" ADD CONSTRAINT "ProgramTeam_programId_fkey" FOREIGN KEY ("programId") REFERENCES "SportsProgram" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ProgramTeam" ADD CONSTRAINT "ProgramTeam_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ParticipationRecord" ADD CONSTRAINT "ParticipationRecord_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ParticipationRecord" ADD CONSTRAINT "ParticipationRecord_programId_fkey" FOREIGN KEY ("programId") REFERENCES "SportsProgram" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ParticipationRecord" ADD CONSTRAINT "ParticipationRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ParticipationRecord" ADD CONSTRAINT "ParticipationRecord_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ProgramTeam" ("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "InstitutionProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SportsProgram" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProgramTeam" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ParticipationRecord" ENABLE ROW LEVEL SECURITY;
