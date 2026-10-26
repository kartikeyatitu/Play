-- V1 Business: GST tax invoices and credit notes (flag NEXT_PUBLIC_FEATURE_GST_INVOICES).
-- Additive only. Apply before turning the flag on. Safe to re-run.

CREATE TABLE IF NOT EXISTS "OrgTaxProfile" (
  "orgId"            TEXT PRIMARY KEY,
  "legalName"        TEXT NOT NULL,
  "gstin"            TEXT NOT NULL,
  "stateCode"        TEXT NOT NULL,
  "address"          TEXT NOT NULL,
  "sacCode"          TEXT NOT NULL,
  "rateBps"          INTEGER NOT NULL,
  "priceMode"        TEXT NOT NULL DEFAULT 'INCLUSIVE',
  "invoicePrefix"    TEXT NOT NULL DEFAULT 'INV',
  "creditNotePrefix" TEXT NOT NULL DEFAULT 'CN',
  "updatedById"      TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "TaxDocumentCounter" (
  "orgId"     TEXT NOT NULL,
  "fy"        TEXT NOT NULL,
  "series"    TEXT NOT NULL,
  "lastSeq"   INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("orgId", "fy", "series")
);

CREATE TABLE IF NOT EXISTS "TaxInvoice" (
  "id"                  TEXT PRIMARY KEY,
  "orgId"               TEXT NOT NULL,
  "kind"                TEXT NOT NULL,
  "number"              TEXT NOT NULL,
  "fy"                  TEXT NOT NULL,
  "seq"                 INTEGER NOT NULL,
  "sourceKey"           TEXT NOT NULL,
  "issueDate"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "issueDay"            TEXT NOT NULL,
  "feeRecordId"         TEXT,
  "studentId"           TEXT,
  "originalInvoiceId"   TEXT,
  "supplierLegalName"   TEXT NOT NULL,
  "supplierGstin"       TEXT NOT NULL,
  "supplierStateCode"   TEXT NOT NULL,
  "supplierAddress"     TEXT NOT NULL,
  "recipientName"       TEXT NOT NULL,
  "recipientPhone"      TEXT,
  "studentName"         TEXT,
  "description"         TEXT NOT NULL,
  "placeOfSupply"       TEXT NOT NULL,
  "sacCode"             TEXT NOT NULL,
  "rateBps"             INTEGER NOT NULL,
  "priceMode"           TEXT NOT NULL,
  "taxableMinor"        INTEGER NOT NULL,
  "cgstMinor"           INTEGER NOT NULL DEFAULT 0,
  "sgstMinor"           INTEGER NOT NULL DEFAULT 0,
  "igstMinor"           INTEGER NOT NULL DEFAULT 0,
  "roundOffMinor"       INTEGER NOT NULL DEFAULT 0,
  "totalMinor"          INTEGER NOT NULL,
  "amountReceivedMinor" INTEGER NOT NULL DEFAULT 0,
  "currency"            TEXT NOT NULL DEFAULT 'INR',
  "paidAt"              TIMESTAMP(3),
  "reason"              TEXT,
  "createdById"         TEXT NOT NULL,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "TaxInvoice_orgId_kind_fy_seq_key" ON "TaxInvoice" ("orgId", "kind", "fy", "seq");
CREATE UNIQUE INDEX IF NOT EXISTS "TaxInvoice_orgId_kind_number_key" ON "TaxInvoice" ("orgId", "kind", "number");
CREATE UNIQUE INDEX IF NOT EXISTS "TaxInvoice_orgId_sourceKey_key" ON "TaxInvoice" ("orgId", "sourceKey");
CREATE INDEX IF NOT EXISTS "TaxInvoice_orgId_createdAt_idx" ON "TaxInvoice" ("orgId", "createdAt");
CREATE INDEX IF NOT EXISTS "TaxInvoice_feeRecordId_idx" ON "TaxInvoice" ("feeRecordId");
CREATE INDEX IF NOT EXISTS "TaxInvoice_originalInvoiceId_idx" ON "TaxInvoice" ("originalInvoiceId");

-- Same posture as the other tables (2026-10-14_enable_rls_on_exposed_tables.sql): the app connects as the table
-- owner through Prisma; RLS with no policies blocks the public PostgREST roles.
ALTER TABLE "OrgTaxProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaxDocumentCounter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaxInvoice" ENABLE ROW LEVEL SECURITY;
