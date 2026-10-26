# Vertical 11 — TRIQ Enterprise

> Source of truth: `docs/specs/SCOPE-11-VERTICALS.txt` §2 V11. Absorbs old **V13 Corporate sports**
> (`docs/roadmap/verticals/13-corporate-sports.md`) as the "institutional / corporate client" workflow.
> Verified by reading code on `build/v-business-enterprise`, 2026-10-26. Nothing was run against a database.

## 1. Product purpose and target users

Higher-level operations for multi-location operators, academy chains, federations, institutional networks and
corporate clients — without weakening tenant isolation.

| User | Needs |
|---|---|
| Chain / franchise owner | one view across several academies (orgs) they run; per-branch numbers inside one academy |
| Branch manager | operate only their branch |
| Federation / institutional admin | affiliate member orgs, run cross-org competitions (V3), receive consented reports |
| Corporate client contact (ex-V13) | company-paid leases, employee batches, monthly statements |
| Integration admin | API keys, webhooks, exports |

## 2. User roles and permissions

- Today: one person can hold ACTIVE `OrgMembership` rows in several orgs (`getMyAcademies`, `switchAcademy` in
  `src/app/actions/team.ts`). Each membership has its own role + permissions; there is no cross-org role.
- **Consolidated access rule (implemented, `src/lib/org-hierarchy.ts`)**: a person may see consolidated numbers for an
  org only if they hold an ACTIVE membership in that org whose effective permissions include `reports.view`.
  Consolidation never grants access that the person does not already have org by org. Every consolidated view writes
  an `ENTERPRISE_REPORT_VIEWED` audit row in **each** included org.
- **Branch scope (designed, rules implemented, table not yet created)**: a membership may be limited to a set of
  branches; empty set = whole org. Owners are never branch-scoped.
- **Org hierarchy (designed)**: `OrgGroup` (enterprise/federation) with `OrgGroupMember` links that require
  acceptance by the member org's owner (two-sided consent) before any data flows.
- New permissions (planned): `enterprise.manage` (hierarchy, scopes), `integrations.manage` (API keys/webhooks).

## 3. Complete feature inventory

| # | Feature group |
|---|---|
| E1 | Multi-branch & multi-location administration |
| E2 | Organisation hierarchy (group → member orgs → branches) |
| E3 | Consolidated reporting |
| E4 | Role and permission administration (incl. branch scope) |
| E5 | Federation & institutional workflows (affiliation, consented reporting) |
| E6 | Competition administration across eligible orgs (with V3 Play) |
| E7 | Audit trails |
| E8 | Data exports |
| E9 | API & webhook management |
| E10 | Integration configuration |
| E11 | Usage & subscription management (when defined) |
| E12 | Advanced operational analytics |
| E13 | Organisation-specific configuration |
| E14 | Enterprise support & administration (Triq ops `/ops`) |
| E15 | Corporate clients (ex-V13): company record, linked leases/batches, monthly statements |

## 4. Screen and navigation specification

| Screen | Where | Flag |
|---|---|---|
| Consolidated report: per-academy rows + totals (month), per-branch rows for the active academy | More → Run → **Enterprise** tab → `src/components/org/EnterpriseReport.tsx` | `enterprise` (branch rows also need `branches`) |
| Audit log viewer + CSV | Settings → `AuditLogPanel.tsx` (shared with V1) | `auditLogViewer` |
| Branches admin | Settings → `BranchesCard.tsx` | `branches` |
| (planned) Hierarchy admin, member invites, branch scopes per team member | Settings → Enterprise | `enterprise` |
| (planned) API keys / webhooks | Settings → Integrations | `integrations` |
| (planned) Corporate clients + statements | More → Grow → Corporate | `corporate` (existing flag, unread) |

## 5. Field-level definitions and validation

| Field | Rule |
|---|---|
| report month | `YYYY-MM`, not future |
| orgs included | ≤ 25 memberships per consolidated view (hard cap, oldest first) |
| OrgGroup.name (planned) | 2–80 chars, unique per owner |
| OrgGroupMember.status (planned) | INVITED → ACTIVE → LEFT; only member-org owner can accept/leave |
| MemberBranchScope (planned) | (membershipId, branchId) unique; branch.orgId = membership.orgId |
| API key (planned) | shown once, stored as SHA-256 hash + 8-char prefix; scopes from a fixed list |

