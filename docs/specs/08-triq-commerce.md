# Vertical 8 — TRIQ Commerce (spec)

Status date: 2026-10-26. Branch audited: `main` @ 5ab2358. Supersedes `docs/roadmap/verticals/11-marketplace.md` (old numbering) for scope; reuses its verified findings.
"Verified" = file opened and behaviour read in code. No production testing was done.

## 1. Product purpose and target users

Connect the sports ecosystem to equipment, apparel, products and services. Entry point: an academy's own **Kit Store** (jerseys, balls, bags) sold to its own families with honest stock, price-at-order snapshots and an auditable order lifecycle. Later releases: online checkout on the academy's own Razorpay keys, multi-seller marketplace, service listings, settlements.

| User | Need |
|---|---|
| Academy owner / manager (seller) | List kit, keep stock right, process orders, record payment collected at the academy, cancel/refund |
| Receptionist / counter staff | Confirm, hand over, record payment, handle returns |
| Parent (buyer) | See kit with price and availability, order for a chosen child, see order history and status, cancel before confirmation, request a refund |
| Later: external merchants, brands | Seller profiles, catalogue, settlements (not in v1) |

## 2. User roles and permissions

| Action | Who | Check |
|---|---|---|
| Create / edit product, set stock | OWNER, MANAGER, anyone granted `store.manage` | `checkPermission("store.manage")` (v2) — legacy `createProduct` used `settings.manage` |
| View / process orders (confirm, fulfil, cancel, refund) | `store.manage` (RECEPTIONIST gets it by default) | `checkPermission("store.manage")` |
| Place order | Parent for own child (`student.parentId = session.id`); admin with `store.manage` for any in-org student | server action |
| Cancel own order | Parent, only while `PLACED` | server action |
| Request refund | Parent (own order) or `store.manage`, only when `FULFILLED` | server action |

New permission key: `store.manage` — "Manage kit store products and orders".

## 3. Complete feature inventory

| Group (scope §2 V8) | v1 (this release) | Later |
|---|---|---|
| Seller and merchant profiles | The academy is the seller (Organization) | External seller profiles |
| Product and service listings | Products: name, description, price, stock | Images, sizes/variants, archive, services |
| Categories / sport discovery | — | Categories, sport tags |
| Search and filters | — | Search, filters, pagination |
| Inventory and availability | Explicit stock, atomic reservation, restock on cancel | Low-stock alerts, variants |
| Pricing and product details | Price snapshot (paise) on every v2 order | Tax/GST lines |
| Cart and checkout | Single-product order with quantity 1–10; **pay at academy** | Cart, online checkout via academy Razorpay |
| Orders and order history | Parent order history, status, timeline | |
| Seller order management | Orders screen with filters by status and actions | Bulk actions, exports |
| Cancellations and returns | Cancel before fulfil (stock restored); refund request after fulfil | Partial returns |
| Refund processing | Refund recorded as returned at the academy, optional restock | Gateway refunds |
| Reviews and moderation | — | Reviews + moderation |
| Payment integration / reconciliation | Payment collected at academy recorded on fulfilment (`PAID_AT_ACADEMY`) | Razorpay order + verified webhook |
| Settlements and commissions | — | After commercial model is defined |

## 4. Screen and navigation specification

- Admin app → More → Grow → **Kit Store** tab (`src/components/org/AdminClient.tsx`, id `store`). Hidden unless `FEATURES.marketplace`.
  - Left: product form (name, price ₹, stock, description) + inventory list with inline edit of price/stock (`StoreManager.tsx`).
  - Right: **Orders** panel (`StoreOrdersPanel.tsx`): status filter chips (Open = PLACED+CONFIRMED, Refunds, Done, All), each order shows product, qty, unit price snapshot, total, student, parent, status, payment status, timeline; action buttons valid for the current state only.
- Parent app → **Pro Shop** tab (`ParentClient.tsx`, id `shop`), hidden unless `FEATURES.marketplace`.
  - Product cards with price and "N in stock / Out of stock"; child selector; quantity; "Place order — pay at the academy" button.
  - "My orders" list with status, total, cancel (PLACED) and request refund (FULFILLED).
  - Copy states plainly: "No online payment. Pay at the academy when you collect."

## 5. Field-level definitions and validation

