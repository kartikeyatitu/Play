# 06 — TRIQ Wellness

Status date: 2026-10-26. Branch `build/v-careers-wellness-creators`. Scope: `docs/specs/SCOPE-11-VERTICALS.txt` §Vertical 6. Prior plan reused: `docs/roadmap/verticals/12-wellness.md`.
Flag: `wellness` (`NEXT_PUBLIC_FEATURE_WELLNESS`, default off). No clinical decision-making AI. Health data never on public pages or general dashboards.

## 1. Product purpose and target users
Protect the health data academies already hold, and connect athletes, parents and academies to physiotherapy, sports nutrition, recovery and sports psychology providers through a recorded appointment workflow.
Users: parents/athletes/academy staff (requesters), wellness providers (any signed-in user who creates a provider profile; academy PHYSIO staff), academy OWNER/MANAGER (medical data custodians), Triq ops (credential verifier).

## 2. Roles and permissions
| Actor | Check | Can |
|---|---|---|
| OWNER/MANAGER | `health.view` / `health.manage` (new keys, default on via `ALL_PERMISSIONS`; revocable per person) | view / edit student medical data in own org when flag on |
| STAFF PHYSIO | defaults now `health.view`, `health.manage` | (no staff medical screen yet) |
| COACH | own batches only (existing `studentAccessWhere`) | safety view and edit, unchanged |
| PARENT | own children only | edit own child's medical form |
| Provider | owner of `WellnessProvider` row | edit own profile, confirm/decline/complete/cancel own appointments |
| Requester | signed-in user | request, cancel own appointments |
| Verifier | `SUPER_ADMIN` | set provider credential REVIEWED/VERIFIED/REJECTED |

## 3. Feature inventory
| Scope group | v1 |
|---|---|
| Provider profiles | category, services, bio, city, registration body (number never shown publicly), listed opt-in, accepting requests |
| Physio / nutrition / recovery / psychology | `category` enum: PHYSIOTHERAPY, NUTRITION, RECOVERY, PSYCHOLOGY |
| Service discovery | `/wellness`, signed-in, listed providers, filter by category and city |
| Availability and appointments | request with preferred time; provider confirms or declines |
| Credentials and verification | shared `src/lib/credentials.ts` states, Triq ops verifies |
| Booking history | requester and provider lists with timestamps |
| Consent and access controls | `health.*` permissions, field whitelist, audit of field names |
| Cancellation and rescheduling | cancel by either party (REQUESTED/CONFIRMED); rescheduling = cancel + new request in v1 |
| Payment workflow | later (no simulated payments) |

## 4. Screens
| Route | Who | Content |
|---|---|---|
| `/wellness` | signed-in | provider discovery + my appointment requests |
| `/wellness/p/[providerId]` | signed-in | provider detail (no registration number), request form |
| `/wellness/provider` | signed-in | my provider profile editor + incoming appointments with actions |
| `/ops/credentials` | SUPER_ADMIN | provider credential queue (shared with Careers) |
| `/student/[id]` (existing) | ADMIN needs `health.view` (flag on) to see medical block and form | — |

## 5. Fields and validation (`src/lib/health.ts`, `src/lib/wellness.ts`)
- Medical whitelist `MEDICAL_FIELDS`: allergies, medicalConditions, emergencyContactName, emergencyContactPhone, doctorName, doctorPhone, insurancePolicyNumber, consent, signature (strings ≤500, consent boolean). Unknown keys dropped when flag on.
- Provider: displayName 2–80, category enum, services ≤500, bio ≤2000, city ≤80, registrationBody ≤120, registrationNumber ≤60.
- Appointment: preferredAt future datetime within 180 days, note ≤500 (optional, visible to provider and requester only), cancelReason ≤300.

## 6. Journeys
1. Provider opens `/wellness/provider`, saves profile (credential SUBMITTED), ticks "listed".
2. Requester finds provider on `/wellness`, requests a slot with optional note.
3. Provider confirms or declines; after the session marks complete; either side may cancel before completion.
4. Each transition stamps a timestamp and writes an audit row (no note text in audit).
5. OWNER without `health.view` (flag on) sees no medical block on `/student/[id]` and export omits medical columns.

