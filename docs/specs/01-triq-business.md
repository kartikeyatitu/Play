# Vertical 1 — TRIQ Business

> Source of truth: `docs/specs/SCOPE-11-VERTICALS.txt` §2 V1. Supersedes `docs/roadmap/verticals/01-academy-operations.md`
> (old V1), and absorbs old **V10 Rewards** (points, referrals, coupons → "growth tools") and the announcement/DM half of
> old **V7 Communities** (→ "parent and student communications"). Verified by reading code on
> `build/v-business-enterprise` (from `main` @ `5ab2358`), 2026-10-26. Nothing was run against a database.

## 1. Product purpose and target users

Operate a sports academy, club, gym or training business day to day: people, batches, attendance, trials, fees,
facilities, communications and reports — persisted, tenant-isolated, permissioned and audited.

| User | Typical org | Needs |
|---|---|---|
| Owner | academy / club / turf+academy (`Organization.businessType` ACADEMY/TURF/BOTH) | whole business, money, settings |
| Manager | same | daily operations without billing/settings |
| Coach | same | own batches, attendance, recaps |
| Staff (receptionist, accountant, groundsman, physio) | same | role-scoped tasks |
| Parent / adult student | member family | schedule, fees, messages, child progress |

## 2. User roles and permissions

App roles (`User.role`): ADMIN (owner/manager/staff on web), COACH, PARENT, SUPER_ADMIN (Triq ops).
Team roles + permissions live in `src/lib/team.ts` (`TEAM_ROLES`, `PERMISSIONS`, `defaultPermissions`,
per-person JSON overrides on `OrgMembership.permissions`). Checks: `requirePermission` / `checkPermission`
(`src/lib/membership.ts`) — only ADMIN app role passes; coach paths check batch ownership themselves.

| Permission | Owner | Manager | Coach | Receptionist | Accountant | Groundsman |
|---|---|---|---|---|---|---|
| students.manage | Y | Y | – | Y | – | – |
| batches.manage | Y | Y | – | – | – | – |
| attendance.mark | Y | Y | Y | – | – | – |
| fees.collect / fees.manage | Y | Y | – | collect | Y | – |
| leads.manage | Y | Y | – | Y | – | – |
| bookings.manage (facilities) | Y | Y | – | – | – | Y |
| team.manage, payroll.* | Y | Y | – | – | payroll | – |
| reports.view | Y | Y | – | – | Y | – |
| settings.manage | Y | – | – | – | – | – |
| community.moderate (new, from group-c) | Y | Y | – | – | – | – |

Business-report and calendar use `reports.view` / `batches.manage`; audit-log viewer and export use `settings.manage`.

## 3. Complete feature inventory

| # | Feature group | Main capabilities |
|---|---|---|
| F1 | Registration & onboarding | sign up, create workspace, first batch/student wizard |
| F2 | Profile & branding | name, logo, photos, brand colour, locale/currency/timezone, public page |
| F3 | Branches & locations | multiple centres, batch → branch |
| F4 | Staff, memberships, invitations, permissions | team list, roles, overrides, staff attendance, payroll |
| F5 | Student enrolment | create/import students, guardians, batch enrolment, transfer, waitlist |
| F6 | Coach management & assignment | coach per batch, verification, performance |
| F7 | Batches & scheduling | batch CRUD, schedule text, capacity, fee |
| F8 | Sessions & attendance | daily sessions, mark attendance, cancel, recap |
| F9 | Trials & conversion | public trial booking, status, convert to student, leads pipeline |
| F10 | Fees | fee plans, monthly generation, mark paid / reverse, payment method, receipts, UPI/Razorpay, outstanding |
| F11 | Facility allocation | courts/facilities, allocate batch to court time |
| F12 | Operational calendar | batches/sessions/trials/holidays/allocations per day/week |
| F13 | Parent & student communications | announcements (academy/batch), DMs, recaps, cancellation notices, WhatsApp |
| F14 | Dashboard & business reports | Today screen, revenue/outstanding/attendance/utilisation report, exports |
| F15 | Settings & audit history | academy settings, audit log viewer, CSV export, delete-all |
| F16 | Growth tools (ex-Rewards) | points ledger, referrals, coupons, kit store |

