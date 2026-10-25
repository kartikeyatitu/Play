# Vertical 12 — Wellness (light v1)

> Planning doc. Read-only audit of branch `feat/academy-os-branches` on 2026-10-25. Nothing here is built yet.
> "Verified" means the file was opened and the behaviour seen in code. It does not mean it was tested in production.
> **Light vertical:** deliberately minimal. Health data is sensitive: collect less, restrict access, never expose it publicly.

## 1. Goal

Help coaches keep children safe and train them appropriately. The v1 has two parts. First, the medical data the academy already holds becomes access-controlled and audited. Second, every injury gets a simple, trackable **return-to-play status** (Fit / Limited / Out until a date) that the coach sees on the roster. v1 does not collect new kinds of health data. It makes the existing data safer and adds one useful status.

## 2. Verified today

| Capability | Evidence | Status |
|---|---|---|
| Medical profile | `Student.medicalInfo` (a JSON **string**) and `Student.bloodGroup` in `prisma/schema.prisma`. `updateMedicalInfo` in `src/app/actions/medical.ts`. `src/components/org/MedicalForm.tsx` on `src/app/student/[id]/page.tsx` | working |
| Who can edit medical data | `updateMedicalInfo`: `requireAuth(['ADMIN','COACH','PARENT'])` plus `studentAccessWhere`. Any ADMIN-app user can edit any student in the org (no permission key). A COACH can edit only students in their own batches. A PARENT can edit only their own children | working. **No permission key, no audit log** |
| What is stored | `MedicalForm` sends `allergies`, `medicalConditions`, `emergencyContactName/Phone`, `doctorName/Phone`, `insurancePolicyNumber`, `consent`, `signature`, all serialised into `medicalInfo` | working. Collects more than safety requires (insurance number). Consent has no timestamp |
| Type mismatch | `MedicalInfoInput` in `medical.ts` declares `conditions`/`emergencyContact`, but the form and `parseMedicalInfo` (`src/lib/coach.ts`) use `medicalConditions`/`emergencyContactName` | partial (it works, but the type is misleading) |
| Coach medical views | `src/components/coach/MedicalCardModal.tsx` and `AthleteSpotlightModal.tsx`. `src/components/coach/CoachBatchRoster.tsx`. `src/app/coach/page.tsx` flags `severity === "alert"` students | working. Data is limited to the coach's own batches by the page query |
| Emergency SOS | `src/components/coach/EmergencySOS.tsx` (rendered in `src/app/coach/page.tsx`): `tel:112`/`tel:108`, a call-parent button, and it logs an `INJURY` incident | working |
| Incidents | `Incident` model (`type`, `severity`, `description`, `orgId`). `reportIncident` in `src/app/actions/incidents.ts` (COACH for own batch, ADMIN for in-org). `IncidentModal.tsx`. Listed on `/student/[id]`, which parents can see for their own child | partial. **No status, no follow-up, no return-to-play, no audit**. `reportIncident` throws instead of returning an error |
| Diet plan | `Student.dietPlanUrl`. `updateDietPlan` in `src/app/actions/gamification.ts` (ADMIN/COACH, `safeHttpUrl`). Parents see the link in `src/components/parent/GamificationWidget.tsx` | partial. **No UI calls `updateDietPlan`** (grep finds no caller outside the action) |
| Physio role | `STAFF_ROLES` includes `PHYSIO` in `src/lib/team.ts`, with default permissions `[]` | partial (a role with no powers) |
| Wellness check-ins (sleep, soreness, RPE, mood), load tracking | none found | missing |
| Health permission key | `PERMISSIONS` in `src/lib/team.ts` has no health or medical key | missing |

## 3. Gaps for a real v1

1. Any ADMIN-app member can read and write medical data without a dedicated permission, and changes are not audited.
2. Injuries are a one-off log entry. There is no way to say "out until 12 Nov" or "cleared", so coaches can unknowingly train an injured child.
3. Consent is a boolean inside a JSON blob with no time attached, and the form collects an insurance policy number that safety does not need.
4. Physio staff cannot be given access to exactly the health data and nothing else.

