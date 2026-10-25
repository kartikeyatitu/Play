# Vertical 11 — Marketplace

> Planning doc. Read-only audit of branch `feat/academy-os-branches` on 2026-10-25. Nothing here is built yet.
> "Verified" means the file was opened and the behaviour seen in code. It does not mean it was tested in production.

## 1. Goal

Turn the academy's existing "Kit Store" into a real, trustworthy shop. Academies sell their own kit (jerseys, balls, bags, tournament entries) to their own families. Each product has accurate stock and sizes. Every order records its price at the time of sale. Parents can pay at the counter or online through **the academy's own Razorpay account**, and an order only counts as paid once a verified webhook confirms it. Money settles to the academy, never to Triq. A cross-academy or brand marketplace comes later, once single-academy commerce is proven.

## 2. Verified today

| Capability | Evidence | Status |
|---|---|---|
| Product catalogue | `Product` model (`name`, `description`, `price Float`, `stock Int @default(100)`, `orgId`). `createProduct` in `src/app/actions/store.ts` (needs `settings.manage`) | partial. No validation of price or name (`parseFloat` result passed straight through from `StoreManager.tsx`). No edit, archive, image or size support |
| Admin store UI | `src/components/org/StoreManager.tsx`, rendered on the "Kit Store" tab in `src/components/org/AdminClient.tsx` (Grow group). **Not behind any flag** | working (basic) |
| Orders | `Order` model (`productId`, `studentId`, `status` PENDING/DELIVERED, `orgId`). `placeOrder` (a parent ordering for their own child, or an admin for an in-org student; product must be in the student's org) | partial. No quantity. **Stock is never checked or decremented.** Price is not stored on the order. No link to a parent or payment |
| Fulfilment | `fulfillOrder` (`fees.collect`), scoped through `student.orgId`. `src/app/org/page.tsx` loads PENDING orders only | working. No audit log |
| Parent shop | `src/components/parent/ProShop.tsx` in `ParentClient.tsx`. Always orders for `children?.[0]?.id`, i.e. the first child only. On success it shows `alert("Order placed! Pay your coach at the next practice.")` | partial |
| Online payment for orders | `Payment` has `feeRecordId String` (required), and `finalizePayment` in `src/lib/payment-service.ts` updates a `FeeRecord`. Orders have no payment path | missing |
| Reusable gateway plumbing | `createRazorpayOrder`, `verifyRazorpayWebhookSignature`, `verifyRazorpayCheckoutSignature` in `src/lib/gateways/razorpay.ts`. Per-academy keys come from `getOrgRazorpay` in `src/lib/razorpay-org.ts`. `src/app/api/webhooks/razorpay/[orgId]/route.ts` handles `payment.captured`/`order.paid`: it tries `Payment` first, then falls back to `TurfBooking.providerOrderId` and calls `confirmPaidBooking` (`src/lib/turf-engine.ts`), which marks an amount mismatch as `PAID_CONFLICT` | working. This is the pattern to copy |
| Payment-method vocabulary | `src/lib/payment-method.ts` (+ `src/lib/__tests__/payment-method.test.ts`): `OFFLINE_RECORDED`, `ONLINE_VERIFIED`, … | working |
| Public academy directory | `ListedAcademy`, `DirectoryLead`, `ClaimRequest` models. `src/app/academies/[city]`, `src/app/academy/[slug]`, `src/lib/directory.ts` | working. **Not gated by `FEATURES.marketplace`**: that flag is defined in `src/lib/features.ts` but no code reads it |
| Brand or wholesale marketplace | `Brand`, `WholesaleProduct`, `BrandSponsorship` exist only as **commented-out** blocks in `prisma/schema.prisma` | missing (not live) |
| Coupons on store orders | `Coupon` + `createCoupon` exist (`src/app/actions/coupons.ts`), but grep finds no redemption anywhere (fees or store) | missing |

## 3. Gaps for a real v1

1. Stock and price are not enforced, so the shop can oversell, and a later price edit would change what historical orders appear to cost.
2. Orders cannot be paid or tracked as paid, and the "pay your coach" alert has no record behind it.
3. The parent cannot choose which child or size, or how many.
4. Products cannot be edited or removed (only academy deletion removes them, in `src/app/actions/delete.ts`).
5. There is no audit trail for catalogue changes, payments or hand-overs.
6. Online payments have no webhook branch for store orders.

## 4. v1 scope

**In**
- Catalogue: create, edit and archive products. Image URL (`safeHttpUrl`), optional size list, stock tracking.
- Orders: child selector, size, quantity (1–10), price snapshot, atomic stock reservation.
- Counter payment: staff with `fees.collect` mark an order paid (`OFFLINE_RECORDED`) and then hand it over.
- Online payment: a Razorpay Order on the academy's own keys. The order becomes `PAID` **only** through the `/api/webhooks/razorpay/[orgId]` webhook. A mismatched amount becomes `PAID_CONFLICT`.
- Cancel: before hand-over only. Stock is restored. Refunds for online-paid orders are done by hand in Razorpay and recorded with a note.

**Out (explicitly)**
- A public or cross-academy marketplace. Brand wholesale (the commented-out schema). Coach or service listings.
- Shipping and addresses (pickup at the academy only). GST invoices. Coupons on orders.
- Automated refunds through the API. Stripe for store orders.
- Changes to the public directory (`/academies`). Still not gated; see open questions.

## 5. Data model

No new tables. `Order` takes on the provider fields, exactly as `TurfBooking` does (`providerOrderId @unique`, `onlineDue`, `PAID_CONFLICT`). Why not reuse `Payment`: `Payment.feeRecordId` is NOT NULL and `finalizePayment` writes to `FeeRecord`, so reusing it would mean relaxing a column and branching the fee path that is already live.

```prisma
model Product {
  // ...existing fields unchanged...
  isActive Boolean  @default(true)       // V11: archive instead of delete
  imageUrl String?                      // V11: http(s) only (safeHttpUrl)
  sizes    String[] @default([])        // V11: e.g. ["S","M","L"]; empty = no size
}

model Order {
  // ...existing fields unchanged... (status adds: PAYMENT_PENDING | PAID | CANCELLED | PAID_CONFLICT)
  parentId          String?   // V11: who placed it (null on legacy rows)
  quantity          Int       @default(1)
  size              String?
  unitPrice         Int?      // whole currency units, snapshot at order time (null = legacy)
  amount            Int?      // unitPrice * quantity
  paymentMethod     String?   // reuse src/lib/payment-method.ts values
  providerOrderId   String?   @unique // Razorpay order id
  providerPaymentId String?
  paidAt            DateTime?
  deliveredAt       DateTime?
  cancelledAt       DateTime?
  note              String?
  @@index([orgId, status])
}
```

`prisma/sql/YYYY-MM-DD_v11_store_orders.sql`:

```sql
-- Additive only. NOT APPLIED to production. Requires founder approval before running.
-- Apply BEFORE deploying code that selects the new columns (Prisma selects all columns).
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sizes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "size" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "unitPrice" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "amount" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "providerOrderId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "providerPaymentId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "note" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Order_providerOrderId_key" ON "Order"("providerOrderId");
CREATE INDEX IF NOT EXISTS "Order_orgId_status_idx" ON "Order"("orgId","status");
-- No new tables. RLS on "Product"/"Order" could not be verified from the repo (not listed in
-- prisma/sql/2026-10-14_enable_rls_on_exposed_tables.sql). If it is off, enable it:
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order"   ENABLE ROW LEVEL SECURITY;
```

## 6. Build slices

**Slice 1: Flag, permission, pure order maths**
- Objective: put the rules in one place before any schema change.
- Files: `src/lib/features.ts` (re-use `marketplace`, updating its comment, or add `store`; see the open questions). `src/lib/team.ts` adds `"store.manage"`, and RECEPTIONIST may be granted it through overrides. New `src/lib/store.ts`: `validateProductInput`, `orderAmount(unitPrice, qty)`, `ORDER_STATUSES`, `canTransition(from, to)`. `store.ts` actions validate price (finite and > 0) and name length.
- Permission/tenancy: unchanged. `createProduct` keeps `settings.manage` until slice 2.
- Audit: `STORE_PRODUCT_CREATED`, `STORE_ORDER_DELIVERED` (added to `fulfillOrder`).
- Tests: `src/lib/__tests__/store.test.ts` covering the transition matrix, amount maths and input rejection (NaN, negative, too-long name).
- Acceptance: the existing Kit Store flow behaves the same. Invalid prices are rejected.

**Slice 2: Schema + catalogue management**
- Objective: edit, archive, stock, sizes and image.
- Files: `prisma/schema.prisma`, the SQL above, `store.ts` (`updateProduct`, `setProductActive`), `StoreManager.tsx` (edit UI behind the flag). `ProShop` / `src/app/parent/page.tsx` filter on `isActive: true`.
- Permission/tenancy: `checkPermission("store.manage")`. Every query uses `{id, orgId: session.orgId}`.
- Audit: `STORE_PRODUCT_UPDATED` (with a before/after diff), `STORE_PRODUCT_ARCHIVED`.
- Acceptance: an archived product disappears for parents, and its past orders stay visible to staff.

**Slice 3: Real orders + counter payment**
- Objective: child, size and quantity. Stock reserved atomically. Staff record cash or UPI.
- Files: `store.ts` (`placeOrder` v2 behind the flag, `markOrderPaidAtCounter`, `cancelOrder`), `ProShop.tsx` (child and size pickers, toast instead of `alert`), `StoreManager.tsx` (status columns).
- Tenancy: unchanged parent rule (`parentId: session.id`). Stock reservation uses `db.product.updateMany({ where: { id, orgId, isActive: true, stock: { gte: qty } }, data: { stock: { decrement: qty } } })` inside a `$transaction` with `order.create`. If 0 rows update, the action returns "Out of stock". Cancelling restores stock in the same transaction.
- Permission: `fees.collect` for counter payment and hand-over. A parent can cancel only their own `PAYMENT_PENDING`/`PENDING` order.
- Audit: `STORE_ORDER_PLACED`, `STORE_ORDER_PAID_OFFLINE`, `STORE_ORDER_CANCELLED`.
- Tests: helper tests for the transitions. An e2e test that two concurrent orders for the last item give one success and one failure.

**Slice 4: Online payment via the verified webhook**
- Objective: the parent pays online and the order becomes `PAID` only from the webhook.
- Files: new `src/app/actions/store-payments.ts` (`startOrderPayment(orderId)`: loads the order for `parentId = session.id`, takes the amount from `Order.amount` (never from the client), calls `createRazorpayOrder(getOrgRazorpay(orgId))`, saves `providerOrderId`). New `src/lib/store-payment-service.ts` (`confirmPaidOrder`, modelled on `confirmPaidBooking`). In `src/app/api/webhooks/razorpay/[orgId]/route.ts`, add one more fallback after the turf lookup: `db.order.findFirst({ where: { providerOrderId, orgId } })`.
- Permission/tenancy: the webhook is HMAC-verified with the academy's own secret. The order must match the `orgId` in the URL.
- Audit: `STORE_ORDER_PAID_ONLINE`, `STORE_ORDER_PAID_CONFLICT`.
- Tests: pure amount and state checks in `src/lib/__tests__/store.test.ts`. Extend the manual payment smoke test (`docs/sprints/task-7-payment-smoke-test.md`) with a Razorpay **test-mode** store order.
- Acceptance: the checkout handler alone never sets `PAID`. A replayed webhook is idempotent. A wrong amount becomes `PAID_CONFLICT` and shows to staff.

## 7. Feature flag

`FEATURES.marketplace` (already defined as `flag("MARKETPLACE", false)` and unused) gates catalogue v2, order v2, counter payment and online payment. Default **off**. While it is off, the current Kit Store and ProShop behave exactly as they do today. Every new action re-checks the flag on the server.

## 8. Dependencies

- **Vertical 1 (Academy operations):** `Student`/`parentId` scoping, `OrgMembership` permissions, Razorpay Connect (`src/app/actions/razorpay-connect.ts`) and the per-org webhook. Slice 4 requires the academy to have connected Razorpay.
- **Vertical 7 (Communities):** optional "new kit" announcements. No hard dependency.
- **Vertical 15 (Inclusive):** scholarship students might get free kit. Out of scope for v1, but `Order.note` and `unitPrice = 0` keep the door open.
- Reports and exports (`src/app/actions/reports.ts`, `export.ts`) should keep store revenue separate from fee revenue. Not in v1.
- `src/app/actions/delete.ts` already deletes `order` and `product` per org. No new tables are added.

## 9. Risks and open questions for the founder

1. **What does "Marketplace" mean?** The `marketplace` flag comment says "Public academy & coach directory / marketplace", but the directory (`/academies`, `/academy/[slug]`) is already live and ungated. This plan assumes v1 = in-academy kit commerce. Confirm, or rename the flag (`store`) and keep `marketplace` for the directory.
2. **Legal and tax.** Selling goods may need GST invoicing by the academy. Triq only records the sale. Do we need a disclaimer?
3. **Price type.** `Product.price` is `Float`. Should new code store whole units in `unitPrice Int` (the same convention as turf), leaving `price` as it is?
4. **Refunds** are manual in v1. Is that acceptable for pilot academies in Noida and Gurgaon?
5. **Kit Store visibility.** Should the existing Kit Store tab be hidden for academies without products?
6. **Default stock of 100** on `Product` is a fake number. Should v2 show "untracked" when stock was never set?
