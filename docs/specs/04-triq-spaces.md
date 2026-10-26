# Vertical 4 — TRIQ Spaces (venues & facility booking)

Status: spec + first build slices. Written 2026-10-26 against `main` (5ab2358). Supersedes
`docs/roadmap/verticals/05-venues.md` (old V5), reusing its verified findings.

## 1. Product purpose and target users

Make sports facilities discoverable, bookable and operable on one availability grid — walk-in,
phone, lease, online and maintenance — with no double-booking and money states that are never invented.

| User | Need |
|---|---|
| Venue operator (owner/manager/groundsman) | Configure courts, hours, prices; manage bookings, blocks, cancellations, reschedules; see utilisation |
| Customer (no login) | Find a venue, see free slots, book and pay advance (Razorpay or UPI) |
| Academy (same org) | Use its own courts for batches (later slice) |

## 2. User roles and permissions

| Action | Check |
|---|---|
| Courts, bookings, blocks, cancel, reschedule | `checkPermission("bookings.manage")` (OWNER, MANAGER, STAFF/GROUNDSMAN by default) |
| Utilisation report | `bookings.manage` or `reports.view` |
| Public venue page `/book/[slug]`, discovery `/venues` | anonymous, rate-limited writes, no customer PII returned |
| Payment setup | owner only (`razorpay-connect.ts`, untouched) |

## 3. Feature inventory

| Group (scope) | Status after this branch |
|---|---|
| Venue & facility profiles | org profile + `Facility` (name, type, rate, hours, advance) |
| Sports & amenities | org `sport`, facility `type`; amenities missing |
| Location & discovery | `/venues` listing with city + sport filters (flag `spacesDiscovery`) |
| Operating hours | per facility open/close hour (IST) |
| Pricing & slot config | flat hourly rate + advance; peak pricing missing |
| Availability calendar | owner board per day; public busy-hours grid |
| Booking & reservation | counter, lease (weekly ×26), online hold + Razorpay, UPI report/confirm |
| Confirmation & cancellation | existing actions + policy quote + audit |
| Rescheduling & refund policy | pure policy rules; staff reschedule with lock + overlap check (flag `spacesOps`); refunds stay manual and are shown as "refund due", never marked paid |
| Owner dashboard | `TurfBoard` |
| Utilisation reports | from real bookings, per facility (flag `spacesOps`) |
| Maintenance / unavailable slots | `TurfBooking` rows with `source = BLOCK` through the same engine (flag `spacesOps`) |
| Reviews & ratings | Missing (needs moderation) |
| Facility-level permissions | org-level only; per-facility missing |

## 4. Screens and navigation

- Admin → Bookings (`BookingsScreen` → `TurfBoard`): day grid, new booking, booking sheet actions.
  This branch adds (behind `spacesOps`): **Block time** form, blocked cells rendered grey with reason,
  **Reschedule** in the booking sheet, cancellation policy quote, **Utilisation** card (7/30 days).
- Public `/book/[slug]` (unchanged UI).
- Public `/venues` (behind `spacesDiscovery`): filters (city, sport), cards → `/book/[slug]`.

## 5. Field definitions and validation

Facility: name 2–60, type ≤20 upper, hourlyRate 0–200000 ₹, openHour 0–23, closeHour open+1…24,
advance ≤ day total. Booking: date `YYYY-MM-DD` not in past, hours 1–6, inside opening hours, phone
10 digits, amount 0–1,000,000, advance ≤ amount. Block: facility of org, date not past, start/hours
inside opening hours (up to full day), days 1–31, reason 2–80. Reschedule: CONFIRMED only, not
BLOCK/LEASE series move, same duration, new start in future and ≥ policy cutoff from the *original*
start, inside new facility's hours. Discovery filters: city/sport slug ≤40 chars, page ≥1, 24 per page.

## 6. Journeys

1. Operator sets up courts (`saveFacility`). 2. Configures hours/price. 3. Customer searches `/venues`
(flagged) or opens `/book/[slug]`. 4. Picks a free slot. 5. `reserveSlot` validates under an advisory
lock + exclusion constraint and creates HOLD/CONFIRMED. 6. Operator manages (confirm UPI, complete,
no-show, collect balance). 7. Cancel/reschedule under policy. 8. Operator reviews utilisation.

## 7. Business rules and state transitions