| Field | Rule |
|---|---|
| Product.name | trimmed, 1–120 chars |
| Product.description | ≤ 500 chars, optional |
| Product.price | finite number, > 0, ≤ 10,00,000; stored as existing `Float` ₹; converted to integer paise for snapshots |
| Product.stock | integer 0–100,000 |
| Order quantity | integer 1–10 |
| StoreOrderDetail.unitPricePaise | `round(price × 100)` at order time; immutable |
| StoreOrderDetail.amountPaise | `unitPricePaise × quantity`; immutable |
| paymentMode | `PAY_AT_ACADEMY` (only value in v1) |
| paymentStatus | `UNPAID` → `PAID_AT_ACADEMY` → `REFUNDED` |
| notes / reasons | ≤ 300 chars |

## 6. End-to-end user journeys

1. Seller adds "Jersey M", ₹599, stock 20 → audit `STORE_PRODUCT_CREATED`.
2. Parent opens Pro Shop, picks child + qty 2 → server reserves stock atomically (20 → 18), snapshots ₹599, creates order `PLACED` + timeline event → audit `STORE_ORDER_PLACED`.
3. Seller confirms (`CONFIRMED`), then hands over at the counter, ticking "payment collected at academy" → `FULFILLED`, `paymentStatus = PAID_AT_ACADEMY`, `paidAt` set.
4. Parent cancels while `PLACED` (or seller cancels while `PLACED`/`CONFIRMED`) → `CANCELLED`, stock restored in the same transaction.
5. After hand-over parent requests refund → `REFUND_REQUESTED`; seller records refund (cash returned at academy, optional restock) → `REFUNDED`; or declines → back to `FULFILLED`.

## 7. Business rules and state transitions

```
PLACED ──► CONFIRMED ──► FULFILLED ──► REFUND_REQUESTED ──► REFUNDED
  │            │                              │
  └► CANCELLED ◄┘                              └──► FULFILLED (refund declined)
```
- Transitions are defined once in `src/lib/store.ts` (`ORDER_TRANSITIONS`, `canTransition`) and enforced with compare-and-set (`updateMany where status = from`) so two concurrent clicks cannot double-apply.
- Stock: reserved at PLACED by a single conditional `UPDATE … WHERE stock >= qty` inside the order transaction (no overselling under concurrency); restored on CANCELLED; restored on REFUNDED only if the seller ticks "item returned to stock".
- Price: always the snapshot; later price edits never change past orders.
- Payment: never online in v1. FULFILLED records whether payment was collected at the academy. Refund amount = snapshot amount if paid, else 0.
- Legacy rows (`PENDING`/`DELIVERED`, no detail row) remain readable; v2 actions ignore them.
- Every server action re-checks `FEATURES.marketplace`.

## 8. Database models and relationships

Existing (unchanged columns): `Product` (`price Float`, `stock Int @default(100)`, `orgId String?`), `Order` (`status String`, `orgId String?`). `Order.status` now also carries the v2 states.

New (additive, `prisma/sql/2026-10-26_store_orders.sql`):
- `StoreOrderDetail` — 1:1 with `Order` (`orderId @unique`): `orgId, quantity, unitPricePaise, amountPaise, currency, paymentMode, paymentStatus, paidAt, paidRecordedById, placedById, note, createdAt, updatedAt`.
- `StoreOrderEvent` — status history: `orgId, orderId, fromStatus, toStatus, actorId, note, createdAt`.
Why side tables instead of new `Order` columns: Prisma selects every scalar column, so adding columns to `Order` would break all existing order queries in production until the SQL is applied. New tables are only read behind the flag.

## 9. API contracts (server actions, `src/app/actions/store.ts`)

| Action | Input | Result |
|---|---|---|
| `createProduct(name, price, description, stock?)` | validated | `{success, error?}` |
| `updateProduct(id, {name?, price?, stock?, description?})` | v2 | `{success, error?}` |
| `placeStoreOrder({productId, studentId, quantity})` | v2 | `{success, orderId?, error?}` |
| `listStoreOrders(filter)` | seller | `{success, orders}` |
| `listMyStoreOrders()` | parent | `{success, orders}` |
| `transitionStoreOrder(orderId, to, {paymentCollected?, restock?, note?})` | seller | `{success, error?}` |
| `cancelMyStoreOrder(orderId)` / `requestStoreRefund(orderId, note?)` | parent | `{success, error?}` |
| legacy `placeOrder`, `fulfillOrder` | | now return an error when the flag is off |

## 10. Error and edge-case behavior

