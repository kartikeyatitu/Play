import { db } from "@/lib/db";

/**
 * Creates the team tables (OrgMembership, StaffAttendance) the first time the app runs against a
 * database that doesn't have them yet, using the app's normal (pooled) connection.
 * Every statement is idempotent; after the first success this is a no-op for the life of the process.
 * Mirrors prisma/sql/2026-10-14_team_memberships.sql.
 */
const TEAM_SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS "OrgMembership" (
    "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "orgId" TEXT NOT NULL, "role" TEXT NOT NULL,
    "staffRole" TEXT, "title" TEXT, "permissions" TEXT, "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "payType" TEXT, "payAmount" INTEGER,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrgMembership_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "OrgMembership_userId_orgId_key" ON "OrgMembership" ("userId", "orgId")`,
  `CREATE INDEX IF NOT EXISTS "OrgMembership_orgId_status_idx" ON "OrgMembership" ("orgId", "status")`,
  `CREATE TABLE IF NOT EXISTS "StaffAttendance" (
    "id" TEXT NOT NULL, "membershipId" TEXT NOT NULL, "orgId" TEXT NOT NULL, "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL, "checkInAt" TIMESTAMP(3), "checkOutAt" TIMESTAMP(3), "note" TEXT, "markedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "StaffAttendance_membershipId_date_key" ON "StaffAttendance" ("membershipId", "date")`,
  `CREATE INDEX IF NOT EXISTS "StaffAttendance_orgId_date_idx" ON "StaffAttendance" ("orgId", "date")`,
  `DO $$ BEGIN ALTER TABLE "OrgMembership" ADD CONSTRAINT "OrgMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "OrgMembership" ADD CONSTRAINT "OrgMembership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "OrgMembership" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

let ready: Promise<void> | null = null;

async function run() {
  const rows = await db.$queryRawUnsafe<{ m: string | null; s: string | null }[]>(
    `SELECT to_regclass('public."OrgMembership"')::text AS m, to_regclass('public."StaffAttendance"')::text AS s`
  );
  if (rows[0]?.m && rows[0]?.s) return;
  for (const sql of TEAM_SCHEMA) {
    try {
      await db.$executeRawUnsafe(sql);
    } catch (e: any) {
      // Another server instance may be creating the same object at the same moment
      if (!/already exists|duplicate/i.test(String(e?.message))) throw e;
    }
  }
  console.info("[triq] team tables created");
}

export function ensureTeamSchema(): Promise<void> {
  if (!ready) {
    ready = run().catch((e) => {
      ready = null; // try again on the next request
      console.error("[triq] could not create team tables", e);
      throw e;
    });
  }
  return ready;
}
