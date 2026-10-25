# Vertical 14 — International opportunities (light v1)

Status: planning doc. Nothing opportunity-specific is built. Verified against branch `feat/academy-os-branches` on
2026-10-25 (read-only).

## 1. Goal

Give academies a simple, trustworthy way to put real outside opportunities in front of the right families: an overseas
training camp, a trial with a club abroad, an international junior tournament, a scholarship or exchange. Today coaches
forward these as WhatsApp images and lose track of who is interested. v1 is an academy-owned "Opportunities" board: the
academy posts an opportunity (with country, dates, deadline, cost in its own currency, official link), targets a batch or
the whole academy, parents tap "Interested" for a child, the academy shortlists, and can print a one-page athlete
profile (sports CV) for applications. Triq does not source, vet, sell or broker opportunities in v1.

## 2. Verified today

| Capability | Evidence | Status |
|---|---|---|
| Opportunity / scholarship / trial-abroad / scouting code | `grep -riE "scholarship\|abroad\|overseas\|scout"` over `src` and `docs` → no hits ("exchange" only in "Messages Exchanged", `src/components/org/ParentEngagement.tsx`) | missing |
| Per-org internationalisation | `Organization.country/currency/timezone/locale/phoneCountry` (`prisma/schema.prisma`, "Globalisation (additive)"); `formatMoney`, `formatDate`, `orgToday`, `waLink`, `normalizePhoneForOrg`, `COUNTRY_OPTIONS` (17 countries: IN, AE, US, GB, AU, SG, CA, SA, QA, KW, BH, OM, MY, NG, KE, ZA, GH) in `src/lib/i18n.ts`; React hooks in `src/lib/org-locale-context.tsx` | working (academy's own locale only) |
| Targeted parent broadcast | `Announcement` (`batchId` null = whole academy, `kind` GENERAL/RECAP/CANCELLATION); parent feed query in `src/app/parent/page.tsx` (~line 132) filters by child batches, `take: 8`; `broadcastAnnouncement` in `src/app/actions/announcements.ts` (`checkPermission("settings.manage")`) | working |
| Athlete performance data for a CV | `SkillReport` (`technique/fitness/discipline`, `metrics Json`, `notes`, per month); `Attendance`; `src/lib/sport-metrics.ts` exists | working (data), no CV view |
| Athlete profiles flag | `athleteOS: flag("ATHLETE_OS", false)` in `src/lib/features.ts`; `grep FEATURES.athleteOS` → not read anywhere | flag only |
| Public directory | `/academies/[city]/[sport]/[slug]` (`src/app/academies/...`), `ListedAcademy` model; `marketplace` flag defined but not read | working (domestic listings) |
| Sensitive child fields | `Student.medicalInfo`, `bloodGroup`, `dietPlanUrl`, `dob`; written by `src/app/actions/medical.ts` | must be excluded from any CV |

## 3. Gaps for a real v1

- No record of an opportunity (country, dates, deadline, cost, currency, link, age band).
- No per-child "interested / shortlisted / applied / selected" tracking.
- No parent-facing surface beyond announcements (which are text and capped at 8 in the feed).
- No exportable athlete profile; academies retype stats into application forms.
- Costs abroad are in a foreign currency; `formatMoney` formats in the org's currency only.

## 4. v1 scope

**In**
- Academy posts an opportunity: title, kind (CAMP / TRIAL / TOURNAMENT / SCHOLARSHIP / EXCHANGE / OTHER), sport, host
  country (ISO code), city, start/end date, apply-by date, age min/max, approx cost + currency, official URL,
  description, target batch (or whole academy), status (DRAFT / OPEN / CLOSED).
- Publishing creates one `Announcement` (`kind: "OPPORTUNITY"`) so parents see it with zero new notification plumbing.
- Parent "I'm interested" per child (with an explicit consent checkbox to share the child's sports profile with the academy
  for this application). Withdraw allowed.
- Admin list of interested children per opportunity; statuses INTERESTED → SHORTLISTED → APPLIED → SELECTED / NOT_SELECTED.
- Printable athlete profile: name, age (from `dob` if present), sport, batch, months trained, attendance %, latest
  `SkillReport` scores and coach note. Nothing medical, no contact details.

**Out (explicitly)**
- Triq-curated global opportunity feed, partner organisations posting, payments/deposits for trips, visa/travel
  logistics, agent/scout accounts, public listing of children, rankings, translations of the UI.

## 5. Data model

New: `Opportunity`, `OpportunityInterest`. Justification: `Event`+`RSVP` is a batch match with a date and GOING/NOT_GOING
(`batchId` required, owned by the Events vertical); opportunities need deadline, cost/currency, external link, age band and
an application pipeline. Reuse: `Announcement` for distribution, `Student`/`SkillReport`/`Attendance` for the profile.

```prisma
/// Vertical 14 (additive): an outside opportunity an academy shares with its families.
model Opportunity {
  id          String    @id @default(cuid())
  orgId       String
  title       String
  kind        String    @default("CAMP")  // CAMP | TRIAL | TOURNAMENT | SCHOLARSHIP | EXCHANGE | OTHER
  sport       String?
  country     String                      // ISO 3166-1 alpha-2 of the host country
  city        String?
  startDate   DateTime?
  endDate     DateTime?
  applyBy     DateTime?
  ageMin      Int?
  ageMax      Int?
  costAmount  Int?                        // whole units of costCurrency
  costCurrency String?                    // ISO 4217
  url         String?                     // official link, validated with src/lib/safe-url.ts
  description String?
  batchId     String?                     // null = whole academy
  status      String    @default("DRAFT") // DRAFT | OPEN | CLOSED
  announcementId String?
  createdById String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  interests   OpportunityInterest[]
  @@index([orgId, status])
}

model OpportunityInterest {
  id            String   @id @default(cuid())
  orgId         String
  opportunityId String
  studentId     String
  parentId      String
  status        String   @default("INTERESTED") // INTERESTED | SHORTLISTED | APPLIED | SELECTED | NOT_SELECTED | WITHDRAWN
  profileConsent Boolean @default(false)
  note          String?  // admin-only note
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  opportunity   Opportunity @relation(fields: [opportunityId], references: [id], onDelete: Cascade)
  @@unique([opportunityId, studentId])
  @@index([orgId, status])
}
```

`prisma/sql/2026-10-26_opportunities.sql` (proposed; NOT applied without founder approval):

```sql
-- Additive only. NOT APPLIED. Requires founder approval.
CREATE TABLE IF NOT EXISTS "Opportunity" (
  "id" TEXT PRIMARY KEY, "orgId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL, "kind" TEXT NOT NULL DEFAULT 'CAMP', "sport" TEXT, "country" TEXT NOT NULL, "city" TEXT,
  "startDate" TIMESTAMP(3), "endDate" TIMESTAMP(3), "applyBy" TIMESTAMP(3), "ageMin" INTEGER, "ageMax" INTEGER,
  "costAmount" INTEGER, "costCurrency" TEXT, "url" TEXT, "description" TEXT,
  "batchId" TEXT REFERENCES "Batch"("id") ON DELETE SET NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT', "announcementId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX IF NOT EXISTS "Opportunity_orgId_status_idx" ON "Opportunity"("orgId", "status");
ALTER TABLE "Opportunity" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "OpportunityInterest" (
  "id" TEXT PRIMARY KEY, "orgId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "opportunityId" TEXT NOT NULL REFERENCES "Opportunity"("id") ON DELETE CASCADE,
  "studentId" TEXT NOT NULL REFERENCES "Student"("id") ON DELETE CASCADE,
  "parentId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'INTERESTED', "profileConsent" BOOLEAN NOT NULL DEFAULT false, "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS "OpportunityInterest_opp_student_key" ON "OpportunityInterest"("opportunityId", "studentId");
CREATE INDEX IF NOT EXISTS "OpportunityInterest_orgId_status_idx" ON "OpportunityInterest"("orgId", "status");
ALTER TABLE "OpportunityInterest" ENABLE ROW LEVEL SECURITY;
```

## 6. Build slices

**S1 — Opportunities board (admin)**
- Objective: More → "Opportunities": create/edit/open/close; publishing posts an `Announcement` (`kind: "OPPORTUNITY"`,
  `batchId` = target).
- Files: `src/lib/opportunities.ts` (`OPPORTUNITY_KINDS`, statuses, pure `parseOpportunityInput`,
  `formatCost(amount, currency, locale)` via `Intl.NumberFormat`, `isEligibleAge(dob, min, max, on)`),
  `src/lib/__tests__/opportunities.test.ts`, `src/app/actions/opportunities.ts` ("use server"),
  `src/components/org/OpportunitiesPanel.tsx`, tab in `AdminClient.tsx` behind `FEATURES.opportunities`.
- Permission/tenancy: reuse `"leads.manage"` (admissions-style work) or add `"opportunities.manage"` (open question);
  `batchId` must satisfy `db.batch.findFirst({ id, orgId })`; `url` must pass `safeHttpUrl` from `src/lib/safe-url.ts`.
- Audit: `OPPORTUNITY_CREATED`, `OPPORTUNITY_UPDATED`, `OPPORTUNITY_PUBLISHED`, `OPPORTUNITY_CLOSED`.
- Tests: parsing (country in ISO list, applyBy ≤ startDate, ageMin ≤ ageMax, http(s) only), cost formatting, age check.
- Accept: published opportunity appears in parent feed only for the targeted batch; flag off → no tab, actions refuse.

**S2 — Parent interest + admin shortlist**
- Objective: parent sees open opportunities for their children's batches and taps Interested (with consent checkbox);
  admin moves statuses.
- Files: `src/app/actions/opportunities.ts` (`listOpportunitiesForParent`, `expressInterest`, `withdrawInterest`,
  `setInterestStatus`), small card in `src/components/parent/` (rendered only when flag on), `src/app/parent/page.tsx`.
- Permission/tenancy: parent path `requireAuth(["PARENT"])` + `student.parentId === session.id` +
  `student.orgId === opportunity.orgId` + child enrolled in target batch (or batch null). Admin path as S1.
- Audit: `OPPORTUNITY_INTEREST_ADDED`, `_WITHDRAWN`, `_STATUS_CHANGED`.
- Tests: pure `canExpressInterest(opportunity, child, today)` (status OPEN, before applyBy, age band, batch match).
- Accept: parent cannot register a child of another parent or another academy; duplicate tap is idempotent.

**S3 — Printable athlete profile**
- Objective: `/org/opportunities/[id]/profile/[studentId]` printable page, only if `profileConsent` is true.
- Files: reuse the profile view model `src/lib/athlete-profile.ts` that Vertical 2 (Athlete profiles, S1) plans; if V2
  has not landed, create it here as a pure allow-listed builder that V2 then extends (one module, not two). Page
  component reuses V2's printable card layout (V2 S5) when available. Test file for the allow-list.
- Permission: same as S1 + interest row exists with consent, same org.
- Audit: `ATHLETE_PROFILE_VIEWED` (who, which student).
- Tests: output never contains `medicalInfo`, `bloodGroup`, `dietPlanUrl`, phone or email keys.
- Accept: without consent → 404-style "not available".

## 7. Feature flag

`opportunities: flag("OPPORTUNITIES", false)` → `NEXT_PUBLIC_FEATURE_OPPORTUNITIES`. Gates admin tab, parent card,
profile page and all actions server-side. Default off.

## 8. Dependencies

- Vertical 1 (Academy operations): batches/enrollments for targeting, `Announcement` delivery, parent app, `SkillReport`
  and attendance (data quality of the profile depends on coaches filling monthly reports).
- Vertical 2 Athlete profiles (`athleteOS` flag, unused today): its planned `src/lib/athlete-profile.ts` view model and
  S5 printable card (`docs/roadmap/verticals/02-athlete-profiles.md`) are what S3 should reuse. Coordinate ordering:
  ideally V2 S1 lands first; the opportunity profile is then a consent-gated view of the V2 card.
- Events/tournaments vertical: domestic tournaments stay there; this vertical is for outside, mostly overseas, offers.
- Vertical 16 (AI): could later draft opportunity descriptions; not needed for v1.

## 9. Risks and open questions

- Liability: academies sharing paid overseas trips could expose families to bad operators. Add a visible "Shared by
  <academy>; Triq does not verify this opportunity" line? (Recommended.)
- Child safety: no public listing of children, profile only with per-opportunity parent consent. Confirm this is enough.
- Should Triq ever curate a cross-academy feed (via `src/app/ops`, SUPER_ADMIN)? That is v2 and changes the trust model.
- New permission key vs reuse `leads.manage`?
- Announcement feed shows only 8 latest; is an opportunity card in the parent app needed in S1 or can it wait for S2?
