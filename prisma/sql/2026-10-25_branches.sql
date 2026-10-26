-- Additive only. NOT APPLIED to production. Requires founder approval before running.
-- Code reads/writes Branch only when NEXT_PUBLIC_FEATURE_BRANCHES is on, so production keeps working before this runs.
-- 2026-10-26: the original "ALTER TABLE Batch ADD COLUMN branchId" was removed from this file. The batch -> branch link
-- now lives in its own table (2026-10-26_batch_branches.sql), because a new Batch column in schema.prisma would make
-- every existing batch query fail until the column exists.
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