## 4. Screen and navigation specification

Admin shell `src/components/org/AdminClient.tsx` (tabs). Primary: Today, People, Fees, Bookings, More.
More → Run: Team, Payroll, Batches, Leads, Messages, Analytics, **Calendar** (new, `opsCalendar`), **Business report**
(new, `businessReport`); Grow: Gallery, Kit Store; Admin: Operations (facilities + **Facility allocation** new,
`facilityAllocation`), Settings (+ **Branches** card `branches`, **Audit log** `auditLogViewer`).
Coach app `/coach`, parent app `/parent`, public `/academy/[slug]`, `/trial`, `/join`.

| Screen | Route / component | Flag |
|---|---|---|
| Calendar (week view, prev/next, per-day list) | tab `calendar` → `src/components/org/OpsCalendar.tsx` | `opsCalendar` |
| Business report (month picker, KPI tiles, per-batch table, facility table) | tab `report` → `src/components/org/BusinessReport.tsx` | `businessReport` |
| Facility allocation (allocate form + upcoming allocations, cancel series) | Operations → `src/components/org/FacilityAllocation.tsx` | `facilityAllocation` |
| Branches | Settings → `src/components/org/BranchesCard.tsx`; batch dialog picker | `branches` |
| Audit log (filter by action/date, load more, CSV) | Settings → `src/components/org/AuditLogPanel.tsx` | `auditLogViewer` |

## 5. Field-level definitions and validation

| Entity.field | Rule |
|---|---|
| Branch.name | trimmed, whitespace collapsed, 2–80 chars, unique per org (`src/lib/branch-input.ts`); address ≤240; city ≤80; ≤50 branches/org |
| BatchBranch.batchId | unique (one branch per batch), both rows same org |
| Allocation weekdays | non-empty subset of Mon..Sun |
| Allocation startHour / hours | integer; `facility.openHour ≤ start`, `start+hours ≤ closeHour`; 1–6 h (`MAX_HOURS_PER_BOOKING`) |
| Allocation weeks | 1–26 (`MAX_LEASE_WEEKS`); start date ≥ today (IST) |
| Calendar range | `YYYY-MM-DD` start, 1–31 days |
| Report month | `YYYY-MM`, not in the future |
| Audit filter | action prefix ≤ 60 chars `[A-Z0-9_]`; date range ≤ 366 days; page size ≤ 200; export ≤ 5000 rows |
| Money | whole currency units (Int) on fees/turf; `FeeRecord.amount` is Float (legacy) — summed and rounded for display |

## 6. End-to-end user journeys

| Scope journey | Path today |
|---|---|
| 1 Register & configure | `/register` → `registerAcademy` / `createAcademyWorkspace` → `OnboardingWizard` → Settings |
| 2 Invite staff & permissions | Team tab → `addTeamMember`/`updateTeamMember` (`src/app/actions/team.ts`) |
| 3 Register student & enrol | People → `CreateStudentDialog` → `createStudent` (`users.ts`) |
| 4 Coach & schedule | `CreateBatchDialog` → `createBatch` (coach, schedule, branch*) ; allocate court* |
| 5 Attendance | coach `/coach` → `markBatchAttendance` (`attendance.ts`) |
| 6 Trial → enrolment | `/trial` → `bookTrial` → `TrialManager` → `updateTrialStatus` / `convertTrialToStudent` |
| 7 Fees & reconciliation | `generateMonthlyFeesForOrg`, `markFeeAsPaid`, `reverseFeePayment`, parent "I've paid" → `PendingPayments` confirm; receipts |
| 8 Review revenue/outstanding/attendance/utilisation | Business report* (`getBusinessReport`) |
| 9 Manage operations | Calendar*, Operations, Audit log* |

`*` = built in this branch behind a flag.

## 7. Business rules and state transitions