## 7. Business rules — appointment state machine (`transitionAppointment`)
| From | Action | Actor | To |
|---|---|---|---|
| REQUESTED | CONFIRM | provider | CONFIRMED |
| REQUESTED | DECLINE | provider | DECLINED |
| REQUESTED, CONFIRMED | CANCEL | provider or requester | CANCELLED |
| CONFIRMED | COMPLETE | provider, only at/after `preferredAt` | COMPLETED |
DECLINED, CANCELLED, COMPLETED are terminal. A provider cannot request with themselves. A provider with `acceptingRequests=false` or not listed cannot receive new requests.

## 8. Database (additive, `prisma/sql/2026-10-26_wellness.sql`)
`WellnessProvider`(userId unique, credentialStatus + reviewer/verifier fields), `WellnessAppointment`(providerId, providerUserId, requesterId, status, timestamps). Both are user-owned (not org-scoped), so no `orgId`; nothing added to `delete.ts`. Student medical data stays in `Student.medicalInfo` (no schema change).

## 9. API (`src/app/actions/wellness.ts`, `src/app/actions/medical.ts`)
`saveProviderProfile`, `requestAppointment`, `actOnAppointment(formData: id, action, reason?)` — all re-check `FEATURES.wellness`. `updateMedicalInfo(studentId, data)` unchanged signature; adds permission check and whitelist when flag on, audit always. Ops: `reviewProviderCredential` in `src/app/ops/credentials/actions.ts`.

## 10. Errors and edge cases
Invalid transition → error, no write. Concurrent transitions: update uses `where: {id, status: from}` (compare-and-set) so a second writer gets "Appointment changed, refresh". Past preferredAt rejected on request. Flag off → pages 404, actions no-op.

## 11. Security and privacy
- Audit `MEDICAL_INFO_UPDATED` stores `{studentId, fields: [names]}` — never values (`medicalAuditDetails`, unit-tested).
- Appointment notes never in audit, never on discovery pages, only to the two parties.
- Provider registration number never rendered outside the owner's editor and ops queue.
- No health data on `/c/*`, `/academy/*`, `/creators/*`, org dashboards; export medical columns require `health.view` when flag on.
- No clinical AI, no diagnosis fields.

## 12. Shared platform dependencies
Permissions (`src/lib/team.ts`), membership (`src/lib/membership.ts`), verification states (`src/lib/credentials.ts`), audit log, scheduling/timezone (IST display via `toLocaleString("en-IN", {timeZone: "Asia/Kolkata"})`), notifications (later), payments (later).

## 13. Acceptance criteria
- Manager with `health.manage` revoked gets "You don't have permission to do this" on medical save (flag on).
- Audit details contain field names and no values.
- Appointment transitions follow the table; illegal ones are rejected in unit tests.
- No health data appears on any public route.

## 14. Tests
`src/lib/__tests__/health.test.ts` (whitelist, changed fields, no values), `src/lib/__tests__/wellness.test.ts` (state machine, validation), `src/lib/__tests__/credentials.test.ts`.

## 15. Implementation status (verified 2026-10-26)
| Feature group | Status | Evidence |
|---|---|---|
| Medical profile storage/edit | Partial | `src/app/actions/medical.ts` (no permission key, no audit before this branch), `src/components/org/MedicalForm.tsx` |
| Medical form prefill bug | Broken → fixed | `src/app/student/[id]/page.tsx` passed no `medicalInfo`, so saving wiped existing data |
| Health permissions + audit | Missing → built | `src/lib/team.ts`, `src/lib/health.ts`, `medical.ts`, `export.ts` |
| Coach safety views / SOS / incidents | Partial (unchanged) | `src/components/coach/MedicalCardModal.tsx`, `EmergencySOS.tsx`, `src/app/actions/incidents.ts` |
| Diet plan link | Partial (no UI caller) | `src/app/actions/gamification.ts` `updateDietPlan` |
| Provider profiles + credentials | Missing → built | `src/app/wellness/provider/page.tsx`, `src/app/actions/wellness.ts` |
| Discovery + appointments lifecycle | Missing → built | `src/app/wellness/page.tsx`, `src/app/wellness/p/[providerId]/page.tsx`, `src/lib/wellness.ts` |
| Return-to-play, payments, rescheduling, staff (PHYSIO) medical screen | Missing | — |

## 16. Release dependencies and open decisions
- Apply `prisma/sql/2026-10-26_wellness.sql` before enabling `wellness`.
- Legal (DPDP): academy as data fiduciary; verifiable parental consent for minors' data; stop collecting insurance number?
- Appointments on behalf of a child (guardian flow) not in v1.
- Encryption at rest of `medicalInfo` (`src/lib/secret-box.ts`) — later.