## 6. End-to-end user journeys

| Scope journey | Status |
|---|---|
| 1 Enterprise org configured | Partial — an owner can create several academies and switch between them (existing) |
| 2 Establish hierarchy | Designed (`OrgGroup`), not built |
| 3 Branches & users associated | Branches built behind `branches`; user↔branch scope designed |
| 4 Local users operate within branch | Designed (rules in `org-hierarchy.ts`), not enforced in screens yet |
| 5 Leadership views consolidated reports | **Built** behind `enterprise` (`getConsolidatedReport`) |
| 6 Changes audited | Built: audit viewer/CSV; consolidated views audited per org |
| 7 External integrations | Missing |

## 7. Business rules and state transitions

- Consolidation = union of per-org reports computed by the same pure function as the V1 Business report
  (`src/lib/business-report.ts`); totals are plain sums of money and counts; rates are recomputed from summed
  numerators/denominators (never averaged percentages).
- Currency: orgs with different `Organization.currency` are **not** summed together; totals are grouped by currency.
- Branch breakdown: batches without a branch are reported as "Unassigned"; fee money is attributed to the branch of
  the student's batch (first enrolment); students in batches at two branches are attributed to the first by join date.
- Branch scope (rules): owner → all; scoped member → only listed branches; a scoped member never sees "Unassigned"
  or org totals.
- Hierarchy (planned): group owner sees a member org only while the link is ACTIVE *and* the member org shared
  `reports` with the group; leaving revokes immediately.

## 8. Database models and relationships

Built/used: `Organization`, `OrgMembership` (multi-org), `Branch` + `BatchBranch` (V1, flag `branches`), `AuditLog`.

Planned (draft — not in `schema.prisma`, no SQL yet; needs founder approval):

```prisma
model OrgGroup       { id, name, ownerUserId, kind /* CHAIN|FEDERATION|INSTITUTION */, createdAt }
model OrgGroupMember { id, groupId, orgId, status /* INVITED|ACTIVE|LEFT */, shares /* JSON: ["reports"] */,
                       invitedById, acceptedById?, createdAt, updatedAt; @@unique([groupId, orgId]) }
model MemberBranchScope { id, orgId, membershipId, branchId, createdAt; @@unique([membershipId, branchId]) }
model ApiKey         { id, orgId, prefix, hash, scopes, createdById, lastUsedAt?, revokedAt?, createdAt }
model WebhookEndpoint{ id, orgId, url, secretEnc, events, isActive, createdAt }
model CorporateClient / CorporateStatement  // see docs/roadmap/verticals/13-corporate-sports.md §5
```

All new tables must be separate tables (never new columns on `Organization`/`OrgMembership`/`Batch`, which Prisma
selects in full on hot paths), carry `orgId` where org-owned, and be added to `deleteAllData`.

## 9. API contracts

| Action | File | Auth | Returns |
|---|---|---|---|
| `getConsolidatedReport(month)` | `src/app/actions/enterprise.ts` | signed-in ADMIN; per-org `reports.view` | `{success, month, orgs: OrgReportRow[], totalsByCurrency, branches?: BranchRow[], skipped: number}` |
| `listAuditLog` / `exportAuditLogCsv` | `src/app/actions/audit.ts` | settings.manage | see V1 §9 |
| (planned) `createOrgGroup`, `inviteOrgToGroup`, `respondToGroupInvite`, `setMemberBranchScope`, `createApiKey`, `revokeApiKey` | `src/app/actions/enterprise.ts` | enterprise.manage / owner | — |

## 10. Error and edge-case behaviour

- Flag off → `{success:false, error:"Enterprise reporting is not enabled."}`; tab hidden.
- Membership without `reports.view` → org silently excluded, counted in `skipped` (no names leaked).
- Removed/INVITED memberships excluded. More than 25 orgs → first 25, `truncated: true`.
- `branches` off → no branch section, `Branch` table never queried.

## 11. Security and privacy requirements