- Session: `SCHEDULED → COMPLETED | CANCELLED`; one per batch per IST day (`@@unique([batchId, date])`).
- Trial: `PENDING/SCHEDULED → ATTENDED | NO_SHOW → ENROLLED` (CAS on `ENROLLED` in `convertTrialToStudent`).
- Fee: `PENDING → PENDING_VERIFICATION → PAID`; `PAID → PENDING` only via `reverseFeePayment` with reason (audited).
- Fee resolution: `feeOverride → batch.monthlyFee → org.defaultMonthlyFee → 0` (`resolveStudentFee`, `src/lib/fees.ts`).
- Facility allocation = weekly `TurfBooking` rows, `source: "LEASE"`, `amount: 0`, `leaseGroupId: "batch:<batchId>:<uuid>"`,
  created through `reserveSlot` (advisory lock + overlap check + exclusion constraint), so a court can never be both
  allocated to a batch and sold to the public. Conflicting weeks are skipped and reported. Cancel = existing
  `CANCEL_SERIES` semantics (future CONFIRMED rows of that group → CANCELLED).
- Calendar planned occurrences come from `scheduleRunsOn(batch.schedule, weekday)`; recorded sessions override plans;
  holidays are shown, and planned occurrences on holidays are marked.
- Report metric definitions (in `src/lib/business-report.ts`):
  - *Collected* = Σ `FeeRecord.amount` with `status = PAID` and `month = M` (fee month, cash-basis by month billed).
  - *Billed* = Σ amount of all fee records for month M. *Outstanding (month)* = billed − collected.
  - *Outstanding (all time)* = Σ non-PAID fee records with month ≤ M.
  - *Collection rate* = collected / billed.
  - *Attendance rate* = present / marked attendance rows in non-cancelled sessions dated in M.
  - *Batch utilisation* = active enrolments / capacity (only batches with capacity).
  - *Facility utilisation* = booked hours (CONFIRMED/COMPLETED/NO_SHOW TurfBooking) / open hours (open→close × days) in M.
  - *Turf revenue* = Σ `advancePaid` on CONFIRMED/COMPLETED/NO_SHOW bookings starting in M (money actually received).
- Growth tools (ex-Rewards, not yet built): points must move to a ledger; referrals must carry `orgId` and convert on
  enrolment; coupons need per-org codes and a redemption path (see §16).

## 8. Database models and relationships

Existing: `Organization`, `User`, `OrgMembership`, `Student`, `Batch`, `BatchEnrollment`, `Session`, `Attendance`,
`TrialBooking`, `Lead`, `FeeRecord`, `Receipt`, `Payment`, `FeePlan`, `Coupon`, `Referral`, `Announcement`, `Message`,
`Facility`, `TurfBooking`, `Booking` (unused), `Holiday`, `AuditLog`, `StaffAttendance`, `StaffPayout`, `Expense`.

New (additive, flag `branches`, NOT applied):

```prisma
model Branch      { id, orgId, name, address?, city?, createdAt, updatedAt; @@unique([orgId,name]) }
model BatchBranch { batchId @id, orgId, branchId, createdAt; batch → Batch (cascade), branch → Branch (cascade) }
```