- Out of stock / insufficient stock → "Only N left" or "Out of stock"; no order row is written.
- Concurrent last-item orders → exactly one succeeds (conditional decrement).
- Product from another org / student not yours → "Not found".
- Invalid transition or stale state (someone else moved it) → "Order is now X; refresh".
- Flag off → actions return "The kit store is not enabled"; tabs hidden.
- Product deleted while orders exist: not possible in v1 (no delete).

## 11. Security and privacy requirements

- All queries scoped by `orgId` from the session; parent queries by `parentId = session.id`.
- No minors' data on public pages (store has no public surface).
- Every mutation writes `AuditLog` (`STORE_PRODUCT_CREATED/UPDATED`, `STORE_ORDER_PLACED`, `STORE_ORDER_<STATUS>`), no free-text PII in details.
- No simulated payment or "paid" state without a staff action; Razorpay webhook code untouched.

## 12. Dependencies on shared platform capabilities

Identity/permissions (`src/lib/membership.ts`, `src/lib/team.ts`), audit log, feature flags, Students/parents (V1 Business). Later: payments infrastructure (`src/lib/gateways/razorpay.ts`, `src/lib/razorpay-org.ts`, per-org webhook), notifications, search.

## 13. Acceptance criteria

- Flag off: Kit Store tab and Pro Shop hidden; store actions refuse.
- Two simultaneous orders for the last unit → one succeeds, stock = 0, never negative.
- Editing a product price does not change existing order totals.
- Every transition outside the state machine is rejected; every accepted one writes a `StoreOrderEvent` and an audit row.
- Cancelling restores stock exactly once.
- No screen claims an online payment.

## 14. Unit, integration and end-to-end tests

- Unit (`src/lib/__tests__/store.test.ts`): transition matrix, terminal states, snapshot maths, quantity/price/stock validation, restock rules, refund amount, filter buckets.
- Integration (needs DB; not runnable in sandbox): concurrent `placeStoreOrder` for last unit; cross-org access denial.
- E2E (Playwright, later): parent orders → seller confirms → fulfils → refund.

## 15. Implementation status against the existing repository

| Feature group | Status | Evidence |
|---|---|---|
| Product catalogue | Partial | `createProduct` in `src/app/actions/store.ts` (no validation before this branch, `settings.manage`); `StoreManager.tsx`. No edit/archive/images |
| Inventory | Broken (before this branch) | `Product.stock @default(100)` never checked or decremented by `placeOrder` |
| Price snapshot | Missing (before) | `Order` has no price column |
| Orders / history | Partial | `Order` PENDING/DELIVERED; `src/app/org/page.tsx` loads PENDING only; parent has no history |
| Seller order management | Partial | `fulfillOrder` (`fees.collect`), no audit |
| Parent shop | Partial | `src/components/parent/ProShop.tsx` always orders for first child, `alert("Pay your coach…")` |
| Store gating | Missing (before) | Kit Store tab ungated in `AdminClient.tsx`; `FEATURES.marketplace` unused |
| Payment for orders | Missing | `Payment.feeRecordId` required; webhook has no order branch (`src/app/api/webhooks/razorpay/[orgId]/route.ts`) |
| Cancellations / refunds | Missing (before) | — |
| Search, categories, reviews, settlements, external sellers | Missing | archived `Brand`/`WholesaleProduct` comment blocks in `prisma/schema.prisma` |
| **This branch** | v2 store behind `marketplace` | `src/lib/store.ts`, `src/app/actions/store.ts`, `StoreOrdersPanel.tsx`, `StoreManager.tsx`, `ProShop.tsx`, `prisma/sql/2026-10-26_store_orders.sql` — see §16 for what is still pending |

## 16. Release dependencies and unresolved decisions

- Apply `prisma/sql/2026-10-26_store_orders.sql` before turning on `NEXT_PUBLIC_FEATURE_MARKETPLACE`.
- Turning the flag on per environment re-exposes the Kit Store (it was live and ungated before; this branch hides it by default).
- Open: flag name — `marketplace` comment says "directory"; the public directory (`/academies`) stays ungated and unaffected.
- Open: should online payment (academy Razorpay + verified webhook) be v1.1? Requires founder approval and touching webhook code.
- Open: legacy `Product.stock = 100` default is a fake number; sellers should set stock explicitly (v2 form requires it).
- Open: GST invoicing responsibility (academy), images/sizes (needs `Product` columns → separate migration).
