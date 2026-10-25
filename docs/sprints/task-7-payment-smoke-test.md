# Sprint 1 Task 7 — ₹1 end-to-end payment smoke test

**Runbook. Executed by: Kartikeya. Expected duration: 15 min.**

## Why

Every Razorpay webhook, idempotency, and reconciliation code path in `src/app/api/webhooks/razorpay/`
has never processed a real production payment. DB verified 2026-10-20:

```sql
SELECT COUNT(*) FROM "Payment" WHERE status = 'PAID';  -- → 0
```

All 285 "paid" fees were manual admin flips. The first real payment is the one most likely
to hit edge cases (invalid signature, duplicate webhook, missing receipt). Catching that in
a controlled ₹1 test is 100x cheaper than finding it on a real parent's ₹2,500 fee.

## Pre-flight

- [ ] Vercel invoice paid (otherwise sportsos is in a half-paused state)
- [ ] sportsos-tau.vercel.app loads cleanly
- [ ] You're signed in as the owner of a test academy (NOT a real paying academy)
- [ ] At least one Student exists under that academy with a Parent attached
- [ ] Your own card (any card) is physically with you
- [ ] You've enabled international transactions on it (per earlier Vercel debugging)

## Steps

1. **Create a fake fee for your test academy**
   - `/org` → Students tab → your test student → set monthly fee to **₹1**
   - Make sure the current month's FeeRecord says PENDING

2. **Open the parent app in a second browser (incognito)**
   - sportsos-tau.vercel.app/login → use the parent's phone + OTP code `123456`
   - Should land on `/parent`
   - Verify the ₹1 PENDING fee is visible

3. **Trigger online payment**
   - Click "Pay Online"
   - Razorpay checkout opens
   - Enter your real card details
   - Complete the 3D Secure / OTP step
   - ₹1 charged

4. **Confirm the full round-trip (within 60 seconds)**
   - Parent app shows the fee as PAID with a receipt download link
   - Receipt downloads as an image
   - Admin dashboard (first browser) shows the fee as PAID
   - Admin's Collect Fees list no longer shows this row

5. **Check the DB directly (ask Claude)**
   - Share a screenshot or paste the following query output. Claude will interpret.

```sql
SELECT
  p.id,
  p.status,
  p."providerPaymentId",
  p."providerOrderId",
  p.amount,
  p."paidAt",
  fr.status AS "feeStatus",
  r."receiptNumber"
FROM "Payment" p
LEFT JOIN "FeeRecord" fr ON fr.id = p."feeRecordId"
LEFT JOIN "Receipt" r ON r."feeRecordId" = p."feeRecordId"
WHERE p.amount = 100  -- paise, so ₹1
ORDER BY p."createdAt" DESC
LIMIT 1;
```

Expected: ONE row with `status='PAID'`, both provider IDs set, `feeStatus='PAID'`,
`receiptNumber` populated.

## Red flags to watch for

- Fee marked PAID but no Payment row → webhook never ran, signature verify failed
- Payment row exists but FeeRecord still PENDING → reconciliation gap
- No Receipt row → receipt-service error
- Two Payment rows for the same `providerOrderId` → webhook idempotency broken

## Follow-up tests (same session, after the ₹1 round-trip works)

Only run these if step 5 is green.

### A) Webhook replay (idempotency)
Open Razorpay dashboard → Settings → Webhooks → find the delivery for this payment →
"Replay". Then re-run step 5 query. **Expected:** still exactly ONE Payment row.
A second row = idempotency broken.

### B) Receipt URL check
Grab the receipt token from the parent app's download link. Open it in an incognito
window. **Expected:** the receipt image renders without requiring auth.
Browser prompts for login or 404 = receipt-service exposure problem.

### C) Admin reversal attempt
Admin dashboard → the paid fee → tap the toggle to reverse it.
**Expected (post-Sprint 1 Task 1):** the UI refuses, saying "This fee was paid online
via Razorpay. Issue a refund from the gateway dashboard instead."
If it allows the reversal, the fee-toggle safety fix (`dcef8f3`) didn't deploy correctly.

## Refund your test ₹1

- Razorpay Dashboard → Payments → find the ₹1 payment → Refund button

## Report back

Three lines are enough:
- Steps 1–4: pass / fail (one line per step if failed)
- Step 5 SQL output
- Any red flags
