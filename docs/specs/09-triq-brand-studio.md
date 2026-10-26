# Vertical 9 — TRIQ Brand Studio (spec)

Status date: 2026-10-26. Branch audited: `main` @ 5ab2358. Folds in old plans `docs/roadmap/verticals/09-sponsorship.md` and the scholarship/concession part of `15-inclusive-participation.md`.
"Verified" = file opened and behaviour read in code. No production testing was done.

## 1. Product purpose and target users

Connect brands, sponsors, athletes, academies, events and social-impact programs with a traceable workflow: sponsor profile → campaign with objectives, budget and deliverables → proposals → reviewed decision → agreed deliverables and milestones → recorded completion. Includes scholarship / CSR programs whose fee concessions are actually applied by monthly fee generation.

| User | Need |
|---|---|
| Academy owner | Track sponsors, run sponsorship campaigns and scholarship programs, approve money commitments |
| Manager / sponsorship lead | Create campaigns, review proposals, track deliverables |
| Coach / staff | Submit a proposal on behalf of an athlete, team or event |
| Accountant | Grant fee concessions under an approved program |
| Later: external brands, athletes, organizers | Cross-org discovery and self-serve proposals |

## 2. User roles and permissions

| Action | Permission | Default holders |
|---|---|---|
| Sponsor profiles, campaigns (draft/open/close), review proposals (under review / reject), deliverables | `sponsorship.manage` | OWNER, MANAGER |
| **Accept a proposal with an amount, activate a scholarship program budget** (financial commitments) | `funding.approve` | OWNER only by default; may be granted to a person by override |
| Submit a proposal to an OPEN campaign | any active member (ADMIN/COACH/STAFF app) | |
| Grant / revoke fee concession | `fees.manage` | OWNER, MANAGER, ACCOUNTANT |

## 3. Complete feature inventory

| Group (scope §2 V9) | v1 (this release) | Later |
|---|---|---|
| Brand and sponsor profiles | Org-scoped `SponsorProfile` (kind, contact, website, about, archive) | Brand-side accounts, verification |
| Sponsorship opportunity listings | `SponsorshipCampaign` per org, status OPEN = listed to members | Cross-org public listings |
| Athlete / team sponsorship | Campaign scope ATHLETE / TEAM; proposal may link an in-org student (staff only, never public) | Guardian consent flow for minors' deals |
| Academy / event sponsorship | Scope ACADEMY / EVENT | Link to Play competitions |
| Objectives and target audiences | Campaign `objective`, `targetAudience` | |
| Budgets and deliverables | `budgetPaise`, `committedPaise` (atomic), deliverables summary | Multi-currency |
| Proposal submission and review | SUBMITTED → UNDER_REVIEW → ACCEPTED / REJECTED, WITHDRAWN; status history | Attachments |
| Scholarship and CSR programs | `ScholarshipProgram` (approval-gated budget) + `FeeConcession` (full or partial) applied by fee generation | Applications from families |
| Campaign milestones / deliverable tracking | `SponsorshipDeliverable` kind DELIVERABLE / MILESTONE, due date, evidence URL, verified-by | Reminders |
| Performance reporting | Counts from real rows only (deliverables done/total, committed vs budget, concessions foregone per month) | Sponsor-facing reports |
| Agreement and approval workflows | Explicit `funding.approve` + typed-amount confirmation; every change audited | E-signature, contracts |

## 4. Screen and navigation specification

Admin app → More → Grow → **Brand Studio** tab (`src/components/org/BrandStudioPanel.tsx`), visible when `FEATURES.sponsorship || FEATURES.inclusive`.
- **Sponsors** (sponsorship): list + add/edit/archive form.
- **Campaigns** (sponsorship): list with status, budget, committed; open a campaign → details, status buttons, proposals list (submit form, review buttons, accept dialog requiring re-typed amount), and per accepted proposal a deliverables checklist (add, move status, evidence link) plus a status-history timeline.
- **Scholarships** (inclusive): programs (create, approve/activate, close) and concessions (student picker, program, % off or ₹ off or full waiver, start/end month, private reason; revoke). Shows "foregone this month" from real concessions.

## 5. Field-level definitions and validation

