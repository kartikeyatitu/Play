-- TRIQ Spaces · per-booking history (docs/specs/04-triq-spaces.md §7-8)
-- Additive only: one new table. Safe to run more than once. NOT APPLIED.
-- Apply in the Supabase SQL editor BEFORE setting NEXT_PUBLIC_FEATURE_SPACES_OPS=1.
-- (Writes are best-effort, so the booking board keeps working if this is forgotten, but no history is kept.)
-- Maintenance blocks need no schema change: they are TurfBooking rows with source = 'BLOCK'.

BEGIN;

CREATE TABLE IF NOT EXISTS "TurfBookingEvent" (
  "id"          TEXT NOT NULL,
  "orgId"       TEXT NOT NULL,
  "bookingId"   TEXT NOT NULL,
  "action"      TEXT NOT NULL,
  "actorType"   TEXT NOT NULL,
  "actorUserId" TEXT,
  "details"     TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TurfBookingEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TurfBookingEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TurfBookingEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "TurfBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TurfBookingEvent_bookingId_createdAt_idx" ON "TurfBookingEvent" ("bookingId", "createdAt");
CREATE INDEX IF NOT EXISTS "TurfBookingEvent_orgId_createdAt_idx" ON "TurfBookingEvent" ("orgId", "createdAt");

ALTER TABLE "TurfBookingEvent" ENABLE ROW LEVEL SECURITY;

COMMIT;
