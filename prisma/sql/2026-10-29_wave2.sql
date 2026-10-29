-- NOT APPLIED. Needs founder approval before running on production.
-- TRIQ wave 2 schema (2026-10-29). Spec: docs/specs/wave2-schema.md. Prisma models: prisma/schema.prisma (WAVE 2 block).
-- Additive only: three nullable columns on "Receipt" and 25 new tables. No existing column or row is changed
-- (except: if the superseded 2026-10-29_trust_batch.sql was already run, "Receipt"."voidedAt" is converted from
-- TIMESTAMPTZ(3) to TIMESTAMP(3) to match every other timestamp column; values are kept, read as UTC).
-- Supersedes prisma/sql/2026-10-29_trust_batch.sql (Receipt void fields + DataRequest are section 8 below).
-- Safe to run more than once (IF NOT EXISTS everywhere). Runs top to bottom in one transaction.
-- RLS is enabled with no policies on every new table (deny by default for anon/authenticated); the app reaches
-- these via Prisma as the table owner / service role, same as every other table in prisma/sql/.
-- Every table is read/written only behind its FEATURES flag in src/lib/features.ts (all default false).
-- Money is integer minor units (paise). Points/XP balances are never stored: sum the ledger.
-- After applying: `npx prisma generate` (the models are already in prisma/schema.prisma).

BEGIN;

-- =============================================================================================
-- 1. Rewards (flag rewards)
-- =============================================================================================

