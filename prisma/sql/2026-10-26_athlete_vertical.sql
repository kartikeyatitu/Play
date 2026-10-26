-- V2 TRIQ Athlete. Additive only. NOT APPLIED to production. Requires founder approval before running.
-- Apply BEFORE setting NEXT_PUBLIC_FEATURE_ATHLETE_OS=1 or NEXT_PUBLIC_FEATURE_OPPORTUNITIES=1.
-- (NEXT_PUBLIC_FEATURE_PROGRESS_REPORT needs no schema change.)

CREATE TABLE IF NOT EXISTS "AthleteAchievement" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'ACHIEVEMENT',
  "title" TEXT NOT NULL,
  "competition" TEXT,
  "level" TEXT NOT NULL DEFAULT 'OTHER',
  "result" TEXT,
  "eventDate" TIMESTAMP(3) NOT NULL,
  "evidenceUrl" TEXT,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "submittedById" TEXT NOT NULL,
  "submittedByRole" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "verifiedById" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AthleteAchievement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AthleteAchievement_orgId_status_idx" ON "AthleteAchievement" ("orgId", "status");
CREATE INDEX IF NOT EXISTS "AthleteAchievement_studentId_eventDate_idx" ON "AthleteAchievement" ("studentId", "eventDate");

CREATE TABLE IF NOT EXISTS "AthleteGoal" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "setById" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "metric" TEXT,
  "baseline" DOUBLE PRECISION,
  "target" DOUBLE PRECISION,
  "dueDate" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "achievedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AthleteGoal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AthleteGoal_orgId_idx" ON "AthleteGoal" ("orgId");
CREATE INDEX IF NOT EXISTS "AthleteGoal_studentId_status_idx" ON "AthleteGoal" ("studentId", "status");

CREATE TABLE IF NOT EXISTS "Opportunity" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'TRIAL',
  "sport" TEXT,
  "location" TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "applyBy" TIMESTAMP(3) NOT NULL,
  "ageMin" INTEGER,
  "ageMax" INTEGER,
  "url" TEXT,
  "description" TEXT,
  "batchId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Opportunity_orgId_status_idx" ON "Opportunity" ("orgId", "status");

CREATE TABLE IF NOT EXISTS "OpportunityApplication" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "parentId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'APPLIED',
  "guardianConsent" BOOLEAN NOT NULL DEFAULT false,
  "consentAt" TIMESTAMP(3),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OpportunityApplication_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OpportunityApplication_opportunityId_studentId_key" ON "OpportunityApplication" ("opportunityId", "studentId");
CREATE INDEX IF NOT EXISTS "OpportunityApplication_orgId_status_idx" ON "OpportunityApplication" ("orgId", "status");
CREATE INDEX IF NOT EXISTS "OpportunityApplication_studentId_idx" ON "OpportunityApplication" ("studentId");

CREATE TABLE IF NOT EXISTS "OpportunityApplicationEvent" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OpportunityApplicationEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OpportunityApplicationEvent_applicationId_createdAt_idx" ON "OpportunityApplicationEvent" ("applicationId", "createdAt");
CREATE INDEX IF NOT EXISTS "OpportunityApplicationEvent_orgId_idx" ON "OpportunityApplicationEvent" ("orgId");

-- Foreign keys (idempotent). Deleting a student or academy removes its athlete records.
DO $$ BEGIN ALTER TABLE "AthleteAchievement" ADD CONSTRAINT "AthleteAchievement_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AthleteAchievement" ADD CONSTRAINT "AthleteAchievement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AthleteGoal" ADD CONSTRAINT "AthleteGoal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AthleteGoal" ADD CONSTRAINT "AthleteGoal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OpportunityApplication" ADD CONSTRAINT "OpportunityApplication_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OpportunityApplication" ADD CONSTRAINT "OpportunityApplication_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OpportunityApplication" ADD CONSTRAINT "OpportunityApplication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OpportunityApplicationEvent" ADD CONSTRAINT "OpportunityApplicationEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OpportunityApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OpportunityApplicationEvent" ADD CONSTRAINT "OpportunityApplicationEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Close Supabase's public REST path (the app connects as table owner and is unaffected).
ALTER TABLE "AthleteAchievement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AthleteGoal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Opportunity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OpportunityApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OpportunityApplicationEvent" ENABLE ROW LEVEL SECURITY;
