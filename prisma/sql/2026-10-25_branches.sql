-- Additive only. NOT APPLIED to production. Requires founder approval before running.
-- Must be applied BEFORE deploying code that includes Batch.branchId (Prisma selects all columns).
CREATE TABLE IF NOT EXISTS "Branch" (
  "id"        TEXT PRIMARY KEY,
  "orgId"     TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "name"      TEXT NOT NULL,
  "address"   TEXT,
  "city"      TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Branch_orgId_name_key" ON "Branch"("orgId", "name");
CREATE INDEX IF NOT EXISTS "Branch_orgId_idx" ON "Branch"("orgId");
ALTER TABLE "Branch" ENABLE ROW LEVEL SECURITY; -- server connects as owner; blocks public REST access

ALTER TABLE "Batch" ADD COLUMN IF NOT EXISTS "branchId" TEXT
  REFERENCES "Branch"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "Batch_branchId_idx" ON "Batch"("branchId");