-- Append-only. Corrections are new reversing rows, never UPDATE/DELETE.
CREATE TABLE IF NOT EXISTS "PointsLedger" (
  "id"             TEXT NOT NULL,
  "orgId"          TEXT NOT NULL,
  "studentId"      TEXT NOT NULL,
  "delta"          INTEGER NOT NULL,
  "sourceType"     TEXT NOT NULL,     -- ATTENDANCE | SKILL_REPORT | BADGE | REDEMPTION | MANUAL | EXPIRY | REVERSAL
  "sourceRef"      TEXT,
  "reasonCode"     TEXT NOT NULL,
  "note"           TEXT,
  "createdById"    TEXT,              -- null = system job
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"      TIMESTAMP(3),      -- set on earned (positive) rows
  "idempotencyKey" TEXT NOT NULL,     -- e.g. attendance:<sessionId>:<studentId>
  CONSTRAINT "PointsLedger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PointsLedger_delta_check" CHECK ("delta" <> 0),
  CONSTRAINT "PointsLedger_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PointsLedger_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PointsLedger_idempotencyKey_key" ON "PointsLedger" ("idempotencyKey");
CREATE INDEX IF NOT EXISTS "PointsLedger_orgId_studentId_createdAt_idx" ON "PointsLedger" ("orgId", "studentId", "createdAt");
CREATE INDEX IF NOT EXISTS "PointsLedger_studentId_expiresAt_idx" ON "PointsLedger" ("studentId", "expiresAt");

CREATE TABLE IF NOT EXISTS "XpLedger" (
  "id"             TEXT NOT NULL,
  "orgId"          TEXT NOT NULL,
  "studentId"      TEXT NOT NULL,
  "delta"          INTEGER NOT NULL,
  "sourceType"     TEXT NOT NULL,
  "sourceRef"      TEXT,
  "reasonCode"     TEXT NOT NULL,
  "note"           TEXT,
  "createdById"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idempotencyKey" TEXT NOT NULL,
  CONSTRAINT "XpLedger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "XpLedger_delta_check" CHECK ("delta" <> 0),
  CONSTRAINT "XpLedger_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "XpLedger_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "XpLedger_idempotencyKey_key" ON "XpLedger" ("idempotencyKey");
CREATE INDEX IF NOT EXISTS "XpLedger_orgId_studentId_createdAt_idx" ON "XpLedger" ("orgId", "studentId", "createdAt");

CREATE TABLE IF NOT EXISTS "BadgeDefinition" (
  "id"          TEXT NOT NULL,
  "orgId"       TEXT,                 -- null = global TRIQ badge
  "key"         TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "rule"        JSONB,                -- auto-award rule; null = manual only
  "icon"        TEXT,
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BadgeDefinition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BadgeDefinition_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "BadgeDefinition_orgId_key_key" ON "BadgeDefinition" ("orgId", "key");
-- NULLs are distinct in a unique index, so global keys need their own partial index.
CREATE UNIQUE INDEX IF NOT EXISTS "BadgeDefinition_global_key_key" ON "BadgeDefinition" ("key") WHERE "orgId" IS NULL;
CREATE INDEX IF NOT EXISTS "BadgeDefinition_orgId_idx" ON "BadgeDefinition" ("orgId");

CREATE TABLE IF NOT EXISTS "StudentBadge" (
  "id"          TEXT NOT NULL,
  "orgId"       TEXT NOT NULL,
  "studentId"   TEXT NOT NULL,
  "badgeId"     TEXT NOT NULL,
  "awardedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "awardedById" TEXT,                 -- null = auto
  "reason"      TEXT,
  "revokedAt"   TIMESTAMP(3),
  "revokedById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentBadge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentBadge_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentBadge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "BadgeDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "StudentBadge_studentId_badgeId_key" ON "StudentBadge" ("studentId", "badgeId");
CREATE INDEX IF NOT EXISTS "StudentBadge_orgId_awardedAt_idx" ON "StudentBadge" ("orgId", "awardedAt");

CREATE TABLE IF NOT EXISTS "RewardItem" (
  "id"          TEXT NOT NULL,
  "orgId"       TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "costPoints"  INTEGER NOT NULL,
  "stock"       INTEGER,              -- null = unlimited
  "eligibility" JSONB NOT NULL DEFAULT '{}',
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RewardItem_costPoints_check" CHECK ("costPoints" > 0),
  CONSTRAINT "RewardItem_stock_check" CHECK ("stock" IS NULL OR "stock" >= 0),
  CONSTRAINT "RewardItem_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "RewardItem_orgId_active_idx" ON "RewardItem" ("orgId", "active");

CREATE TABLE IF NOT EXISTS "Redemption" (
  "id"              TEXT NOT NULL,
  "orgId"           TEXT NOT NULL,
  "studentId"       TEXT NOT NULL,
  "rewardItemId"    TEXT NOT NULL,
  "costPoints"      INTEGER NOT NULL,   -- snapshot at request time
  "status"          TEXT NOT NULL DEFAULT 'REQUESTED',
  "requestedById"   TEXT NOT NULL,      -- parent
  "approvedById"    TEXT,
  "approvedAt"      TIMESTAMP(3),
  "fulfilledAt"     TIMESTAMP(3),
  "cancelledAt"     TIMESTAMP(3),
  "cancelReason"    TEXT,
  "pointsLedgerRef" TEXT,               -- PointsLedger.id of the debit row
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Redemption_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Redemption_status_check" CHECK ("status" IN ('REQUESTED', 'APPROVED', 'FULFILLED', 'CANCELLED')),
  CONSTRAINT "Redemption_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Redemption_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Redemption_rewardItemId_fkey" FOREIGN KEY ("rewardItemId") REFERENCES "RewardItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Redemption_orgId_status_idx" ON "Redemption" ("orgId", "status");
CREATE INDEX IF NOT EXISTS "Redemption_studentId_createdAt_idx" ON "Redemption" ("studentId", "createdAt");

CREATE TABLE IF NOT EXISTS "LeaderboardOptIn" (
  "id"         TEXT NOT NULL,
  "orgId"      TEXT NOT NULL,
  "studentId"  TEXT NOT NULL,
  "optedInAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "optedOutAt" TIMESTAMP(3),
  "setById"    TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaderboardOptIn_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeaderboardOptIn_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LeaderboardOptIn_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "LeaderboardOptIn_orgId_studentId_key" ON "LeaderboardOptIn" ("orgId", "studentId");

-- =============================================================================================
-- 2. Media (flag media). Table is "MediaAsset": the legacy "Media" table (video links) already exists.
-- =============================================================================================

CREATE TABLE IF NOT EXISTS "MediaAsset" (
  "id"          TEXT NOT NULL,
  "orgId"       TEXT NOT NULL,
  "contextType" TEXT NOT NULL,
  "contextId"   TEXT,
  "uploaderId"  TEXT NOT NULL,
  "kind"        TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'PENDING',
  "storageKey"  TEXT NOT NULL,
  "mimeType"    TEXT,
  "variants"    JSONB,
  "durationSec" INTEGER,
  "bytes"       INTEGER,
  "caption"     TEXT,
  "deleteAfter" TIMESTAMP(3),
  "deletedAt"   TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MediaAsset_contextType_check" CHECK ("contextType" IN ('MATCH', 'SESSION', 'TOURNAMENT', 'GALLERY')),
  CONSTRAINT "MediaAsset_kind_check" CHECK ("kind" IN ('PHOTO', 'VIDEO')),
  CONSTRAINT "MediaAsset_status_check" CHECK ("status" IN ('PENDING', 'READY', 'QUARANTINED', 'DELETED')),
  CONSTRAINT "MediaAsset_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "MediaAsset_storageKey_key" ON "MediaAsset" ("storageKey");
CREATE INDEX IF NOT EXISTS "MediaAsset_orgId_contextType_contextId_idx" ON "MediaAsset" ("orgId", "contextType", "contextId");
CREATE INDEX IF NOT EXISTS "MediaAsset_orgId_createdAt_idx" ON "MediaAsset" ("orgId", "createdAt");
CREATE INDEX IF NOT EXISTS "MediaAsset_status_deleteAfter_idx" ON "MediaAsset" ("status", "deleteAfter");

CREATE TABLE IF NOT EXISTS "MediaSubject" (
  "id"         TEXT NOT NULL,
  "orgId"      TEXT NOT NULL,
  "mediaId"    TEXT NOT NULL,
  "studentId"  TEXT NOT NULL,
  "taggedById" TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaSubject_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MediaSubject_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MediaSubject_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MediaSubject_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "MediaSubject_mediaId_studentId_key" ON "MediaSubject" ("mediaId", "studentId");
CREATE INDEX IF NOT EXISTS "MediaSubject_studentId_idx" ON "MediaSubject" ("studentId");
CREATE INDEX IF NOT EXISTS "MediaSubject_orgId_idx" ON "MediaSubject" ("orgId");

CREATE TABLE IF NOT EXISTS "MediaConsent" (
  "id"                 TEXT NOT NULL,
  "orgId"              TEXT NOT NULL,
  "studentId"          TEXT NOT NULL,
  "guardianUserId"     TEXT NOT NULL,
  "scope"              TEXT NOT NULL,
  "grantedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "withdrawnAt"        TIMESTAMP(3),
  "verificationMethod" TEXT NOT NULL,
  "noticeVersion"      TEXT NOT NULL,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaConsent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MediaConsent_scope_check" CHECK ("scope" IN ('internal_coaching', 'parents_of_batch', 'academy_public', 'tournament_public')),
  CONSTRAINT "MediaConsent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MediaConsent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MediaConsent_guardianUserId_fkey" FOREIGN KEY ("guardianUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "MediaConsent_studentId_scope_idx" ON "MediaConsent" ("studentId", "scope");
CREATE INDEX IF NOT EXISTS "MediaConsent_orgId_idx" ON "MediaConsent" ("orgId");

-- Append-only.
CREATE TABLE IF NOT EXISTS "MediaAudit" (
  "id"          TEXT NOT NULL,
  "orgId"       TEXT NOT NULL,
  "mediaId"     TEXT,
  "actorUserId" TEXT,                 -- null = system
  "action"      TEXT NOT NULL,
  "details"     JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaAudit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MediaAudit_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MediaAudit_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "MediaAudit_mediaId_createdAt_idx" ON "MediaAudit" ("mediaId", "createdAt");
CREATE INDEX IF NOT EXISTS "MediaAudit_orgId_createdAt_idx" ON "MediaAudit" ("orgId", "createdAt");

-- =============================================================================================
-- 3. Family, waivers and consent (flags familyAccounts, waivers, consentLedger)
-- =============================================================================================

CREATE TABLE IF NOT EXISTS "GuardianLink" (
  "id"                 TEXT NOT NULL,
  "orgId"              TEXT,
  "userId"             TEXT NOT NULL,
  "studentId"          TEXT NOT NULL,
  "relation"           TEXT NOT NULL,   -- MOTHER | FATHER | GUARDIAN | OTHER
  "isPrimary"          BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt"         TIMESTAMP(3),
  "verificationMethod" TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuardianLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GuardianLink_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "GuardianLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GuardianLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "GuardianLink_userId_studentId_key" ON "GuardianLink" ("userId", "studentId");
-- At most one primary guardian per student.
CREATE UNIQUE INDEX IF NOT EXISTS "GuardianLink_studentId_primary_key" ON "GuardianLink" ("studentId") WHERE "isPrimary";
CREATE INDEX IF NOT EXISTS "GuardianLink_studentId_idx" ON "GuardianLink" ("studentId");
CREATE INDEX IF NOT EXISTS "GuardianLink_orgId_idx" ON "GuardianLink" ("orgId");

CREATE TABLE IF NOT EXISTS "WaiverTemplate" (
  "id"          TEXT NOT NULL,
  "orgId"       TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "version"     INTEGER NOT NULL DEFAULT 1,
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WaiverTemplate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WaiverTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "WaiverTemplate_orgId_title_version_key" ON "WaiverTemplate" ("orgId", "title", "version");
CREATE INDEX IF NOT EXISTS "WaiverTemplate_orgId_active_idx" ON "WaiverTemplate" ("orgId", "active");

-- Append-only. "ipHash" = sha256(ip + server salt); the raw IP is never stored.
CREATE TABLE IF NOT EXISTS "WaiverSignature" (
  "id"             TEXT NOT NULL,
  "orgId"          TEXT NOT NULL,
  "templateId"     TEXT NOT NULL,
  "version"        INTEGER NOT NULL,
  "studentId"      TEXT NOT NULL,
  "guardianUserId" TEXT NOT NULL,
  "signedName"     TEXT NOT NULL,
  "signedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipHash"         TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WaiverSignature_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WaiverSignature_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WaiverSignature_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WaiverTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WaiverSignature_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WaiverSignature_guardianUserId_fkey" FOREIGN KEY ("guardianUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "WaiverSignature_templateId_version_studentId_key" ON "WaiverSignature" ("templateId", "version", "studentId");
CREATE INDEX IF NOT EXISTS "WaiverSignature_orgId_signedAt_idx" ON "WaiverSignature" ("orgId", "signedAt");
CREATE INDEX IF NOT EXISTS "WaiverSignature_studentId_idx" ON "WaiverSignature" ("studentId");

CREATE TABLE IF NOT EXISTS "ConsentRecord" (
  "id"             TEXT NOT NULL,
  "orgId"          TEXT NOT NULL,
  "studentId"      TEXT NOT NULL,
  "guardianUserId" TEXT NOT NULL,
  "purpose"        TEXT NOT NULL,
  "granted"        BOOLEAN NOT NULL,
  "grantedAt"      TIMESTAMP(3),
  "withdrawnAt"    TIMESTAMP(3),
  "method"         TEXT NOT NULL,
  "noticeVersion"  TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConsentRecord_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ConsentRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ConsentRecord_guardianUserId_fkey" FOREIGN KEY ("guardianUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ConsentRecord_studentId_purpose_idx" ON "ConsentRecord" ("studentId", "purpose");
CREATE INDEX IF NOT EXISTS "ConsentRecord_orgId_purpose_idx" ON "ConsentRecord" ("orgId", "purpose");

-- =============================================================================================
-- 4. Training (flag drillLibrary)
-- =============================================================================================

CREATE TABLE IF NOT EXISTS "Drill" (
  "id"          TEXT NOT NULL,
  "orgId"       TEXT,                 -- null = TRIQ library drill
  "sport"       TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "durationMin" INTEGER,
  "equipment"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "ageGroup"    TEXT,
  "skillKeys"   JSONB NOT NULL DEFAULT '[]',
  "createdById" TEXT,
  "archivedAt"  TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Drill_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Drill_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Drill_orgId_sport_idx" ON "Drill" ("orgId", "sport");
CREATE INDEX IF NOT EXISTS "Drill_sport_idx" ON "Drill" ("sport");

CREATE TABLE IF NOT EXISTS "SessionPlan" (
  "id"          TEXT NOT NULL,
  "orgId"       TEXT NOT NULL,
  "batchId"     TEXT,
  "title"       TEXT NOT NULL,
  "sport"       TEXT NOT NULL,
  "date"        TIMESTAMP(3),
  "notes"       TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionPlan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SessionPlan_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SessionPlan_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SessionPlan_orgId_date_idx" ON "SessionPlan" ("orgId", "date");
CREATE INDEX IF NOT EXISTS "SessionPlan_batchId_idx" ON "SessionPlan" ("batchId");

CREATE TABLE IF NOT EXISTS "SessionPlanItem" (
  "id"          TEXT NOT NULL,
  "orgId"       TEXT NOT NULL,
  "planId"      TEXT NOT NULL,
  "drillId"     TEXT,
  "order"       INTEGER NOT NULL,
  "title"       TEXT,                 -- free-text item when "drillId" is null
  "durationMin" INTEGER,
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionPlanItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SessionPlanItem_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SessionPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SessionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SessionPlanItem_drillId_fkey" FOREIGN KEY ("drillId") REFERENCES "Drill"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SessionPlanItem_planId_order_idx" ON "SessionPlanItem" ("planId", "order");
CREATE INDEX IF NOT EXISTS "SessionPlanItem_drillId_idx" ON "SessionPlanItem" ("drillId");

-- =============================================================================================
-- 5. Competitions (flag fixtures): NOTHING TO CREATE. "Fixture" already exists (2026-10-26_competitions.sql)
--    and "LiveMatch"."fixtureId" links a fixture to live scoring. Standings are computed from completed
--    fixtures + Competition.pointsWin/Draw/Loss; no standings table.
-- =============================================================================================

-- =============================================================================================
-- 6. Event waitlist (flag eventWaitlist)
-- =============================================================================================

CREATE TABLE IF NOT EXISTS "EventWaitlist" (
  "id"             TEXT NOT NULL,
  "orgId"          TEXT,
  "eventId"        TEXT NOT NULL,
  "studentId"      TEXT NOT NULL,
  "position"       INTEGER NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'WAITING',
  "offeredAt"      TIMESTAMP(3),
  "offerExpiresAt" TIMESTAMP(3),
  "respondedAt"    TIMESTAMP(3),
  "createdById"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventWaitlist_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventWaitlist_status_check" CHECK ("status" IN ('WAITING', 'OFFERED', 'ACCEPTED', 'EXPIRED')),
  CONSTRAINT "EventWaitlist_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EventWaitlist_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EventWaitlist_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "EventWaitlist_eventId_studentId_key" ON "EventWaitlist" ("eventId", "studentId");
CREATE INDEX IF NOT EXISTS "EventWaitlist_eventId_status_position_idx" ON "EventWaitlist" ("eventId", "status", "position");
CREATE INDEX IF NOT EXISTS "EventWaitlist_orgId_idx" ON "EventWaitlist" ("orgId");

-- =============================================================================================
-- 7. Messaging (flag messageDelivery)
-- =============================================================================================

-- "toRef" = sha256 of the normalised recipient; the phone/email itself is never stored here.
CREATE TABLE IF NOT EXISTS "MessageDelivery" (
  "id"                TEXT NOT NULL,
  "orgId"             TEXT,           -- null = platform message (e.g. OTP)
  "channel"           TEXT NOT NULL,
  "toRef"             TEXT NOT NULL,
  "template"          TEXT NOT NULL,
  "status"            TEXT NOT NULL DEFAULT 'QUEUED',
  "attempts"          INTEGER NOT NULL DEFAULT 0,
  "providerMessageId" TEXT,
  "lastError"         TEXT,
  "nextAttemptAt"     TIMESTAMP(3),
  "relatedType"       TEXT,
  "relatedId"         TEXT,
  "idempotencyKey"    TEXT,
  "sentAt"            TIMESTAMP(3),
  "deliveredAt"       TIMESTAMP(3),
  "readAt"            TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MessageDelivery_channel_check" CHECK ("channel" IN ('WHATSAPP', 'EMAIL', 'SMS')),
  CONSTRAINT "MessageDelivery_status_check" CHECK ("status" IN ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED')),
  CONSTRAINT "MessageDelivery_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "MessageDelivery_providerMessageId_key" ON "MessageDelivery" ("providerMessageId");
CREATE UNIQUE INDEX IF NOT EXISTS "MessageDelivery_idempotencyKey_key" ON "MessageDelivery" ("idempotencyKey");
CREATE INDEX IF NOT EXISTS "MessageDelivery_status_nextAttemptAt_idx" ON "MessageDelivery" ("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "MessageDelivery_orgId_createdAt_idx" ON "MessageDelivery" ("orgId", "createdAt");
CREATE INDEX IF NOT EXISTS "MessageDelivery_relatedType_relatedId_idx" ON "MessageDelivery" ("relatedType", "relatedId");

CREATE TABLE IF NOT EXISTS "NotificationPreference" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "channel"   TEXT NOT NULL,
  "category"  TEXT NOT NULL,
  "enabled"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationPreference_userId_channel_category_key" ON "NotificationPreference" ("userId", "channel", "category");

-- =============================================================================================
-- 8. Trust (flags receiptVoid, dataRequests). Same content as 2026-10-29_trust_batch.sql (superseded),
--    with "voidedAt" as TIMESTAMP(3) to match every other timestamp column.
-- =============================================================================================

ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "voidedAt"   TIMESTAMP(3);
ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "voidReason" TEXT;
ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "voidedById" TEXT;
-- If the superseded trust_batch file was already run, "voidedAt" is TIMESTAMPTZ: convert it (values kept, as UTC).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'Receipt' AND column_name = 'voidedAt'
      AND data_type = 'timestamp with time zone'
  ) THEN
    ALTER TABLE "Receipt" ALTER COLUMN "voidedAt" TYPE TIMESTAMP(3) USING ("voidedAt" AT TIME ZONE 'UTC');
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "Receipt_orgId_voidedAt_idx" ON "Receipt" ("orgId", "voidedAt");

CREATE TABLE IF NOT EXISTS "DataRequest" (
  "id"           TEXT NOT NULL,
  "orgId"        TEXT,
  "userId"       TEXT,
  "phone"        TEXT,
  "type"         TEXT NOT NULL,
  "status"       TEXT NOT NULL DEFAULT 'REQUESTED',
  "reason"       TEXT,
  "referenceId"  TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt"   TIMESTAMP(3),
  "resolvedById" TEXT,
  CONSTRAINT "DataRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DataRequest_type_check" CHECK ("type" IN ('DELETE', 'EXPORT')),
  CONSTRAINT "DataRequest_status_check" CHECK ("status" IN ('REQUESTED', 'IN_REVIEW', 'DONE', 'REJECTED')),
  CONSTRAINT "DataRequest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "DataRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "DataRequest_referenceId_key" ON "DataRequest" ("referenceId");
CREATE INDEX IF NOT EXISTS "DataRequest_orgId_status_idx" ON "DataRequest" ("orgId", "status");
CREATE INDEX IF NOT EXISTS "DataRequest_userId_idx" ON "DataRequest" ("userId");
CREATE INDEX IF NOT EXISTS "DataRequest_phone_idx" ON "DataRequest" ("phone");
CREATE INDEX IF NOT EXISTS "DataRequest_status_createdAt_idx" ON "DataRequest" ("status", "createdAt");

-- =============================================================================================
-- 9. Fitness (flag fitnessTests). AbsenceNotice is NOT created: Attendance.status already has EXCUSED.
-- =============================================================================================

CREATE TABLE IF NOT EXISTS "FitnessResult" (
  "id"           TEXT NOT NULL,
  "orgId"        TEXT NOT NULL,
  "studentId"    TEXT NOT NULL,
  "testKey"      TEXT NOT NULL,
  "value"        DECIMAL(12,3) NOT NULL,
  "unit"         TEXT NOT NULL,
  "sessionId"    TEXT,
  "notes"        TEXT,
  "recordedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recordedById" TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FitnessResult_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FitnessResult_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FitnessResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FitnessResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "FitnessResult_studentId_testKey_recordedAt_idx" ON "FitnessResult" ("studentId", "testKey", "recordedAt");
CREATE INDEX IF NOT EXISTS "FitnessResult_orgId_recordedAt_idx" ON "FitnessResult" ("orgId", "recordedAt");

-- =============================================================================================
-- 10. TRIQ's own plan billing (flag triqBilling). "Subscription" is reused.
-- =============================================================================================

CREATE TABLE IF NOT EXISTS "SubscriptionInvoice" (
  "id"                TEXT NOT NULL,
  "orgId"             TEXT NOT NULL,
  "subscriptionId"    TEXT,
  "periodStart"       TIMESTAMP(3) NOT NULL,
  "periodEnd"         TIMESTAMP(3) NOT NULL,
  "activeStudents"    INTEGER NOT NULL,
  "amountPaise"       INTEGER NOT NULL,
  "gstPaise"          INTEGER NOT NULL DEFAULT 0,
  "currency"          TEXT NOT NULL DEFAULT 'INR',
  "status"            TEXT NOT NULL DEFAULT 'DRAFT',
  "invoiceNumber"     TEXT NOT NULL,
  "issuedAt"          TIMESTAMP(3),
  "paidAt"            TIMESTAMP(3),
  "providerPaymentId" TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionInvoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SubscriptionInvoice_status_check" CHECK ("status" IN ('DRAFT', 'ISSUED', 'PAID', 'VOID')),
  CONSTRAINT "SubscriptionInvoice_amounts_check" CHECK ("amountPaise" >= 0 AND "gstPaise" >= 0 AND "activeStudents" >= 0),
  CONSTRAINT "SubscriptionInvoice_period_check" CHECK ("periodEnd" > "periodStart"),
  CONSTRAINT "SubscriptionInvoice_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SubscriptionInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionInvoice_invoiceNumber_key" ON "SubscriptionInvoice" ("invoiceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionInvoice_orgId_periodStart_key" ON "SubscriptionInvoice" ("orgId", "periodStart");
CREATE INDEX IF NOT EXISTS "SubscriptionInvoice_orgId_status_idx" ON "SubscriptionInvoice" ("orgId", "status");

-- =============================================================================================
-- 11. Parent premium placeholder (flag parentPremium)
-- =============================================================================================

CREATE TABLE IF NOT EXISTS "ParentPlan" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "orgId"      TEXT,
  "status"     TEXT NOT NULL DEFAULT 'TRIAL',
  "startedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt"     TIMESTAMP(3),
  "priceMinor" INTEGER NOT NULL DEFAULT 0,
  "currency"   TEXT NOT NULL DEFAULT 'INR',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParentPlan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ParentPlan_status_check" CHECK ("status" IN ('TRIAL', 'ACTIVE', 'CANCELLED', 'EXPIRED')),
  CONSTRAINT "ParentPlan_priceMinor_check" CHECK ("priceMinor" >= 0),
  CONSTRAINT "ParentPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ParentPlan_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ParentPlan_userId_status_idx" ON "ParentPlan" ("userId", "status");
CREATE INDEX IF NOT EXISTS "ParentPlan_orgId_idx" ON "ParentPlan" ("orgId");

-- =============================================================================================
-- RLS: deny by default (no policies). The app uses the table owner / service role and is unaffected.
-- =============================================================================================

ALTER TABLE "PointsLedger"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "XpLedger"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BadgeDefinition"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentBadge"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RewardItem"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Redemption"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaderboardOptIn"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MediaAsset"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MediaSubject"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MediaConsent"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MediaAudit"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GuardianLink"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WaiverTemplate"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WaiverSignature"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConsentRecord"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Drill"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionPlan"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionPlanItem"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventWaitlist"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MessageDelivery"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DataRequest"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FitnessResult"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubscriptionInvoice"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ParentPlan"             ENABLE ROW LEVEL SECURITY;

COMMIT;
