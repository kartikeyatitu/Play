-- V8 TRIQ Commerce: Kit Store order snapshot + history. Additive only.
-- NOT APPLIED to production. Apply before setting NEXT_PUBLIC_FEATURE_MARKETPLACE=1.
-- No existing table or column is changed (Order.status simply carries new values for v2 orders).

CREATE TABLE IF NOT EXISTS "StoreOrderDetail" (
  "id"               TEXT PRIMARY KEY,
  "orgId"            TEXT NOT NULL,
  "orderId"          TEXT NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
  "quantity"         INTEGER NOT NULL CHECK ("quantity" BETWEEN 1 AND 10),
  "unitPricePaise"   INTEGER NOT NULL CHECK ("unitPricePaise" >= 0),
  "amountPaise"      INTEGER NOT NULL CHECK ("amountPaise" >= 0),
  "currency"         TEXT NOT NULL DEFAULT 'INR',
  "paymentMode"      TEXT NOT NULL DEFAULT 'PAY_AT_ACADEMY',
  "paymentStatus"    TEXT NOT NULL DEFAULT 'UNPAID',
  "paidAt"           TIMESTAMP(3),
  "paidRecordedById" TEXT,
  "placedById"       TEXT NOT NULL,
  "note"             TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "StoreOrderDetail_orderId_key" ON "StoreOrderDetail"("orderId");
CREATE INDEX IF NOT EXISTS "StoreOrderDetail_orgId_createdAt_idx" ON "StoreOrderDetail"("orgId", "createdAt");
ALTER TABLE "StoreOrderDetail" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "StoreOrderEvent" (
  "id"         TEXT PRIMARY KEY,
  "orgId"      TEXT NOT NULL,
  "orderId"    TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus"   TEXT NOT NULL,
  "actorId"    TEXT NOT NULL,
  "note"       TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "StoreOrderEvent_orderId_createdAt_idx" ON "StoreOrderEvent"("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "StoreOrderEvent_orgId_createdAt_idx" ON "StoreOrderEvent"("orgId", "createdAt");
ALTER TABLE "StoreOrderEvent" ENABLE ROW LEVEL SECURITY;

-- Stock can never go negative (the app already reserves with UPDATE … WHERE stock >= qty).
-- NOT VALID so existing rows are not re-checked; new writes are.
DO $$ BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_stock_nonnegative" CHECK ("stock" >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