## 4. v1 scope

**In**
- A `health.view` / `health.manage` permission pair. Medical edits are audited. The audit log records **which fields changed, never the values**.
- Consent gets a server-side timestamp (`medicalConsentAt`). The insurance field is no longer collected for new entries (existing data is kept).
- Return-to-play on `Incident`: status `OPEN` → `RECOVERING` → `CLEARED`, an optional `returnDate`, and a short restriction note. The coach roster shows a badge: "Limited", or "Out until 12 Nov".
- Coaches can set the diet plan link through the existing `updateDietPlan` action.

**Out (explicitly)**
- Daily wellness or readiness surveys, RPE and load monitoring, wearables, mental-health screening, nutrition plans hosted in Triq, physio consultation booking, file uploads of medical documents, analytics on health data.
- Any public or shareable surface showing health data. Showing health data to other parents.
- Sending medical content over WhatsApp.

## 5. Data model

No new tables. Reuse `Incident` for injury status and `Student` for the consent timestamp.

```prisma
model Student {
  // ...existing fields unchanged...
  medicalConsentAt DateTime? // V12: set server-side when the parent/admin ticks consent
}

model Incident {
  // ...existing fields unchanged...
  status       String    @default("OPEN") // V12: OPEN | RECOVERING | CLEARED
  returnDate   DateTime?                  // V12: expected return-to-play (IST day)
  restriction  String?                    // V12: <= 200 chars, e.g. "No contact drills"
  resolvedAt   DateTime?
  resolvedById String?
  updatedAt    DateTime  @default(now()) @updatedAt
  @@index([orgId, status])
}
```

`prisma/sql/YYYY-MM-DD_v12_wellness.sql`:

```sql
-- Additive only. NOT APPLIED to production. Requires founder approval before running.
-- Apply BEFORE deploying code that selects the new columns.
ALTER TABLE "Student"  ADD COLUMN IF NOT EXISTS "medicalConsentAt" TIMESTAMP(3);
ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'OPEN';
ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "returnDate" TIMESTAMP(3);
ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "restriction" TEXT;
ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);
ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "resolvedById" TEXT;
ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "Incident_orgId_status_idx" ON "Incident"("orgId","status");
-- No new tables. RLS on "Incident"/"Student" could not be confirmed from prisma/sql/ in the repo;
-- "Student" is mentioned in docs/sprints/task-8-rls-verification.md. Ensure it is on:
ALTER TABLE "Incident" ENABLE ROW LEVEL SECURITY;
```

Note: existing incidents default to `OPEN`. Slice 2 treats `OPEN` incidents older than 30 days with no `returnDate` as historical (no roster badge), so old rows do not flag every child.

## 6. Build slices

**Slice 1: Health permission, audit, data minimisation**
- Objective: lock down what already exists, with no new data collected.
- Files: `src/lib/team.ts` adds `"health.view"` and `"health.manage"`. OWNER and MANAGER get them through `ALL_PERMISSIONS`, and the `PHYSIO` default becomes `["health.view","health.manage"]`. `src/lib/features.ts` adds `wellness`. New pure `src/lib/health.ts`: `medicalFieldsChanged(before, after)` returns key names only, `MEDICAL_FIELDS` is a whitelist of the form keys, and `stripMedicalForPublic()`. `medical.ts`: when the flag is on, ADMIN-app/STAFF users need `health.manage`. This uses `requireMember(["ADMIN","STAFF"])` + `hasPermission`, because `checkPermission` only accepts the ADMIN app role. Unknown keys are dropped (today `[extra: string]: unknown` lets anything through), `medicalConsentAt` is set when consent flips to true, and `MedicalInfoInput` is fixed to match the form keys. `MedicalForm.tsx` hides the insurance field when the flag is on.
- Tenancy: unchanged `studentAccessWhere`. Coaches keep access to their own batches for safety. Parents keep access to their own children.
- Audit: `MEDICAL_INFO_UPDATED` `{studentId, fields: ["allergies", ...]}`, with **no values**.
- Tests: `src/lib/__tests__/health.test.ts` covering the whitelist (unknown keys dropped), the changed-fields diff and the no-values guarantee.
- Acceptance: with the flag off, behaviour is the same apart from the audit row. With the flag on, a MANAGER whose `health.manage` was revoked gets "You don't have permission to do this".

