# Vertical 9 — Sponsorship (light v1)

Status: planning doc. Nothing here is built. Verified against branch `feat/academy-os-branches` on 2026-10-25 (read-only).

## 1. Goal

Help an academy owner win and keep small sponsors (the local sports shop, a clinic, a real-estate office, a kit brand's
regional dealer) and see that money in the same place as fees and expenses. v1 is a sponsor tracker inside Academy OS:
who sponsors us, what they give (cash or kit), what we promised them (logo on jersey, banner, social posts), how much has
actually come in, and when the deal ends. It ends with an optional "Our sponsors" strip on the academy's public page and a
one-page sponsor pitch built from real academy counts. No brand marketplace, no Triq-brokered deals.

## 2. Verified today

| Capability | Evidence | Status |
|---|---|---|
| Any sponsor model / action / UI | `grep -ri sponsor src` → no hits. Only hits are commented-out `Brand` / `BrandSponsorship` models in `prisma/schema.prisma` (~lines 445–478, "ARCHIVED / FUTURE FEATURES (COMMENTED OUT)") and the same in `prisma/schema.sandbox.prisma` | missing (archived idea only) |
| Archived `BrandSponsorship` design | Commented model: `brandId, title, targetSport, stipendVal, status` — brand-centric (Yonex/Decathlon), **no `orgId`**, not tenant-scoped | not usable as-is |
| Money in / out ledger for P&L | `Expense` model (`orgId, date, category, amount…`), categories in `src/lib/payroll.ts` (`EXPENSE_CATEGORIES`); profit = `feesCollected - salaries - expenseTotal` in `src/app/actions/payroll.ts` (~line 226), shown by `src/components/org/PayrollPanel.tsx` ("Fees − salaries − expenses") | working (no non-fee income) |
| Tenant + permission pattern to copy | `checkPermission` in `src/lib/membership.ts`; `PERMISSIONS` in `src/lib/team.ts`; audit helper pattern in `src/app/actions/branches.ts` (`db.auditLog.create`) | working |
| File upload (logo) | `@vercel/blob` in `package.json`; `Organization.photos` comment says "Hosted on Vercel Blob"; `src/app/actions/photos.ts` `uploadAcademyPhoto` uses `put(..., { access: "public" })` for academy photos | working (pattern to copy for logos) |
| Public academy page | `src/app/academy/[slug]/page.tsx` loads org + batches + counts only ("never load student rows") | working |
| Feature flag | none for sponsorship in `src/lib/features.ts` | missing |

## 3. Gaps for a real v1

- No tenant-scoped place to store a sponsor, its deal terms, deliverables, or end date.
- No way to record non-fee income, so the Payroll P&L under-reports academies that have sponsors.
- No reminders for renewals or for deliverables the academy owes the sponsor.
- No public acknowledgement surface (sponsors expect visibility; it is the main thing academies can offer).
- No permission key that fits ("fees.manage" is about parent dues; "settings.manage" is owner-only).

## 4. v1 scope

**In**
- Sponsor deal list per academy: sponsor name, contact person, phone, kind (CASH / KIND / BOTH), agreed value, start/end
  date, status (PROSPECT, ACTIVE, ENDED, LOST), deliverables as free text, optional logo, optional branch/sport.
- Record money received against a deal (date, amount, mode). Appears as "Sponsorship" income in the Payroll P&L tile.
- "Ending in 30 days" badge on the list (computed, no cron).
- Opt-in public strip "Supported by" on `/academy/[slug]` (only deals with `showPublicly = true` and status ACTIVE).
- Printable one-page pitch: academy name, sports, batch count, student count, branch count, city — counts only.

