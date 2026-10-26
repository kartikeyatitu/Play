-- V5 TRIQ Careers. Additive only. NOT APPLIED. Apply before enabling NEXT_PUBLIC_FEATURE_CAREERS.
CREATE TABLE IF NOT EXISTS "ProfessionalProfile" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "headline" TEXT, "bio" TEXT,
  "sports" TEXT[] NOT NULL DEFAULT '{}',
  "city" TEXT, "yearsExperience" INTEGER,
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProfessionalProfile_userId_key" ON "ProfessionalProfile"("userId");

CREATE TABLE IF NOT EXISTS "ProfessionalExperience" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL, "organization" TEXT NOT NULL,
  "startYear" INTEGER NOT NULL, "endYear" INTEGER, "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ProfessionalExperience_userId_idx" ON "ProfessionalExperience"("userId");

CREATE TABLE IF NOT EXISTS "ProfessionalCredential" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL, "title" TEXT NOT NULL, "issuer" TEXT, "issuedYear" INTEGER, "evidenceUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3),
  "verifiedById" TEXT, "verifiedAt" TIMESTAMP(3),
  "rejectReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ProfessionalCredential_userId_idx" ON "ProfessionalCredential"("userId");
CREATE INDEX IF NOT EXISTS "ProfessionalCredential_status_idx" ON "ProfessionalCredential"("status");

CREATE TABLE IF NOT EXISTS "JobListing" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL, "role" TEXT NOT NULL, "sport" TEXT, "city" TEXT NOT NULL,
  "employmentType" TEXT NOT NULL, "description" TEXT NOT NULL, "requirements" TEXT,
  "payMin" INTEGER, "payMax" INTEGER, "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "JobListing_orgId_status_idx" ON "JobListing"("orgId","status");
CREATE INDEX IF NOT EXISTS "JobListing_status_createdAt_idx" ON "JobListing"("status","createdAt");

CREATE TABLE IF NOT EXISTS "JobApplication" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "jobId" TEXT NOT NULL REFERENCES "JobListing"("id") ON DELETE CASCADE,
  "applicantId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "coverNote" TEXT,
  "status" TEXT NOT NULL DEFAULT 'APPLIED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "JobApplication_jobId_applicantId_key" ON "JobApplication"("jobId","applicantId");
CREATE INDEX IF NOT EXISTS "JobApplication_orgId_jobId_idx" ON "JobApplication"("orgId","jobId");
CREATE INDEX IF NOT EXISTS "JobApplication_applicantId_idx" ON "JobApplication"("applicantId");

CREATE TABLE IF NOT EXISTS "JobApplicationEvent" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "applicationId" TEXT NOT NULL REFERENCES "JobApplication"("id") ON DELETE CASCADE,
  "fromStatus" TEXT, "toStatus" TEXT NOT NULL,
  "actorId" TEXT NOT NULL, "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "JobApplicationEvent_applicationId_createdAt_idx" ON "JobApplicationEvent"("applicationId","createdAt");
CREATE INDEX IF NOT EXISTS "JobApplicationEvent_orgId_idx" ON "JobApplicationEvent"("orgId");

-- Close Supabase's public REST path; the app connects as the table owner.
ALTER TABLE "ProfessionalProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProfessionalExperience" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProfessionalCredential" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobListing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobApplicationEvent" ENABLE ROW LEVEL SECURITY;
