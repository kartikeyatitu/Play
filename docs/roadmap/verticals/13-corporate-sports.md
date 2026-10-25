# Vertical 13 — Corporate sports (light v1)

Status: planning doc. Nothing here is built beyond an unused flag. Verified against branch `feat/academy-os-branches`
on 2026-10-25 (read-only).

## 1. Goal

Let an academy or turf run its company business inside Triq. In Noida/Gurgaon the real corporate revenue is: (a) a
company leasing a court/turf every week for employees, (b) an employee coaching batch (e.g. Saturday badminton for
staff) billed to the company, and (c) a one-off corporate event day. All three are B2B: one company, one contact, one
monthly bill — not per-child fees to parents. v1 gives the academy a "Corporate clients" list, ties existing turf leases
and batches to a client, and produces a monthly statement the academy can send and mark paid, so this money shows up in
the P&L. No employee app, no company portal.

## 2. Verified today

| Capability | Evidence | Status |
|---|---|---|
| Corporate flag | `corporate: flag("CORPORATE", false)` in `src/lib/features.ts`; `grep -ri corporate src` → only that file; no `FEATURES.corporate` reads anywhere | missing (flag defined, never read) |
| Corporate on marketing pages / docs | `grep -ri "corporate"` over `src`, `public`, `docs` → only `src/lib/features.ts` | missing |
| Recurring court lease | `createCounterBooking` in `src/app/actions/turf-bookings.ts` (~line 230): `repeatWeeks` up to `MAX_LEASE_WEEKS = 26` (`src/lib/turf.ts`), rows get `source: "LEASE"` + shared `leaseGroupId`; customer is free text `customerName`/`customerPhone` on `TurfBooking` | working (not linked to any account) |
| Batches | `Batch` model (`coachId` required, `monthlyFee`, `capacity`, `branchId`) | working (parent/child-centric) |
| Participants | `Student` requires `parentId` → `User` (`prisma/schema.prisma` Student model) | does not fit employees |
| Leads | `Lead` requires `childName` (parent enquiries); `SalesLead` is Triq's own sales inbox (`src/app/ops/leads`, SUPER_ADMIN) | does not fit company enquiries |
| P&L | `getPayroll` summary in `src/app/actions/payroll.ts` (~line 226): `profit = feesCollected - salaries - expenseTotal` | working (fees only) |
| Permissions | `bookings.manage`, `batches.manage`, `fees.collect` in `src/lib/team.ts` | working |

## 3. Gaps for a real v1

- No "company" record: name, billing contact, GSTIN, agreed rate.
- Turf leases for a company are just a free-text name; nothing groups a company's leases or totals them per month.
- No way to bill a company monthly; `FeeRecord` is per-student and `@@unique([studentId, month])`.
- Corporate income is invisible in the P&L.
- Employees cannot sensibly be `Student` rows (each needs a parent `User`).

## 4. v1 scope

**In**
- Corporate clients list: company name, contact name/phone/email, GSTIN (optional), status (PROSPECT / ACTIVE / PAUSED / ENDED), notes.
- Link a turf lease group and/or a batch to a client (`corporateClientId`). A linked batch is an "employee batch":
  headcount number instead of student rows, so no fake parents.
- Monthly statement per client: auto-totals that month's linked `TurfBooking` amounts (status CONFIRMED/COMPLETED) plus a
  fixed monthly amount for linked batches; editable before issue; mark ISSUED, PAID (date, mode, reference).
- Statement page printable / shareable over WhatsApp using `waLink` from `src/lib/i18n.ts`.
- Paid statements add a "Corporate" line to the P&L.

**Out (explicitly)**
- Employee logins, per-employee attendance, company HR portal, inter-company leagues/tournaments (Events vertical),
  GST-compliant tax invoices with numbering rules (open question), online payment of statements, a corporate marketing page.

## 5. Data model

New: `CorporateClient` and `CorporateStatement`. Justification: no existing model represents a paying company, and
`FeeRecord`/`Receipt` are hard-wired to `studentId`. Reuse: `TurfBooking` and `Batch` get one nullable FK each instead of
new booking/batch tables.