**Out (explicitly)**
- Brand-side accounts, a sponsor marketplace, Triq taking a cut, contracts/e-signature, GST invoices to sponsors,
  per-athlete sponsorship (minors' NIL-style deals — legal risk), automated social posting, kit inventory tracking
  (existing `Equipment` model covers kit if needed).

## 5. Data model

Two new tables. `Expense` is outflow-only and its categories are a closed list, so reusing it for income would change the
meaning of existing P&L math. The archived `BrandSponsorship` has no `orgId`; it is not revived.

```prisma
/// Vertical 9 (additive): a sponsor deal of one academy.
model Sponsorship {
  id           String    @id @default(cuid())
  orgId        String
  sponsorName  String
  contactName  String?
  contactPhone String?
  kind         String    @default("CASH")     // CASH | KIND | BOTH
  valueAmount  Int       @default(0)          // agreed value, whole units of org currency
  startDate    DateTime?
  endDate      DateTime?
  status       String    @default("PROSPECT") // PROSPECT | ACTIVE | ENDED | LOST
  deliverables String?                        // "Logo on U-14 jerseys, 1 banner, 2 posts/month"
  logoUrl      String?                        // Vercel Blob URL
  showPublicly Boolean   @default(false)
  branchId     String?                        // optional: sponsor of one centre
  createdById  String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  org          Organization         @relation(fields: [orgId], references: [id], onDelete: Cascade)
  payments     SponsorshipPayment[]
  @@index([orgId, status])
}

/// Money actually received from a sponsor (feeds the P&L).
model SponsorshipPayment {
  id            String   @id @default(cuid())
  orgId         String
  sponsorshipId String
  date          DateTime // IST calendar day at 00:00 (same convention as Expense)
  amount        Int
  paymentMode   String?  // CASH | UPI | BANK
  note          String?
  createdById   String?
  createdAt     DateTime @default(now())
  sponsorship   Sponsorship @relation(fields: [sponsorshipId], references: [id], onDelete: Cascade)
  @@index([orgId, date])
  @@index([sponsorshipId])
}
// Organization gets: sponsorships Sponsorship[]
```

`prisma/sql/2026-10-26_sponsorships.sql` (proposed; NOT applied without founder approval):

```sql
-- Additive only. NOT APPLIED. Apply BEFORE deploying code that reads these tables.
CREATE TABLE IF NOT EXISTS "Sponsorship" (
  "id" TEXT PRIMARY KEY, "orgId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "sponsorName" TEXT NOT NULL, "contactName" TEXT, "contactPhone" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'CASH', "valueAmount" INTEGER NOT NULL DEFAULT 0,
  "startDate" TIMESTAMP(3), "endDate" TIMESTAMP(3), "status" TEXT NOT NULL DEFAULT 'PROSPECT',
  "deliverables" TEXT, "logoUrl" TEXT, "showPublicly" BOOLEAN NOT NULL DEFAULT false,
  "branchId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX IF NOT EXISTS "Sponsorship_orgId_status_idx" ON "Sponsorship"("orgId", "status");
ALTER TABLE "Sponsorship" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "SponsorshipPayment" (
  "id" TEXT PRIMARY KEY, "orgId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "sponsorshipId" TEXT NOT NULL REFERENCES "Sponsorship"("id") ON DELETE CASCADE,
  "date" TIMESTAMP(3) NOT NULL, "amount" INTEGER NOT NULL, "paymentMode" TEXT, "note" TEXT,
  "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS "SponsorshipPayment_orgId_date_idx" ON "SponsorshipPayment"("orgId", "date");
CREATE INDEX IF NOT EXISTS "SponsorshipPayment_sponsorshipId_idx" ON "SponsorshipPayment"("sponsorshipId");
ALTER TABLE "SponsorshipPayment" ENABLE ROW LEVEL SECURITY;
```

`branchId` is deliberately not a FK in v1 (keeps the migration independent of `2026-10-25_branches.sql` ordering); the
action validates it belongs to the org.

## 6. Build slices

**S1 — Sponsor tracker (CRUD)**
- Objective: list/add/edit/end sponsor deals under More → "Sponsors".
- Files: `src/lib/sponsorship.ts` (constants `SPONSOR_KINDS`, `SPONSOR_STATUSES`, pure `parseSponsorshipInput`,
  `isEndingSoon(endDate, today)`), `src/lib/__tests__/sponsorship.test.ts`, `src/app/actions/sponsorships.ts`
  ("use server", async exports only), `src/components/org/SponsorsPanel.tsx`, add tab in
  `src/components/org/AdminClient.tsx` behind `FEATURES.sponsorship`; `src/lib/features.ts`; `src/lib/team.ts` add
  `"sponsors.manage"`; schema + SQL above.
- Permission/tenancy: `checkPermission("sponsors.manage")`; every query `where: { orgId: session.orgId }`; update/delete
  via `findFirst({ id, orgId })` first (pattern from `branches.ts`). New key auto-grants OWNER and MANAGER via
  `defaultPermissions`; add to ACCOUNTANT defaults.
- Audit: `SPONSORSHIP_CREATED`, `SPONSORSHIP_UPDATED`, `SPONSORSHIP_STATUS_CHANGED`, `SPONSORSHIP_DELETED`.
- Tests: input parsing (name required, value ≥ 0, end ≥ start, phone normalised), status transitions, `isEndingSoon`.
- Accept: owner adds a deal, sees it; a manager in org B cannot read/edit org A's id (returns "not found"); flag off → tab
  absent and actions return error.

**S2 — Money received + P&L**
- Objective: record receipts; P&L shows Fees + Sponsorship − Salaries − Expenses.
- Files: `src/app/actions/sponsorships.ts` (`addSponsorshipPayment`, `deleteSponsorshipPayment`),
  `src/app/actions/payroll.ts` (add `sponsorshipIncome` to summary only when flag on; `profit` formula updated),
  `src/components/org/PayrollPanel.tsx` (extra tile, flag-gated), pure `sumByMonth` in `src/lib/sponsorship.ts`.
- Permission: `sponsors.manage` to write; P&L read stays under existing payroll permissions.
- Audit: `SPONSORSHIP_PAYMENT_ADDED`, `SPONSORSHIP_PAYMENT_DELETED`.
- Tests: month bucketing in org timezone (reuse `orgCurrentMonth` semantics from `src/lib/i18n.ts`), profit math.
- Accept: with flag off, Payroll numbers are byte-identical to today.

**S3 — Public strip + pitch page**
- Objective: "Supported by" logos on `/academy/[slug]`; printable pitch at `/org/sponsors/pitch`.
- Files: `src/app/academy/[slug]/page.tsx` (select only `sponsorName, logoUrl` where `showPublicly && ACTIVE`),
  `src/app/org/sponsors/pitch/page.tsx`, logo upload action copying the `uploadAcademyPhoto` Blob pattern in `src/app/actions/photos.ts`.
- Permission: public read limited to those two columns; pitch page `sponsors.manage`.
- Audit: `SPONSORSHIP_VISIBILITY_CHANGED`.
- Tests: pure `publicSponsorView()` strips contact fields.
- Accept: no contact name/phone or amounts ever render on the public page; no student-level data on the pitch.

## 7. Feature flag

`sponsorship: flag("SPONSORSHIP", false)` → `NEXT_PUBLIC_FEATURE_SPONSORSHIP`. Gates the Sponsors tab, all sponsorship
actions (server-side check, not just hidden UI), the P&L tile, and the public strip. Default off.

## 8. Dependencies

- Vertical 1 (Academy operations): Payroll/Expense P&L (`src/app/actions/payroll.ts`), Branch model, team permissions,
  public academy page. S2 touches the P&L — coordinate with whoever owns payroll.
- Vertical 11 (Marketplace) also notes the commented-out `Brand`/`BrandSponsorship` blocks; brand-side sponsorship, if
  ever built, belongs there, not here.
- Marketplace/directory (`FEATURES.marketplace`): public strip should also appear on claimed directory listings later.
- Events/tournaments vertical: "event sponsor" is a natural v2 link (`Sponsorship.eventId`), not in v1.
- Vertical 13 (Corporate): a company can be both sponsor and corporate client; keep separate tables in v1, revisit merge.

## 9. Risks and open questions

- Is sponsorship income taxable revenue the academy wants in the same P&L, or a separate line only? (Assumed: separate tile, included in profit.)
- Should KIND sponsorships carry a value in P&L? Proposed: no — value shown on the deal, only cash receipts hit P&L.
- Public logos: who confirms the academy has the sponsor's permission? Proposed: checkbox on `showPublicly`.
- Do we ever want Triq-brokered brand deals (the archived Yonex/Decathlon idea)? That is a separate, platform-level vertical.
- Adding a permission key changes the team permissions UI list; confirm wording "Manage sponsors and sponsor income".