| Entity.field | Rule |
|---|---|
| SponsorProfile.name | 1–120 chars; kind ∈ BRAND, LOCAL_BUSINESS, CSR_FOUNDATION, INDIVIDUAL, OTHER; email valid if given; website http(s) only; about ≤ 1000 |
| Campaign.title | 1–120; scope ∈ ATHLETE, TEAM, ACADEMY, EVENT; objective 1–1000; targetAudience ≤ 300; budget integer ₹ 0–1,00,00,000 (stored paise); endDate ≥ startDate |
| Proposal | applicantType ∈ ATHLETE, TEAM, ACADEMY, EVENT, ORGANIZER; applicantName 1–120; pitch 1–2000; ask ₹ ≥ 0 and ≤ budget |
| Accept | approvedAmount ₹ ≥ 0, ≤ remaining budget (budget − committed), confirmAmount must equal approvedAmount |
| Deliverable | title 1–200; kind ∈ DELIVERABLE, MILESTONE; due date optional; evidenceUrl http(s) only |
| ScholarshipProgram | name 1–120; kind ∈ SCHOLARSHIP, CSR, HARDSHIP, OTHER; budget ₹/month optional ≥ 0 |
| FeeConcession | category ∈ SCHOLARSHIP, CSR, SIBLING, HARDSHIP, MERIT, STAFF_CHILD, OTHER; exactly one of percentOff (1–100) / amountOff (> 0); startMonth `YYYY-MM`; endMonth ≥ startMonth or null; reason ≤ 300 (staff-only) |

## 6. End-to-end user journeys

1. Owner adds sponsor "City Sports Store" → `SPONSOR_PROFILE_CREATED`.
2. Manager creates campaign "U-14 jersey partner", scope TEAM, budget ₹50,000, objective/audience → DRAFT → OPEN.
3. Coach submits proposal "U-14 Football team", ask ₹30,000 → SUBMITTED.
4. Manager moves it to UNDER_REVIEW; owner (funding.approve) accepts with ₹30,000, re-typing the amount → `committedPaise` += 3,000,000 atomically; ACCEPTED; audit `SPONSORSHIP_PROPOSAL_ACCEPTED`.
5. Deliverables added (logo on jersey — due 1 Dec; milestone "season kickoff photo") → tracked to DELIVERED → VERIFIED with evidence link.
6. Campaign marked COMPLETED; report shows deliverables 2/2 verified, ₹30,000 committed of ₹50,000.
7. Scholarship: owner creates program "CSR girls' football", approves it (funding.approve) → ACTIVE; accountant grants 100% concession for a student from 2026-11; next monthly generation creates no fee record for that student; 50% concession on ₹2,000 → ₹1,000.

## 7. Business rules and state transitions

- Campaign: DRAFT → OPEN → CLOSED → COMPLETED; DRAFT/OPEN/CLOSED → CANCELLED. Proposals only accepted on OPEN or CLOSED campaigns; submissions only on OPEN.
- Proposal: SUBMITTED → UNDER_REVIEW | WITHDRAWN | REJECTED; UNDER_REVIEW → ACCEPTED | REJECTED | WITHDRAWN. Terminal: ACCEPTED, REJECTED, WITHDRAWN.
- Deliverable: PENDING → IN_PROGRESS | DELIVERED | MISSED; IN_PROGRESS → DELIVERED | MISSED; DELIVERED → VERIFIED | IN_PROGRESS (rework); MISSED → IN_PROGRESS.
- Program: DRAFT → ACTIVE (requires `funding.approve`, records approvedById/At) → CLOSED. Concessions under a program require it ACTIVE.
- Financial commitment: only on accept, only with `funding.approve`, only if `approved ≤ budget − committed`, enforced by one conditional SQL update (no over-commit under concurrency). No money moves in TRIQ; this records an authorised commitment.
- Concession application (`src/lib/concessions.ts`): latest non-revoked concession covering the month wins; percent → `round(base × (100 − p) / 100)`; fixed → `max(0, base − amount)`; result 0 → generators skip (existing `<= 0` path). Granting never edits existing `FeeRecord` rows. Applied only when `FEATURES.inclusive`.
- Every status change writes a `SponsorshipStatusEvent` and an audit row. Status changes use compare-and-set on the previous status.

## 8. Database models and relationships

New, additive, all with `orgId` (`prisma/sql/2026-10-26_brand_studio.sql`). Archived `Brand`/`BrandSponsorship` comment blocks have no `orgId` and are not revived.
- `SponsorProfile` (org 1:N)
- `SponsorshipCampaign` (org 1:N, sponsor 0..1:N)
- `SponsorshipProposal` (campaign 1:N; optional `studentId` without FK exposure on any public page)
- `SponsorshipDeliverable` (proposal 1:N)
- `SponsorshipStatusEvent` (polymorphic history: entityType + entityId)
- `ScholarshipProgram` (org 1:N, sponsor 0..1:N)
- `FeeConcession` (student 1:N, program 0..1:N)
All added to the deletion order in `src/app/actions/delete.ts` (only when their flag is on, since the tables may not exist yet).

## 9. API contracts (server actions)