```prisma
/// Vertical 13 (additive): a company that pays the academy.
model CorporateClient {
  id           String   @id @default(cuid())
  orgId        String
  companyName  String
  contactName  String?
  contactPhone String?
  contactEmail String?
  gstin        String?
  status       String   @default("ACTIVE") // PROSPECT | ACTIVE | PAUSED | ENDED
  notes        String?
  createdById  String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  org          Organization         @relation(fields: [orgId], references: [id], onDelete: Cascade)
  statements   CorporateStatement[]
  @@unique([orgId, companyName])
  @@index([orgId, status])
}

/// One monthly bill to a company. Lines are frozen as JSON once ISSUED.
model CorporateStatement {
  id                String    @id @default(cuid())
  orgId             String
  corporateClientId String
  month             String    // "YYYY-MM"
  lines             Json      // [{ label, kind: "LEASE"|"BATCH"|"OTHER", refId?, amount }]
  total             Int
  status            String    @default("DRAFT") // DRAFT | ISSUED | PAID | VOID
  issuedAt          DateTime?
  paidAt            DateTime?
  paymentMode       String?   // CASH | UPI | BANK
  reference         String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  client            CorporateClient @relation(fields: [corporateClientId], references: [id], onDelete: Cascade)
  @@unique([corporateClientId, month])
  @@index([orgId, month, status])
}

// TurfBooking gets: corporateClientId String?   (+ @@index([corporateClientId]))
// Batch gets:       corporateClientId String?, headcount Int?
```

`prisma/sql/2026-10-26_corporate.sql` (proposed; NOT applied without founder approval):

```sql
-- Additive only. NOT APPLIED. Apply BEFORE deploying code that selects the new Batch/TurfBooking columns
-- (Prisma selects all columns, same warning as 2026-10-25_branches.sql).
CREATE TABLE IF NOT EXISTS "CorporateClient" (
  "id" TEXT PRIMARY KEY, "orgId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "companyName" TEXT NOT NULL, "contactName" TEXT, "contactPhone" TEXT, "contactEmail" TEXT, "gstin" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE', "notes" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS "CorporateClient_orgId_companyName_key" ON "CorporateClient"("orgId", "companyName");
CREATE INDEX IF NOT EXISTS "CorporateClient_orgId_status_idx" ON "CorporateClient"("orgId", "status");
ALTER TABLE "CorporateClient" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "CorporateStatement" (
  "id" TEXT PRIMARY KEY, "orgId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "corporateClientId" TEXT NOT NULL REFERENCES "CorporateClient"("id") ON DELETE CASCADE,
  "month" TEXT NOT NULL, "lines" JSONB NOT NULL DEFAULT '[]', "total" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'DRAFT', "issuedAt" TIMESTAMP(3), "paidAt" TIMESTAMP(3),
  "paymentMode" TEXT, "reference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS "CorporateStatement_client_month_key" ON "CorporateStatement"("corporateClientId", "month");
CREATE INDEX IF NOT EXISTS "CorporateStatement_orgId_month_status_idx" ON "CorporateStatement"("orgId", "month", "status");
ALTER TABLE "CorporateStatement" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "TurfBooking" ADD COLUMN IF NOT EXISTS "corporateClientId" TEXT
  REFERENCES "CorporateClient"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "TurfBooking_corporateClientId_idx" ON "TurfBooking"("corporateClientId");
ALTER TABLE "Batch" ADD COLUMN IF NOT EXISTS "corporateClientId" TEXT
  REFERENCES "CorporateClient"("id") ON DELETE SET NULL;
ALTER TABLE "Batch" ADD COLUMN IF NOT EXISTS "headcount" INTEGER;
```

## 6. Build slices

**S1 — Corporate clients list**
- Objective: More → "Corporate" tab with add/edit/status for companies.
- Files: `src/lib/corporate.ts` (`CORPORATE_STATUSES`, pure `parseCorporateClientInput`, GSTIN format check),
  `src/lib/__tests__/corporate.test.ts`, `src/app/actions/corporate.ts` ("use server"),
  `src/components/org/CorporatePanel.tsx`, tab in `src/components/org/AdminClient.tsx` behind `FEATURES.corporate`
  (first real use of the existing flag). Schema: `CorporateClient` table only.
