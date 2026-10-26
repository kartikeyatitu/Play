-- V7 TRIQ Creators. Additive only. NOT APPLIED. Apply before enabling NEXT_PUBLIC_FEATURE_CREATORS.
CREATE TABLE IF NOT EXISTS "CreatorProfile" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "handle" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "bio" TEXT, "city" TEXT,
  "sports" TEXT[] NOT NULL DEFAULT '{}',
  "categories" TEXT[] NOT NULL DEFAULT '{}',
  "linkCoachPage" BOOLEAN NOT NULL DEFAULT false,
  "linkedOrgId" TEXT REFERENCES "Organization"("id") ON DELETE SET NULL,
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "hiddenAt" TIMESTAMP(3), "hiddenById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CreatorProfile_userId_key" ON "CreatorProfile"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "CreatorProfile_handle_key" ON "CreatorProfile"("handle");
CREATE INDEX IF NOT EXISTS "CreatorProfile_isPublic_updatedAt_idx" ON "CreatorProfile"("isPublic","updatedAt");

CREATE TABLE IF NOT EXISTS "CreatorPortfolioItem" (
  "id" TEXT PRIMARY KEY,
  "creatorId" TEXT NOT NULL REFERENCES "CreatorProfile"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL, "url" TEXT NOT NULL, "platform" TEXT NOT NULL, "description" TEXT,
  "hiddenAt" TIMESTAMP(3), "hiddenById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CreatorPortfolioItem_creatorId_createdAt_idx" ON "CreatorPortfolioItem"("creatorId","createdAt");

CREATE TABLE IF NOT EXISTS "CreatorProfileView" (
  "id" TEXT PRIMARY KEY,
  "creatorId" TEXT NOT NULL REFERENCES "CreatorProfile"("id") ON DELETE CASCADE,
  "viewerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CreatorProfileView_creatorId_createdAt_idx" ON "CreatorProfileView"("creatorId","createdAt");

CREATE TABLE IF NOT EXISTS "ContentReport" (
  "id" TEXT PRIMARY KEY,
  "targetType" TEXT NOT NULL, "targetId" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL REFERENCES "CreatorProfile"("id") ON DELETE CASCADE,
  "reporterId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "reason" TEXT NOT NULL, "details" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "resolvedById" TEXT, "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ContentReport_targetType_targetId_reporterId_key" ON "ContentReport"("targetType","targetId","reporterId");
CREATE INDEX IF NOT EXISTS "ContentReport_status_createdAt_idx" ON "ContentReport"("status","createdAt");

ALTER TABLE "CreatorProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CreatorPortfolioItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CreatorProfileView" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContentReport" ENABLE ROW LEVEL SECURITY;
