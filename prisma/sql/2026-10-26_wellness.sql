-- V6 TRIQ Wellness. Additive only. NOT APPLIED. Apply before enabling NEXT_PUBLIC_FEATURE_WELLNESS.
-- (The health.* permission changes need no SQL: permissions are code + OrgMembership.permissions JSON.)
CREATE TABLE IF NOT EXISTS "WellnessProvider" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "displayName" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "services" TEXT, "bio" TEXT, "city" TEXT,
  "registrationBody" TEXT, "registrationNumber" TEXT,
  "credentialStatus" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "credentialReviewedById" TEXT, "credentialReviewedAt" TIMESTAMP(3),
  "credentialVerifiedById" TEXT, "credentialVerifiedAt" TIMESTAMP(3),
  "credentialRejectReason" TEXT,
  "isListed" BOOLEAN NOT NULL DEFAULT false,
  "acceptingRequests" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "WellnessProvider_userId_key" ON "WellnessProvider"("userId");
CREATE INDEX IF NOT EXISTS "WellnessProvider_isListed_category_idx" ON "WellnessProvider"("isListed","category");

CREATE TABLE IF NOT EXISTS "WellnessAppointment" (
  "id" TEXT PRIMARY KEY,
  "providerId" TEXT NOT NULL REFERENCES "WellnessProvider"("id") ON DELETE CASCADE,
  "providerUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "requesterId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "category" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "confirmedAt" TIMESTAMP(3), "declinedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "cancelledAt" TIMESTAMP(3),
  "cancelledById" TEXT, "cancelReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "WellnessAppointment_providerUserId_status_scheduledAt_idx" ON "WellnessAppointment"("providerUserId","status","scheduledAt");
CREATE INDEX IF NOT EXISTS "WellnessAppointment_requesterId_createdAt_idx" ON "WellnessAppointment"("requesterId","createdAt");

ALTER TABLE "WellnessProvider" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WellnessAppointment" ENABLE ROW LEVEL SECURITY;