Status: `HOLD → CONFIRMED | EXPIRED | CANCELLED | PAID_CONFLICT`; `CONFIRMED → COMPLETED | NO_SHOW |
CANCELLED`; `PAID_CONFLICT → CONFIRMED (UPI confirm) | CANCELLED`. Active = HOLD (unexpired) + CONFIRMED.
- **Blocks**: `source = BLOCK`, `status = CONFIRMED`, amount 0, created through `reserveSlot` so they
  can never overlap a booking; removing a block = CANCEL. Blocks can't be completed/no-showed/collected.
- **Cancellation policy** (`src/lib/venue-policy.ts`, defaults until per-venue config exists):
  ≥24 h before start → full refund of money received; 4–24 h → 50 %; <4 h or after start → none.
  The operator may always cancel; the quote ("refund due ₹X") is shown and stored in the audit
  details. TRIQ does not issue or mark refunds — `advancePaid` is never changed by a cancel.
- **Reschedule policy**: allowed up to 4 h before the original start, CONFIRMED only, same duration;
  amount unchanged; target slot checked under locks on both facilities (lock order by id).
- **Utilisation** (`src/lib/venue-utilisation.ts`): capacity = open hours × days; blocked hours
  subtracted from capacity; booked hours = CONFIRMED + COMPLETED + NO_SHOW (non-BLOCK);
  utilisation = booked ÷ (capacity − blocked); revenue booked = Σ amount; received = Σ advancePaid
  (as recorded — not "verified"); counts of cancellations / no-shows / online vs counter.
- **Audit**: every staff create/cancel/reschedule/block writes `AuditLog` (`TURF_BOOKING_CREATED`,
  `TURF_BOOKING_CANCEL`, `TURF_BOOKING_RESCHEDULED`, `TURF_BLOCK_CREATED`); every create/cancel from any
  actor (staff, customer, gateway, system expiry) also writes `TurfBookingEvent` (flag `spacesOps`,
  best-effort so a missing table never breaks a booking).

## 8. Database models

Existing: `Facility`, `TurfBooking` (status/source strings), `AuditLog`, `Organization`.
New (additive, `prisma/sql/2026-10-26_turf_booking_events.sql`): `TurfBookingEvent` (orgId,
bookingId → TurfBooking cascade, action, actorType STAFF|CUSTOMER|GATEWAY|SYSTEM, actorUserId?,
details JSON text, createdAt). No change to `TurfBooking` columns (BLOCK is a new `source` value).
Legacy `Booking` model: unused, left in place.

## 9. API contracts

`src/app/actions/turf-bookings.ts`: existing `getTurfBoard`, `saveFacility`, `archiveFacility`,
`createCounterBooking`, `updateBooking`; new `blockSlots(input)`, `rescheduleBooking(id, input)`,
`getCancellationQuote(id)`, `getVenueUtilisation(days)`.
`src/app/book/actions.ts`: unchanged signatures; creation/expiry/report paths add booking events.
`src/app/venues/actions.ts` (new): `listPublicVenues({city, sport, page})`.
`src/lib/turf-engine.ts`: `reserveSlot` accepts `source: "BLOCK"`; new `moveSlot`.

## 10. Errors and edge cases

Slot taken between view and submit → CONFLICT message; block over existing bookings → those days
reported as conflicts, nothing overwritten; reschedule target taken → "slot taken", original kept;
paid after hold expired → PAID_CONFLICT for manual refund (existing); facility archived with future
bookings → refused (existing); public discovery with no venues → empty state, never sample data.

## 11. Security and privacy

Public endpoints never return customer names/phones (busy hours only). Discovery returns org name,
city, sport, court count, min price, first photo — no staff or student data. All owner queries scoped
by `orgId`. Razorpay secrets stay encrypted (untouched). Audit for every booking create/cancel.

## 12. Shared platform dependencies

Scheduling (IST helpers `src/lib/turf.ts`; org timezone TODO), payments (Razorpay per-org, webhook
`src/app/api/webhooks/razorpay/[orgId]/route.ts`), audit, search/discovery (shared with Play later),
rate limiting (`rateLimitDb`), notifications (missing).

## 13. Acceptance criteria

- No two active rows overlap on a facility (engine + constraint); blocks obey the same rule.
- Every staff booking create/cancel has an `AuditLog` row.
- Cancellation quote matches the policy tiers at the boundaries (24 h, 4 h, start).
- Reschedule never leaves the booking in both or neither slot; conflict leaves it unchanged.
- Utilisation numbers reconcile with the booking rows for the range.
- `/venues` 404s with `spacesDiscovery` off; lists only active orgs with active priced facilities.

