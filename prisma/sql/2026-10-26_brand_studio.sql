-- V9 TRIQ Brand Studio: sponsors, campaigns, proposals, deliverables, status history,
-- scholarship programs and fee concessions. Additive only (new tables).
-- NOT APPLIED to production. Apply before setting NEXT_PUBLIC_FEATURE_SPONSORSHIP=1 or
-- NEXT_PUBLIC_FEATURE_INCLUSIVE=1. Money columns are integer paise (INR) except
-- FeeConcession.amountOff, which is whole currency units like FeeRecord.amount / Batch.monthlyFee.

CREATE TABLE IF NOT EXISTS "SponsorProfile" (
  "id"           TEXT PRIMARY KEY,
  "orgId"        TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "name"         TEXT NOT NULL,
  "kind"         TEXT NOT NULL DEFAULT 'BRAND',
  "contactName"  TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "website"      TEXT,
  "about"        TEXT,
  "archivedAt"   TIMESTAMP(3),
  "createdById"  TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "SponsorProfile_orgId_idx" ON "SponsorProfile"("orgId");
ALTER TABLE "SponsorProfile" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "SponsorshipCampaign" (
  "id"                  TEXT PRIMARY KEY,
  "orgId"               TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "sponsorId"           TEXT REFERENCES "SponsorProfile"("id") ON DELETE SET NULL,
  "title"               TEXT NOT NULL,
  "scope"               TEXT NOT NULL,
  "objective"           TEXT NOT NULL,
  "targetAudience"      TEXT,
  "budgetPaise"         INTEGER NOT NULL DEFAULT 0 CHECK ("budgetPaise" >= 0),
  "committedPaise"      INTEGER NOT NULL DEFAULT 0 CHECK ("committedPaise" >= 0),
  "currency"            TEXT NOT NULL DEFAULT 'INR',
  "deliverablesSummary" TEXT,
  "startDate"           TIMESTAMP(3),
  "endDate"             TIMESTAMP(3),
  "status"              TEXT NOT NULL DEFAULT 'DRAFT',
  "createdById"         TEXT NOT NULL,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SponsorshipCampaign_commit_within_budget" CHECK ("committedPaise" <= "budgetPaise")
);
CREATE INDEX IF NOT EXISTS "SponsorshipCampaign_orgId_status_idx" ON "SponsorshipCampaign"("orgId", "status");
ALTER TABLE "SponsorshipCampaign" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "SponsorshipProposal" (
  "id"            TEXT PRIMARY KEY,
  "orgId"         TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "campaignId"    TEXT NOT NULL REFERENCES "SponsorshipCampaign"("id") ON DELETE CASCADE,
  "applicantType" TEXT NOT NULL,
  "applicantName" TEXT NOT NULL,
  "studentId"     TEXT REFERENCES "Student"("id") ON DELETE SET NULL,
  "pitch"         TEXT NOT NULL,
  "askPaise"      INTEGER NOT NULL DEFAULT 0 CHECK ("askPaise" >= 0),
  "approvedPaise" INTEGER CHECK ("approvedPaise" IS NULL OR "approvedPaise" >= 0),
  "status"        TEXT NOT NULL DEFAULT 'SUBMITTED',
  "submittedById" TEXT NOT NULL,
  "decidedById"   TEXT,
  "decidedAt"     TIMESTAMP(3),
  "decisionNote"  TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "SponsorshipProposal_orgId_status_idx" ON "SponsorshipProposal"("orgId", "status");
CREATE INDEX IF NOT EXISTS "SponsorshipProposal_campaignId_idx" ON "SponsorshipProposal"("campaignId");
ALTER TABLE "SponsorshipProposal" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "SponsorshipDeliverable" (
  "id"           TEXT PRIMARY KEY,
  "orgId"        TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "proposalId"   TEXT NOT NULL REFERENCES "SponsorshipProposal"("id") ON DELETE CASCADE,
  "title"        TEXT NOT NULL,
  "kind"         TEXT NOT NULL DEFAULT 'DELIVERABLE',
  "dueDate"      TIMESTAMP(3),
  "status"       TEXT NOT NULL DEFAULT 'PENDING',
  "evidenceUrl"  TEXT,
  "note"         TEXT,
  "completedAt"  TIMESTAMP(3),
  "verifiedById" TEXT,
  "createdById"  TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "SponsorshipDeliverable_orgId_idx" ON "SponsorshipDeliverable"("orgId");
CREATE INDEX IF NOT EXISTS "SponsorshipDeliverable_proposalId_idx" ON "SponsorshipDeliverable"("proposalId");
ALTER TABLE "SponsorshipDeliverable" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "SponsorshipStatusEvent" (
  "id"         TEXT PRIMARY KEY,
  "orgId"      TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "entityType" TEXT NOT NULL,
  "entityId"   TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus"   TEXT NOT NULL,
  "actorId"    TEXT NOT NULL,
  "note"       TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "SponsorshipStatusEvent_orgId_entityType_entityId_idx" ON "SponsorshipStatusEvent"("orgId", "entityType", "entityId");
ALTER TABLE "SponsorshipStatusEvent" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "ScholarshipProgram" (
  "id"                 TEXT PRIMARY KEY,
  "orgId"              TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "sponsorId"          TEXT REFERENCES "SponsorProfile"("id") ON DELETE SET NULL,
  "name"               TEXT NOT NULL,
  "kind"               TEXT NOT NULL DEFAULT 'SCHOLARSHIP',
  "description"        TEXT,
  "monthlyBudgetPaise" INTEGER CHECK ("monthlyBudgetPaise" IS NULL OR "monthlyBudgetPaise" >= 0),
  "status"             TEXT NOT NULL DEFAULT 'DRAFT',
  "approvedById"       TEXT,
  "approvedAt"         TIMESTAMP(3),
  "createdById"        TEXT NOT NULL,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ScholarshipProgram_orgId_status_idx" ON "ScholarshipProgram"("orgId", "status");
ALTER TABLE "ScholarshipProgram" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "FeeConcession" (
  "id"           TEXT PRIMARY KEY,
  "orgId"        TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "studentId"    TEXT NOT NULL REFERENCES "Student"("id") ON DELETE CASCADE,
  "programId"    TEXT REFERENCES "ScholarshipProgram"("id") ON DELETE SET NULL,
  "category"     TEXT NOT NULL,
  "percentOff"   INTEGER,
  "amountOff"    INTEGER,
  "startMonth"   TEXT NOT NULL,
  "endMonth"     TEXT,
  "reason"       TEXT,
  "approvedById" TEXT NOT NULL,
  "revokedAt"    TIMESTAMP(3),
  "revokedById"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeeConcession_one_kind" CHECK (("percentOff" IS NULL) <> ("amountOff" IS NULL)),
  CONSTRAINT "FeeConcession_percent_range" CHECK ("percentOff" IS NULL OR ("percentOff" BETWEEN 1 AND 100)),
  CONSTRAINT "FeeConcession_amount_pos" CHECK ("amountOff" IS NULL OR "amountOff" > 0)
);
CREATE INDEX IF NOT EXISTS "FeeConcession_orgId_studentId_idx" ON "FeeConcession"("orgId", "studentId");
ALTER TABLE "FeeConcession" ENABLE ROW LEVEL SECURITY;