**Slice 2: Return-to-play on incidents**
- Objective: coaches see who is unavailable or limited today, and staff can clear an injury.
- Files: schema + SQL above. `incidents.ts` adds `updateIncidentStatus(id, status, returnDate?, restriction?)` and makes `reportIncident` return `{success, error}` instead of throwing (callers in `EmergencySOS.tsx` / `IncidentModal.tsx` must be updated together). `src/lib/health.ts` gets `availabilityFor(incidents, today)` → `FIT | LIMITED | OUT`. `CoachBatchRoster.tsx` shows the badge. `/student/[id]` shows status and return date.
- Permission/tenancy: a COACH may update incidents only for students in their own batches (the same `where` as `reportIncident`). ADMIN/STAFF need `health.manage`. The incident is looked up by `{id, orgId: session.orgId}`.
- Audit: `INCIDENT_REPORTED`, `INCIDENT_STATUS_CHANGED` `{incidentId, from, to, returnDate}`.
- Tests: `availabilityFor` covering CLEARED, a past return date (fit), a future return date (out), RECOVERING (limited), and stale OPEN rows.
- Acceptance: a student with an open "out until tomorrow" incident shows **Out** on today's roster and **Fit** the next day, with no cron job.

**Slice 3 (optional, small): Diet plan link UI**
- Objective: give the unused `updateDietPlan` action a caller.
- Files: a small input in `AthleteSpotlightModal.tsx` behind the flag.
- Audit: `DIET_PLAN_UPDATED` `{studentId}`.
- Acceptance: the parent sees the link in `GamificationWidget`. Only http(s) links are accepted (already enforced by `safeHttpUrl`).

## 7. Feature flag

`FEATURES.wellness = flag("WELLNESS", false)`, i.e. `NEXT_PUBLIC_FEATURE_WELLNESS`. It gates the new permission enforcement on medical edits, the insurance field removal, return-to-play status and badges, and the diet-plan input. Default **off**. Audit logging (slice 1) can be left on regardless of the flag because it adds no UI. Founder to confirm.

## 8. Dependencies

- **Vertical 1 (Academy operations):** `OrgMembership`/`effectivePermissions` (new permission keys), batches and enrolments for coach scoping, the team UI for granting `health.*` to staff.
- **Vertical 7 (Communities):** health content must never be posted to boards. Out-of-play status is not shown to other parents.
- **Vertical 15 (Inclusive):** v15's optional "support needs" note should follow the same `health.view` rule if the founder treats it as health data.
- Academy deletion (`src/app/actions/delete.ts`) already deletes `incident`. No new tables are added.

## 9. Risks and open questions for the founder

1. **Who legally holds this data?** The academy is the data fiduciary and Triq is the processor (India's DPDP Act, 2023). Children's data needs verifiable parental consent. Is the existing tick-box plus typed signature enough for pilots? A legal review is recommended.
2. **Admin-entered medical data.** Today any admin can fill in a child's medical form. Should only parents be able to enter it, with staff read-only?
3. **Insurance number.** Can we stop collecting it? Existing values stay in `medicalInfo` unless you approve a cleanup script.
4. **Parents seeing incidents.** `/student/[id]` already shows incidents, including MISCONDUCT, to parents. Is that intended?
5. **Coach access** to the medical summary stays (it is needed for safety). Should coaches see doctor and emergency contacts, or only the alert summary?
6. **Encryption.** `medicalInfo` is plaintext. `src/lib/secret-box.ts` (AES-256-GCM) exists for Razorpay secrets. Should medical JSON be encrypted at rest in a later slice? That needs a backfill and makes search impossible.