## 14. Tests

Unit: `src/lib/__tests__/venue-policy.test.ts`, `venue-utilisation.test.ts`, `turf-blocks` helpers.
Integration (DB, not in CI): concurrent `reserveSlot`, `moveSlot` conflict. E2E: payment smoke test
(`docs/sprints/task-7-payment-smoke-test.md` pattern) for a turf booking.

## 15. Implementation status (verified on `main` 5ab2358, updated for branch `build/v-play-spaces`; nothing run against a database)

| Feature group | Status | Evidence |
|---|---|---|
| Courts/facilities | Complete | `saveFacility`/`archiveFacility` in `src/app/actions/turf-bookings.ts` |
| Owner day board | Complete | `src/components/org/TurfBoard.tsx` via `src/components/shell/BookingsScreen.tsx` (flag `bookings`, default on) |
| Counter / lease bookings | Complete | `createCounterBooking` (repeat ≤ `MAX_LEASE_WEEKS`) |
| Double-booking protection | Complete in code; constraint not in repo SQL | `reserveSlot` advisory lock + overlap check, `isOverlapViolation` in `src/lib/turf-engine.ts`; `scripts/apply-turf-constraint.ts` absent; assignment states constraint exists in prod |
| Online advance (Razorpay) | Complete (code) | `startOnlineBooking`, `confirmTurfCheckout` (`src/app/book/actions.ts`), `confirmPaidBooking`, webhook `[orgId]/route.ts` |
| UPI direct | Complete, overloads `providerPaymentId` with `UPI_REPORTED` marker | `startUpiBooking`, `reportUpiPaid`, `confirmUpiBooking` |
| Booking lifecycle actions + audit | Complete in code (this branch) — staff create/cancel/series/reschedule/block → `AuditLog`; all actors → `TurfBookingEvent` (flag `spacesOps`, SQL not applied); webhook-path confirmations not evented (webhook untouched) | `src/app/actions/turf-bookings.ts`, `src/app/book/actions.ts`, `src/lib/turf-audit.ts` |
| Cancellation / refund policy | Complete (quote only; refunds stay manual) behind `spacesOps` | `src/lib/venue-policy.ts` + tests; quote in cancel confirm and audit details |
| Rescheduling | Complete in code behind `spacesOps` (staff only) | `moveSlot` in `src/lib/turf-engine.ts`, `rescheduleBooking`, `RescheduleForm` in `TurfBoard.tsx` |
| Maintenance / blocked slots | Complete in code behind `spacesOps` (no schema change) | `blockSlots`, `BlockDialog`/`BlockedSlotDialog` in `TurfBoard.tsx` |
| Utilisation report | Complete behind `spacesOps` | `src/lib/venue-utilisation.ts` + tests, `getVenueUtilisation`, `src/components/org/VenueUtilisation.tsx` |
| Public discovery listing | Complete behind `spacesDiscovery` (noindex) | `src/app/venues/page.tsx`, `src/lib/venue-discovery.ts` + tests |
| Public booking page gated by flag | Partial | `/book/*` does not read `FEATURES` |
| Academy batch ↔ court | Broken/dead | `Booking` + `bookFacility` (`src/app/actions/facilities.ts`) — no UI caller, not checked by engine |
| Reviews, amenities, peak pricing, per-facility permissions, branch link | Missing | — |

## 16. Release dependencies and open decisions

- Apply `prisma/sql/2026-10-26_turf_booking_events.sql` before turning on `NEXT_PUBLIC_FEATURE_SPACES_OPS`
  (writes are best-effort, so the board still works if forgotten, but no history is kept).
- Per-venue policy configuration (columns on `Facility` or `Organization`) — defaults hard-coded for now.
- Commit the prod exclusion-constraint definition as SQL after a read-only inspection.
- Payment method per booking (`paymentMethod` column, old V5 S2) to separate offline / UPI / verified.
- Batches blocking courts (`source = BATCH`) — next slice; reuses the BLOCK pattern.
- Customer self-service cancel/reschedule from the public page (needs phone + booking proof).
- Discovery: should TURF-only orgs and academies with courts both be listed? (v1: any active org with an active priced facility.)