- No cross-tenant query without a per-org permission check for that exact org; queries always `where: { orgId }`.
- Consolidated output is aggregate only (no student names, no minors' data, no health data).
- Each consolidated view audited in every included org (`ENTERPRISE_REPORT_VIEWED`, details: month, orgCount).
- Planned API keys: hashed at rest, scoped, revocable, rate-limited; webhook payloads signed (HMAC-SHA256) with retry
  + idempotency key; secrets encrypted with `src/lib/secret-box.ts`.

## 12. Dependencies on shared platform

Identity & membership (`src/lib/membership.ts`, `src/lib/team.ts`), V1 Business report (`src/lib/business-report.ts`),
branches (V1), audit log, flags, `secret-box.ts` (integrations), V3 Play (cross-org competitions), billing
(`Subscription`, `billing-service.ts`) for usage/subscription.

## 13. Acceptance criteria

- A person who owns academies A and B sees both in the Enterprise tab with correct sums; a person who is only a coach
  in B sees only A; audit rows written in both A and B.
- Different currencies are never summed.
- With `branches` on, the active academy shows per-branch rows whose sum equals the academy row.
- Flags off → no new UI, no new queries.

## 14. Tests

- Unit: `src/lib/__tests__/org-hierarchy.test.ts` (consolidatable orgs, branch scope, currency totals),
  `business-report.test.ts` (shared metric maths), `audit-csv.test.ts`.
- Integration (to add): consolidated report against two seeded orgs; tenant-isolation test that a non-member org is
  never queried.
- E2E (to add): owner of two academies opens Enterprise tab.

## 15. Implementation status (verified 2026-10-26)

| Group | Status | Evidence |
|---|---|---|
| E1 Multi-branch admin | Partial (flag `branches`, SQL pending) | `src/app/actions/branches.ts`, `BranchesCard.tsx` |
| E2 Org hierarchy | Partial — multi-org membership exists; group hierarchy designed only | `OrgMembership` (`prisma/schema.prisma`), `getMyAcademies`/`switchAcademy` (`team.ts`), `src/lib/org-hierarchy.ts` |
| E3 Consolidated reporting | Built (flag `enterprise`) | `src/app/actions/enterprise.ts`, `src/components/org/EnterpriseReport.tsx` |
| E4 Role/permission admin | Partial — per-org roles + overrides; no branch scope | `src/lib/team.ts`, `TeamPanel.tsx` |
| E5 Federation workflows | Missing | — |
| E6 Cross-org competitions | Missing (V3 owns competitions) | `TournamentBracket.tsx` is UI-only |
| E7 Audit trails | Partial → viewer built (flag `auditLogViewer`) | `AuditLog` model; many actions audit, some do not (e.g. `facilities.ts`, `gamification.ts`) |
| E8 Data exports | Partial | `export.ts exportAllStudentsCSV`, `ExportCSV.tsx`; audit CSV new |
| E9 API & webhooks | Missing (only inbound payment/WhatsApp webhooks) | `src/app/api/webhooks/*` |
| E10 Integration config | Partial — Razorpay per-org connect only | `razorpay-connect.ts`, `RazorpayConnect.tsx` |
| E11 Usage & subscription | Partial | `Subscription`, `BillingInvoice`, `billing-service.ts`; known issue 4.H |
| E12 Advanced analytics | Mocked | AI Insights heuristics behind `experimental` |
| E13 Org-specific config | Complete | locale/currency/timezone/brand on `Organization` |
| E14 Support & admin | Partial | `/ops` (SUPER_ADMIN leads inbox) |
| E15 Corporate clients | Missing | flag `corporate` defined, never read |

## 16. Release dependencies and unresolved decisions

- Consolidated report needs no SQL; branch rows need the V1 branch SQL.
- Decisions: may a chain owner see consolidated numbers for an academy where they are MANAGER (has `reports.view`)?
  (Implemented: yes, permission-based.) Federation consent model (two-sided acceptance proposed). Pricing tier for
  Enterprise. GST invoices vs statements for corporate clients. API key scopes list.
- Next slices: `MemberBranchScope` + enforcement in student/batch lists; `OrgGroup` invites; `ApiKey` + signed outbound
  webhooks; corporate clients (ex-V13 S1).