`src/app/actions/brand-studio.ts`: `listBrandStudio()`, `saveSponsorProfile(input)`, `setSponsorArchived(id, archived)`, `saveCampaign(input)`, `setCampaignStatus(id, to, note?)`, `submitProposal(input)`, `setProposalStatus(id, to, note?)`, `acceptProposal(id, approvedAmount, confirmAmount, note?)`, `addDeliverable(input)`, `setDeliverableStatus(id, to, {evidenceUrl?, note?})`, `getStatusHistory(entityType, entityId)`.
`src/app/actions/concessions.ts`: `listScholarships()`, `saveScholarshipProgram(input)`, `setProgramStatus(id, to)`, `grantConcession(input)`, `revokeConcession(id)`.
All return `{success, error?, ...}`; all re-check their flag server-side.

## 10. Error and edge-case behavior

- Accept over remaining budget / concurrent accepts → second gets "Budget exceeded"; nothing written.
- Confirm amount mismatch → "Amounts do not match"; nothing written.
- Stale status (changed by someone else) → "Status changed; refresh".
- Concession for a student of another org → "Student not found".
- Overlapping concessions → latest created wins (documented; UI warns).
- Flag off → tab hidden; actions return "not enabled"; fee generation identical to today.

## 11. Security and privacy requirements

- orgId always from session; every lookup `findFirst({id, orgId})`.
- Concession reason and student links are staff-only; never public, never in audit details (audit stores ids/amounts only).
- No minors' sponsorship data on public pages; proposal `studentId` visible to org staff only.
- Financial commitments require `funding.approve` and explicit confirmation; audited with actor and amount.

## 12. Dependencies on shared platform capabilities

Identity/permissions, audit log, feature flags, Students (V1), monthly fee generation (`src/app/actions/auto-fees.ts`, `generateMonthlyFeesForOrg` in `src/app/actions/fees.ts`, cron `src/app/api/cron/monthly-fees/route.ts`). Later: notifications, uploads (logos), Play (event sponsorship), Creators (collaboration offers), Athlete (opportunity discovery).

## 13. Acceptance criteria

- Flags off: no Brand Studio tab, actions refuse, fee generation byte-identical.
- A manager without `funding.approve` cannot accept a proposal or activate a program.
- Committed amount never exceeds budget, including concurrent accepts.
- Every campaign/proposal/deliverable/program status change has a history row and audit row.
- 100% concession → no fee record next run; 50% of ₹2,000 → ₹1,000; revoked concession ignored.

## 14. Unit, integration and end-to-end tests

- Unit: `src/lib/__tests__/brand-studio.test.ts` (transition matrices, budget/commit checks, input validation, deliverable progress), `src/lib/__tests__/concessions.test.ts` (window edges, revoked, latest wins, 100% → 0, fixed > fee → 0, invalid inputs).
- Integration (needs DB): concurrent accept; generator with concessions.
- E2E (later): campaign → proposal → accept → deliverables.

## 15. Implementation status against the existing repository

| Feature group | Status | Evidence |
|---|---|---|
| Sponsor / brand profiles | Missing (before) | only commented `Brand` block, `prisma/schema.prisma` ~L442; no `sponsor` hits in `src/` |
| Campaigns, proposals, deliverables, approvals | Missing (before) | commented `BrandSponsorship` (no `orgId`) |
| Scholarship / CSR / concessions | Missing (before) | `Student.feeOverride` read by `resolveFeeAmount` (`src/lib/fees.ts`) but never written; 0 = "not set" so a full waiver is impossible |
| Coupons | Mocked (UI only) | `src/app/actions/coupons.ts` creates coupons, nothing redeems them |
| Performance reporting | Missing | — |
| **This branch** | v1 behind `sponsorship` / `inclusive` | `src/lib/brand-studio.ts`, `src/lib/concessions.ts`, `src/app/actions/brand-studio.ts`, `src/app/actions/concessions.ts`, `src/components/org/BrandStudioPanel.tsx`, fee generators, `prisma/sql/2026-10-26_brand_studio.sql` |

Also found (V1 Business, not fixed here): `generateMonthlyFeesForOrg(orgId, month)` is exported from a `"use server"` file without any auth check, so it is callable as a server action for any orgId.

## 16. Release dependencies and unresolved decisions

- Apply `prisma/sql/2026-10-26_brand_studio.sql` before enabling `NEXT_PUBLIC_FEATURE_SPONSORSHIP` or `NEXT_PUBLIC_FEATURE_INCLUSIVE`.
- `inclusive` changes billing: enable per pilot only.
- Open: cross-org discovery (athletes/organizers in other orgs finding campaigns) — needs public visibility rules and guardian consent for minors.
- Open: sponsor income in the Payroll P&L (old plan S2) — not built; commitments are not receipts.
- Open: current-month PENDING fee records are not reduced when a concession is granted mid-month.
- Open: participation profile / inclusion report (old V15 slice 2) — not built.
