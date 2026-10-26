-- Additive only. NOT APPLIED to production. Requires founder approval before running.
-- Apply AFTER 2026-10-25_branches.sql. Read/written only when NEXT_PUBLIC_FEATURE_BRANCHES is on.
-- One row per batch that runs at a branch (a batch has at most one branch).
CREATE TABLE IF NOT EXISTS "BatchBranch" (
  "batchId"   TEXT PRIMARY KEY REFERENCES "Batch"("id") ON DELETE CASCADE,
  "orgId"     TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "branchId"  TEXT NOT NULL REFERENCES "Branch"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BatchBranch_orgId_idx" ON "BatchBranch"("orgId");
CREATE INDEX IF NOT EXISTS "BatchBranch_branchId_idx" ON "BatchBranch"("branchId");
ALTER TABLE "BatchBranch" ENABLE ROW LEVEL SECURITY; -- server connects as owner; blocks public REST access

-- If an earlier draft of 2026-10-25_branches.sql was applied somewhere (it added Batch."branchId"), carry those links
-- over. Safe to run when the column does not exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Batch' AND column_name = 'branchId') THEN
    INSERT INTO "BatchBranch" ("batchId", "orgId", "branchId")
    SELECT b."id", b."orgId", b."branchId" FROM "Batch" b
    WHERE b."branchId" IS NOT NULL AND b."orgId" IS NOT NULL
    ON CONFLICT ("batchId") DO NOTHING;
  END IF;
END $$;
