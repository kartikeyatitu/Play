-- Additive only. NOT APPLIED to production. Requires founder approval before running.
-- Records how a fee was settled (see src/lib/payment-method.ts). Nullable, so existing rows are unaffected.
ALTER TABLE "FeeRecord" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
