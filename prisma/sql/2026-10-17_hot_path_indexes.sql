-- Triq · indexes for the hot query paths (Supabase performance advisor: unindexed foreign keys,
-- plus tenant/month filters). Additive and safe to run more than once.
CREATE INDEX IF NOT EXISTS "Attendance_studentId_idx"      ON "Attendance" ("studentId");
CREATE INDEX IF NOT EXISTS "Batch_orgId_idx"               ON "Batch" ("orgId");
CREATE INDEX IF NOT EXISTS "Batch_coachId_idx"             ON "Batch" ("coachId");
CREATE INDEX IF NOT EXISTS "BatchEnrollment_studentId_idx" ON "BatchEnrollment" ("studentId");
CREATE INDEX IF NOT EXISTS "Student_orgId_idx"             ON "Student" ("orgId");
CREATE INDEX IF NOT EXISTS "Student_parentId_idx"          ON "Student" ("parentId");
CREATE INDEX IF NOT EXISTS "User_orgId_idx"                ON "User" ("orgId");
CREATE INDEX IF NOT EXISTS "FeeRecord_orgId_month_status_idx" ON "FeeRecord" ("orgId", "month", "status");
CREATE INDEX IF NOT EXISTS "Lead_orgId_status_idx"         ON "Lead" ("orgId", "status");
CREATE INDEX IF NOT EXISTS "AuditLog_orgId_createdAt_idx"  ON "AuditLog" ("orgId", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_orgId_createdAt_idx"   ON "Message" ("orgId", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_receiverId_idx"        ON "Message" ("receiverId");
CREATE INDEX IF NOT EXISTS "Message_senderId_idx"          ON "Message" ("senderId");
