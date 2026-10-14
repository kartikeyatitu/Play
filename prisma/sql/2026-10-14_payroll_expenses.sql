-- Triq · Sprint 2 · Payroll and expenses. Additive and safe to run more than once.
-- The app also creates these on startup (src/lib/schema-ensure.ts).

CREATE TABLE IF NOT EXISTS "StaffPayout" (
    "id" TEXT NOT NULL, "orgId" TEXT NOT NULL, "membershipId" TEXT NOT NULL, "month" TEXT NOT NULL,
    "payType" TEXT NOT NULL, "rate" INTEGER NOT NULL, "units" DOUBLE PRECISION NOT NULL, "baseAmount" INTEGER NOT NULL,
    "bonus" INTEGER NOT NULL DEFAULT 0, "deduction" INTEGER NOT NULL DEFAULT 0, "advance" INTEGER NOT NULL DEFAULT 0,
    "netAmount" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "paidAt" TIMESTAMP(3),
    "paymentMode" TEXT, "reference" TEXT, "note" TEXT, "paidById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffPayout_pkey" PRIMARY KEY ("id"));

CREATE UNIQUE INDEX IF NOT EXISTS "StaffPayout_membershipId_month_key" ON "StaffPayout" ("membershipId", "month");

CREATE INDEX IF NOT EXISTS "StaffPayout_orgId_month_idx" ON "StaffPayout" ("orgId", "month");

CREATE TABLE IF NOT EXISTS "Expense" (
    "id" TEXT NOT NULL, "orgId" TEXT NOT NULL, "date" TIMESTAMP(3) NOT NULL, "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL, "note" TEXT, "paymentMode" TEXT, "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id"));

CREATE INDEX IF NOT EXISTS "Expense_orgId_date_idx" ON "Expense" ("orgId", "date");

DO $$ BEGIN ALTER TABLE "StaffPayout" ADD CONSTRAINT "StaffPayout_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "StaffPayout" ADD CONSTRAINT "StaffPayout_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "OrgMembership" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "Expense" ADD CONSTRAINT "Expense_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "StaffPayout" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