Why a join table instead of `Batch.branchId` (the original branch's design): Prisma selects every scalar column of
`Batch` on every batch query, so adding `Batch.branchId` to the schema would break all batch reads in production until
the SQL is applied — a flag cannot prevent that. `BatchBranch` is only queried when `FEATURES.branches` is on.
SQL: `prisma/sql/2026-10-25_branches.sql` (Branch table; the `Batch.branchId` column was removed from it) and
`prisma/sql/2026-10-26_batch_branches.sql`. Both tables are in the `deleteAllData` order (only when the flag is on).

Facility allocation and the calendar/report need **no** schema change.

## 9. API contracts (server actions)

| Action | File | Permission | Returns |
|---|---|---|---|
| `listBranches()` / `createBranch(fd)` / `updateBranch(id, fd)` / `deleteBranch(id)` | `src/app/actions/branches.ts` | batches.manage / settings.manage | `{success, branches?|error}`; disabled → `{success:false, error}` |
| `createBatch(fd)` / `updateBatchSettings(id, fd)` (`branchId` honoured only with flag) | `src/app/actions/batch.ts` | batches.manage | existing |
| `getOpsCalendar(startDate, days)` | `src/app/actions/ops-calendar.ts` | batches.manage | `{success, days: CalendarDay[]}` |
| `allocateBatchToFacility(input)` / `listBatchAllocations()` / `cancelBatchAllocation(groupId)` | `src/app/actions/facility-allocation.ts` | bookings.manage (+ batch in org) | `{success, created, conflicts[]}` |
| `getBusinessReport(month)` | `src/app/actions/business-report.ts` | reports.view | `{success, report}` |
| `listAuditLog(filter)` / `exportAuditLogCsv(filter)` | `src/app/actions/audit.ts` | settings.manage | rows+cursor / `{csv, filename, count}` |

## 10. Error and edge-case behaviour

- Flag off → actions return `{success:false, error:"… is not enabled"}` and UI is not mounted; no query touches new tables.
- Allocation: court inactive / outside hours / batch not in org → error; partial conflicts → created N, conflicts listed;
  all conflict → error "already booked". Advisory lock serialises concurrent allocations.
- Calendar: unparseable schedule → batch listed under "Unscheduled" (not invented on any day).
- Report: months without fee records → zeros with "no fee records" note, never estimates; capacity null → excluded.
- Audit export beyond cap → truncated with `truncated: true`; export itself audited (`AUDIT_LOG_EXPORTED`).

## 11. Security and privacy requirements

- Every query scoped by `session.orgId`; TrialBooking/Session scoped through `batch.orgId`.
- Minors: calendar shows trial child first name only; reports are aggregates; no medical data in any new screen.
- Audit details may contain names/phones → viewer/export owner-only (`settings.manage`); CSV cells escaped against
  formula injection (`=`, `+`, `-`, `@` prefixed with `'`).
- "use server" files export only async functions; pure logic in `src/lib/*`.

## 12. Dependencies on shared platform

Identity/permissions (`membership.ts`, `team.ts`), scheduling (`src/lib/fees.ts` IST helpers, `src/lib/turf.ts`),
booking engine (`src/lib/turf-engine.ts`), payments (`payment-service.ts`, `receipt-service.ts`), notifications
(`whatsapp.ts`), audit (`AuditLog`), flags (`src/lib/features.ts`).

## 13. Acceptance criteria

- Branches: flag off → production works with no Branch table; flag on (after SQL) → create/delete branch, pick branch
  for a batch, branch shown in calendar/report; deleting a branch unassigns batches.
- Calendar: a week view shows recorded sessions with status, planned occurrences from schedules, trials, holidays and
  court allocations for the caller's org only.
- Facility allocation: allocating a batch to a court for N weeks creates N LEASE bookings visible on the Bookings board;
  a public/online booking for the same slot is refused; cancel removes future rows.
- Report: numbers equal hand-computed sums of real rows for the month (unit-tested on fixtures).
- Audit: owner can filter, page and export CSV; non-owner gets a permission error; export is itself logged.

## 14. Tests

- Unit (Vitest, `src/lib/__tests__`): `branch-input`, `community`, `ops-calendar`, `facility-allocation`,
  `business-report`, `audit-csv`, `org-hierarchy`.
- Integration (to add, needs a test DB): allocation concurrency vs `reserveSlot`; report sums vs seeded rows.
- E2E (to add, Playwright): journeys 1–9 on a preview deployment with flags on.

## 15. Implementation status (verified 2026-10-26)

| Group | Status | Evidence |
|---|---|---|
| F1 Registration & onboarding | Complete | `src/app/actions/register-academy.ts`, `onboarding.ts`, `src/components/org/OnboardingWizard.tsx` |
| F2 Profile & branding | Complete | `AcademySettings.tsx`, `Organization.brandColor/photos/locale`, `src/app/academy` |
| F3 Branches | Partial (flagged `branches`, SQL not applied) | `src/app/actions/branches.ts`, `BranchesCard.tsx`, `BatchBranch` join (this branch) |
| F4 Staff & permissions | Complete | `src/app/actions/team.ts`, `TeamPanel.tsx`, `src/lib/team.ts`; invitations via login links `login-links.ts` |
| F5 Student enrolment | Partial | `users.ts createStudent`; single guardian (`Student.parentId`); known issue 4.A (non-atomic update) |
| F6 Coach assignment | Partial | `batch.ts validateBatchCoach`; known issue 4.D |
| F7 Batches & scheduling | Complete (free-text schedule) | `batch.ts`, `CreateBatchDialog.tsx`, `scheduleRunsOn` |
| F8 Sessions & attendance | Complete | `attendance.ts`, `auto-sessions.ts`, `coach-session.ts` |
| F9 Trials & conversion | Partial | `trial.ts` (4.F non-atomic), `trial-convert.ts` (CAS), `leads.ts` (4.C) |
| F10 Fees, receipts, outstanding | Complete | `fees.ts`, `auto-fees.ts`, `receipt-service.ts`, `PendingPayments.tsx`, `payment-method.ts` |
| F11 Facility allocation | Partial → built (flag `facilityAllocation`) | before: `bookFacility` in `facilities.ts` writes `Booking` but no UI and no conflict check (Broken/unused). Now: `facility-allocation.ts` via `reserveSlot` |
| F12 Operational calendar | Partial (flag `opsCalendar`) | `src/lib/ops-calendar.ts`, `src/app/actions/ops-calendar.ts`, `OpsCalendar.tsx` (academy sessions/plans/trials/holidays/allocations). Ownership moved to another builder for the unified academy + turf calendar; not extended here |
| F13 Communications | Partial | `announcements.ts` (now audited, group-c), `coach-session.ts`, `chat.ts`, `BroadcastTab.tsx`, `InboxTab.tsx`; WhatsApp = `wa.me` deep links; community rules `src/lib/community.ts` (flag `communities`, no UI yet) |
| F14 Dashboard & reports | Partial → report built (flag `businessReport`) | `src/lib/today.ts`, `AnalyticsDashboard.tsx`; AI Insights heuristic (flag `experimental`) |
| F15 Settings & audit | Partial → viewer built (flag `auditLogViewer`) | `getAuditLog` existed; `AuditLogViewer.tsx` was never mounted; now `AuditLogPanel.tsx` + CSV |
| F16 Growth tools (ex-Rewards) | Partial (flag `growthTools`) | Referrals: `src/lib/referral-rules.ts`, `src/lib/referral-server.ts` — validated, de-duplicated, org-scoped via referrer, audited, convert on enrolment (`createStudent`, `convertTrialToStudent`, `convertLeadToStudent`). No reward granted (no fee-credit model). Coupons: create/list audited but still not redeemable; `Coupon.code` still globally unique. Points: `points.ts` overwrite + `gamification.ts` unaudited +10 — unchanged (Broken), needs `PointTransaction` ledger. Parent widget and coupon UI were live and ungated; now behind the flag |

## 16. Release dependencies and unresolved decisions

- Apply `2026-10-25_branches.sql` + `2026-10-26_batch_branches.sql`, then set `NEXT_PUBLIC_FEATURE_BRANCHES=1`.
- Calendar, report, facility allocation, audit viewer and growth tools need no SQL — they can be enabled independently.
- Decisions: multi-guardian and cross-academy parents; Program above Batch; growth tools — points→fee credit?
  per-org coupon codes (not purely additive: `Coupon.code @unique`); should the ungated referral/coupon UI be put behind
  a `growthTools` flag now; WhatsApp Cloud API sender ownership.
- Next slices: `StudentGuardian`, points ledger (`PointTransaction`), referral `orgId` + conversion, structured batch
  schedule (weekday + time columns) to replace free text.
