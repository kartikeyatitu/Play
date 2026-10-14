import { db } from "@/lib/db";

/**
 * Creates the team and payroll tables (OrgMembership, StaffAttendance, StaffPayout, Expense) the first time the app runs against a
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
  // Close Supabase's public REST path; the app connects as the table owner and is not affected
  `ALTER TABLE "OrgMembership" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "StaffAttendance" ENABLE ROW LEVEL SECURITY`,
  `DO $$ BEGIN ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  // Sprint 2: payroll and expenses (mirrors prisma/sql/2026-10-14_payroll_expenses.sql)
  `CREATE TABLE IF NOT EXISTS "StaffPayout" (
    "id" TEXT NOT NULL, "orgId" TEXT NOT NULL, "membershipId" TEXT NOT NULL, "month" TEXT NOT NULL,
    "payType" TEXT NOT NULL, "rate" INTEGER NOT NULL, "units" DOUBLE PRECISION NOT NULL, "baseAmount" INTEGER NOT NULL,
    "bonus" INTEGER NOT NULL DEFAULT 0, "deduction" INTEGER NOT NULL DEFAULT 0, "advance" INTEGER NOT NULL DEFAULT 0,
    "netAmount" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "paidAt" TIMESTAMP(3),
    "paymentMode" TEXT, "reference" TEXT, "note" TEXT, "paidById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffPayout_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "StaffPayout_membershipId_month_key" ON "StaffPayout" ("membershipId", "month")`,
  `CREATE INDEX IF NOT EXISTS "StaffPayout_orgId_month_idx" ON "StaffPayout" ("orgId", "month")`,
  `CREATE TABLE IF NOT EXISTS "Expense" (
    "id" TEXT NOT NULL, "orgId" TEXT NOT NULL, "date" TIMESTAMP(3) NOT NULL, "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL, "note" TEXT, "paymentMode" TEXT, "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "Expense_orgId_date_idx" ON "Expense" ("orgId", "date")`,
  `DO $$ BEGIN ALTER TABLE "StaffPayout" ADD CONSTRAINT "StaffPayout_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "StaffPayout" ADD CONSTRAINT "StaffPayout_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "OrgMembership" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "Expense" ADD CONSTRAINT "Expense_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `ALTER TABLE "StaffPayout" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY`,
];

let ready: Promise<void> | null = null;

async function run() {
  const rows = await db.$queryRawUnsafe<{ m: string | null; s: string | null; p: string | null; e: string | null }[]>(
    `SELECT to_regclass('public."OrgMembership"')::text AS m, to_regclass('public."StaffAttendance"')::text AS s,
            to_regclass('public."StaffPayout"')::text AS p, to_regclass('public."Expense"')::text AS e`
  );
  const r = rows[0];
  if (r?.m && r?.s && r?.p && r?.e) return;
  for (const sql of TEAM_SCHEMA) {
    try {
      await db.$executeRawUnsafe(sql);
    } catch (e: any) {
      // Another server instance may be creating the same object at the same moment
      if (!/already exists|duplicate/i.test(String(e?.message))) throw e;
    }
  }
  console.info("[triq] team and payroll tables created");
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
