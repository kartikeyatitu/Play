-- V1 Business: UPI AutoPay fee mandates (flag NEXT_PUBLIC_FEATURE_UPI_AUTOPAY).
-- Additive only. Apply before turning the flag on. Safe to re-run.

CREATE TABLE IF NOT EXISTS "FeeMandate" (
  "id"                 TEXT PRIMARY KEY,
  "orgId"              TEXT NOT NULL,
  "studentId"          TEXT NOT NULL,
  "parentId"           TEXT NOT NULL,
  "provider"           TEXT NOT NULL DEFAULT 'RAZORPAY',
  "providerCustomerId" TEXT NOT NULL,
  "authOrderId"        TEXT NOT NULL,
  "authPaymentId"      TEXT,
  "providerTokenId"    TEXT,
  "providerStatus"     TEXT,
  "status"             TEXT NOT NULL DEFAULT 'CREATED',
  "maxAmountMinor"     INTEGER NOT NULL,
  "frequency"          TEXT NOT NULL DEFAULT 'monthly',
  "currency"           TEXT NOT NULL DEFAULT 'INR',
  "expireAt"           TIMESTAMP(3) NOT NULL,
  "consentText"        TEXT NOT NULL,
  "consentVersion"     TEXT NOT NULL,
  "consentAt"          TIMESTAMP(3) NOT NULL,
  "consentIp"          TEXT,
  "failureReason"      TEXT,
  "cancelledAt"        TIMESTAMP(3),
  "cancelledById"      TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "FeeMandate_authOrderId_key" ON "FeeMandate" ("authOrderId");
CREATE INDEX IF NOT EXISTS "FeeMandate_orgId_status_idx" ON "FeeMandate" ("orgId", "status");
CREATE INDEX IF NOT EXISTS "FeeMandate_studentId_idx" ON "FeeMandate" ("studentId");
CREATE INDEX IF NOT EXISTS "FeeMandate_providerTokenId_idx" ON "FeeMandate" ("providerTokenId");

CREATE TABLE IF NOT EXISTS "FeeMandateCharge" (
  "id"                TEXT PRIMARY KEY,
  "orgId"             TEXT NOT NULL,
  "mandateId"         TEXT NOT NULL,
  "feeRecordId"       TEXT NOT NULL,
  "month"             TEXT NOT NULL,
  "idempotencyKey"    TEXT NOT NULL,
  "amountMinor"       INTEGER NOT NULL,
  "providerOrderId"   TEXT,
  "providerPaymentId" TEXT,
  "paymentRowId"      TEXT,
  "status"            TEXT NOT NULL DEFAULT 'PENDING_SUBMIT',
  "failureReason"     TEXT,
  "attempts"          INTEGER NOT NULL DEFAULT 0,
  "createdById"       TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "FeeMandateCharge_idempotencyKey_key" ON "FeeMandateCharge" ("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "FeeMandateCharge_providerOrderId_key" ON "FeeMandateCharge" ("providerOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "FeeMandateCharge_mandateId_feeRecordId_key" ON "FeeMandateCharge" ("mandateId", "feeRecordId");
CREATE INDEX IF NOT EXISTS "FeeMandateCharge_orgId_month_idx" ON "FeeMandateCharge" ("orgId", "month");

-- At most one live mandate per child (CREATED / AUTHENTICATED / ACTIVE / PAUSED). Enforced in code too.
CREATE UNIQUE INDEX IF NOT EXISTS "FeeMandate_one_live_per_student"
  ON "FeeMandate" ("studentId") WHERE "status" IN ('CREATED', 'AUTHENTICATED', 'ACTIVE', 'PAUSED');

ALTER TABLE "FeeMandate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeeMandateCharge" ENABLE ROW LEVEL SECURITY;