- Permission/tenancy: new key `"corporate.manage"` in `src/lib/team.ts` (auto OWNER + MANAGER; add to ACCOUNTANT);
  all reads `where: { orgId: session.orgId }`; edits `findFirst({ id, orgId })`.
- Audit: `CORPORATE_CLIENT_CREATED`, `CORPORATE_CLIENT_UPDATED`, `CORPORATE_CLIENT_STATUS_CHANGED`.
- Tests: input parsing, GSTIN regex, duplicate-name message.
- Accept: cross-org id returns "not found"; flag off → no tab, actions refuse.

**S2 — Link leases and employee batches**
- Objective: pick a corporate client when creating a lease or batch; client detail shows its leases/batches.
- Files: `src/app/actions/turf-bookings.ts` (optional `corporateClientId` in `createCounterBooking`, applied to every row
  of the lease group; also "link existing lease group"), `src/app/actions/batch.ts` (optional `corporateClientId`,
  `headcount`), booking + batch forms (field shown only when flag on). Schema: the two `ALTER TABLE`s.
- Permission: existing `bookings.manage` / `batches.manage` for the booking/batch, plus client must satisfy
  `findFirst({ id: corporateClientId, orgId })`.
- Audit: `TURF_LEASE_LINKED_CORPORATE`, `BATCH_LINKED_CORPORATE`.
- Tests: pure `leaseTotalsForMonth(bookings, month, tz)` (excludes CANCELLED/EXPIRED).
- Accept: double-booking guarantees in `src/lib/turf-engine.ts` unchanged; flag off → forms identical to today.

**S3 — Monthly statement + P&L**
- Objective: generate DRAFT for a month, edit lines, ISSUE, mark PAID; printable page; P&L "Corporate" line.
- Files: `src/lib/corporate.ts` (`buildStatementLines`), `src/app/actions/corporate.ts`
  (`generateStatement`, `issueStatement`, `markStatementPaid`, `voidStatement`),
  `src/app/org/corporate/[statementId]/page.tsx`, `src/app/actions/payroll.ts` + `PayrollPanel.tsx` (flag-gated line).
- Permission: `corporate.manage`; statement page also checks orgId.
- Audit: `CORPORATE_STATEMENT_GENERATED`, `_ISSUED`, `_PAID`, `_VOIDED` (with total).
- Tests: line building, total = sum(lines), ISSUED lines immutable, P&L math.
- Accept: regenerate on ISSUED is refused; flag off → P&L identical to today.

## 7. Feature flag

Existing `corporate` / `NEXT_PUBLIC_FEATURE_CORPORATE` (already defined, default `false`, currently unused). Gates the
tab, all corporate actions server-side, the extra form fields, the statement page and the P&L line. Stays default off.

## 8. Dependencies

- Vertical 1 (Academy operations): turf leases (`turf-bookings.ts`), batches, branches, Payroll P&L. S2 edits core
  booking/batch actions — needs Vertical 1 owner review and must keep existing behaviour when the field is absent.
- Bookings flag (`FEATURES.bookings`, default true): lease linking only appears when bookings are on.
- Vertical 9 (Sponsorship): shares the "non-fee income in P&L" change; do the P&L summary refactor once.
- Events vertical: corporate tournament days belong there in v2.

## 9. Risks and open questions

- Do academies need GST tax invoices (sequential numbering, HSN/SAC) for companies, or is a statement enough for v1?
- Employee batches: headcount only, or do companies need attendance reports for HR? (Pushed to v2; would need a
  participant model that is not `Student`.)
- Should a lease's per-booking `amount` be the billing source of truth, or a negotiated flat monthly rate? v1 supports
  both via editable DRAFT lines.
- Payment collection online (Razorpay link to the company) — reuse academy Razorpay later?
- Lease `customerPhone` is validated as an Indian 10-digit number (`cleanIndianPhone`); fine for current markets.
