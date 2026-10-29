-- NOT APPLIED. Needs founder approval.
-- Trust batch (2026-10-29). Additive only: two nullable-column groups and one new table. No data is changed.
-- (a) Receipt void fields: a receipt is voided (kept, marked, with a reason), never deleted.
-- (b) DataRequest: parent/user requests to delete or export their data (DPDP Act), tracked to resolution.
-- After applying, add the Prisma model text at the bottom of this file to prisma/schema.prisma and run `prisma generate`.
-- RLS is enabled with no policies (deny by default for anon/authenticated); the app reaches these via Prisma
-- as the table owner, same as every other table in prisma/sql/.

BEGIN;

-- (a) Receipt voiding ---------------------------------------------------------------------------
ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "voidedAt"   TIMESTAMPTZ(3);
ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "voidReason" TEXT;
ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "voidedById" TEXT;
-- Lists usually want "live receipts for this academy"
CREATE INDEX IF NOT EXISTS "Receipt_orgId_voidedAt_idx" ON "Receipt"("orgId", "voidedAt");

-- (b) Data deletion / export requests ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "DataRequest" (
  "id"           TEXT PRIMARY KEY,
  "orgId"        TEXT REFERENCES "Organization"("id") ON DELETE SET NULL,
  "userId"       TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "phone"        TEXT,
  "type"         TEXT NOT NULL CHECK ("type" IN ('DELETE', 'EXPORT')),
  "status"       TEXT NOT NULL DEFAULT 'REQUESTED' CHECK ("status" IN ('REQUESTED', 'IN_REVIEW', 'DONE', 'REJECTED')),
  "reason"       TEXT,
  "referenceId"  TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt"   TIMESTAMP(3),
  "resolvedById" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "DataRequest_referenceId_key"    ON "DataRequest"("referenceId");
CREATE INDEX IF NOT EXISTS "DataRequest_orgId_status_idx"          ON "DataRequest"("orgId", "status");
CREATE INDEX IF NOT EXISTS "DataRequest_userId_idx"                ON "DataRequest"("userId");
CREATE INDEX IF NOT EXISTS "DataRequest_phone_idx"                 ON "DataRequest"("phone");
CREATE INDEX IF NOT EXISTS "DataRequest_status_createdAt_idx"      ON "DataRequest"("status", "createdAt");

ALTER TABLE "DataRequest" ENABLE ROW LEVEL SECURITY;

COMMIT;

/* ------------------------------------------------------------------------------------------------
Matching Prisma model text (NOT yet in prisma/schema.prisma; add only after this SQL is applied).

// In model Receipt, add:
  voidedAt        DateTime?  @db.Timestamptz(3)
  voidReason      String?
  voidedById      String?

  @@index([orgId, voidedAt])

/// Parent/user request to delete or export personal data. Kept after resolution as an audit trail.
model DataRequest {
  id           String    @id @default(cuid())
  orgId        String?
  userId       String?
  phone        String?
  type         String    // DELETE | EXPORT
  status       String    @default("REQUESTED") // REQUESTED | IN_REVIEW | DONE | REJECTED
  reason       String?
  referenceId  String    @unique
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  resolvedAt   DateTime?
  resolvedById String?

  org          Organization? @relation(fields: [orgId], references: [id], onDelete: SetNull)
  user         User?         @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([orgId, status])
  @@index([userId])
  @@index([phone])
  @@index([status, createdAt])
}

// Back-relations to add: `dataRequests DataRequest[]` on model Organization and on model User.
------------------------------------------------------------------------------------------------ */
