# Vertical 3 — Coach careers

Status: PLAN ONLY. Nothing here is applied. Written 2026-10-25 against branch `feat/academy-os-branches`.

## 1. Goal

Give every coach on Triq a portable professional identity that outlives any one academy: a profile
they own (sports, experience, bio), credentials that are clearly marked as **claimed** or **verified
(and by whom)**, and a work history built from real Triq data (academies, batches, sessions taken).
Academies get a trustworthy way to verify and showcase their coaches; parents get an honest
"verified" badge. This vertical does **not** build a hiring marketplace in v1.

## 2. Verified today

| Capability | Evidence | Status |
|---|---|---|
| Public coach page | `src/app/c/[coachId]/page.tsx` — selects only public-safe fields from `User` + `Organization` + `Batch` (counts enrollments, never names); shows batches, schedule, spots left, "Book a free trial" CTA to `/trial` | working |
| Public page gated by flag | `FEATURES.coachOS` (`src/lib/features.ts`) is **not referenced anywhere** besides its definition (grep across `src/`). `/c/[coachId]` is live for every COACH/ADMIN user with an active org | missing (gate) |
| Coach pages in sitemap | `src/app/sitemap.ts` lines 34–38, 85–87: every `verified: true` COACH/ADMIN user is indexed at `/c/{id}` | working (ungated) |
| Share profile | `src/components/coach/CoachShareProfileButton.tsx` (Web Share → WhatsApp fallback) | working |
| Credential checklist | `src/app/actions/coach-verification.ts`: 5 hard-coded steps stored as JSON in `User.verificationData`; coach can only set PENDING/SUBMITTED; admin sets VERIFIED; `User.verified` flips when all 5 are VERIFIED | partial |
| Evidence storage | `uploadUrl` is a coach-pasted http(s) link validated by `safeHttpUrl` — no file upload, no verifier id, no audit log | partial |
| Who verifies | `findAccessibleCoach` lets any `requireAuth(['ADMIN'])` user of the coach's org verify — this is **academy-attested**, not Triq-verified | partial |
| Direct verify toggle | `src/app/actions/verification.ts` `toggleCoachVerification` (`checkPermission("team.manage")`, tenant scoped via `coachesOfOrg`) sets `User.verified` directly, bypassing the checklist; no audit | partial |
| Admin verification UI | `src/components/org/CoachVerification.tsx`, mounted in `AdminClient.tsx` line 434 | working |
| Coach-side banner | `CoachVerificationBanner` shown in `CoachMePanel.tsx` while `!coach.verified` | working |
| Org "CoachProfile" editor | `src/components/org/CoachProfile.tsx` — experience, ID proof, certificate, specialisations held in `useState` only (Files never uploaded). **Not imported anywhere** (grep) | UI-only, orphaned |
| Training plan | `src/components/coach/TrainingPlan.tsx` — 5 local text fields + copy; not imported anywhere | UI-only, orphaned |
| Coach performance | `src/components/org/CoachPerformance.tsx` — sessions/students/est. payout from batches passed in; mounted on analytics tab (`AdminClient.tsx` line 625) | working (academy-internal) |
| Parent coach directory | `src/components/parent/CoachDirectory.tsx`, data from `src/app/parent/page.tsx` (`verified: true` coaches of the org) | working |
| Multi-academy membership | `OrgMembership` (role, title, joinedAt, removedAt, status) + `getMyAcademies`/`switchAcademy` in `src/app/actions/team.ts` | working |
| Coach profile spans academies | `/c/[coachId]` reads `User.orgId` (active academy only) — batches at other academies are not shown | missing |
| Coach bio / years / certifications fields | No such columns on `User` or `OrgMembership` (schema read) | missing |
| Coach payouts | `StaffPayout` + `src/app/actions/payroll.ts` (Vertical 1 territory) | working |

## 3. Gaps for a real v1

1. The public surface is not behind `coachOS`; decide whether existing `/c/*` links stay public (they are shared on WhatsApp already) before gating.
2. "Verified" conflates academy attestation with platform verification. Parents see "Verified coach" with no source.
3. Credentials live in an unqueryable JSON blob with a fixed list; no expiry (first-aid lapses), no verifier identity, no audit trail.
4. Two inconsistent paths set `User.verified` (`toggleCoachVerification` and the checklist).
5. No coach-owned profile fields (bio, experience, sports, languages); `CoachProfile.tsx` pretends to have them.
6. No career history view built from `OrgMembership` + `Session` counts.
7. No coach consent for being public / indexed (DPDP concern: name + workplace are public).

## 4. v1 scope

**In**
- Coach-owned profile (bio, years experience, sports, languages, city, `isPublic` opt-in).
- Structured credentials: claimed by coach, verified by an academy admin (`ACADEMY`) or Triq ops (`TRIQ`), with evidence link, expiry, verifier, audit.
- Public page shows each credential as "Claimed" / "Verified by <Academy>" / "Verified by Triq"; badge reflects the strongest verified source.
- Career history: academies (from `OrgMembership`), active batches, sessions taken (count from `Session` where `batch.coachId`).
- Gate everything new behind `coachOS`.

**Out (explicitly)**
- Job board / hiring marketplace, coach ratings & reviews, coach-to-parent private coaching sales, file upload storage for ID documents (we store links + verifier attestation only; no Aadhaar images on Triq), background-check vendor integration, training plan persistence.

## 5. Data model

Reuse: `User` (identity), `OrgMembership` (history), `Batch`/`Session` (activity), `AuditLog`.
New tables are justified because `User.verificationData` is JSON text (not queryable, no verifier,
no expiry), and profile fields belong to the coach not to one academy's membership row.

```prisma
model CoachProfile {
  id              String   @id @default(cuid())
  userId          String   @unique
  bio             String?
  yearsExperience Int?
  sports          String[] @default([])
  languages       String[] @default([])
  city            String?
  isPublic        Boolean  @default(false) // coach consent to public page + sitemap
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model CoachCredential {
  id              String    @id @default(cuid())
  userId          String    // the coach
  kind            String    // ID_PROOF | COACHING_CERT | FIRST_AID | BACKGROUND_CHECK | EXPERIENCE | OTHER
  title           String
  issuer          String?
  evidenceUrl     String?   // http(s) link only, validated with safeHttpUrl
  status          String    @default("CLAIMED") // CLAIMED | SUBMITTED | VERIFIED | REJECTED
  verifierType    String?   // ACADEMY | TRIQ
  verifiedByOrgId String?   // set when verifierType = ACADEMY
  verifiedById    String?
  verifiedAt      DateTime?
  expiresAt       DateTime?
  rejectReason    String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  @@index([userId])
  @@index([verifiedByOrgId])
}
```

```sql
-- prisma/sql/2026-11-XX_coach_careers.sql
-- Additive only. NOT APPLIED. Requires founder approval.
CREATE TABLE IF NOT EXISTS "CoachProfile" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
  "bio" TEXT, "yearsExperience" INTEGER,
  "sports" TEXT[] NOT NULL DEFAULT '{}', "languages" TEXT[] NOT NULL DEFAULT '{}',
  "city" TEXT, "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "CoachProfile" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "CoachCredential" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL, "title" TEXT NOT NULL, "issuer" TEXT, "evidenceUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'CLAIMED',
  "verifierType" TEXT,
  "verifiedByOrgId" TEXT REFERENCES "Organization"("id") ON DELETE SET NULL,
  "verifiedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "verifiedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3), "rejectReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CoachCredential_userId_idx" ON "CoachCredential"("userId");
CREATE INDEX IF NOT EXISTS "CoachCredential_verifiedByOrgId_idx" ON "CoachCredential"("verifiedByOrgId");
ALTER TABLE "CoachCredential" ENABLE ROW LEVEL SECURITY;
```

`User.verified` and `User.verificationData` stay untouched (read-compat). A one-off backfill script
(founder-approved) maps the 5 JSON steps to `CoachCredential` rows with `verifierType = 'ACADEMY'`,
`verifiedByOrgId = User.orgId` for VERIFIED steps.

## 6. Build slices

**S1 — Flag + consent gate (no schema).**
- Objective: make the existing public surface obey `FEATURES.coachOS` without breaking shared links.
- Files: `src/app/c/[coachId]/page.tsx` (when flag off, keep current page — founder decision, see §9 — but add `robots: noindex`), `src/app/sitemap.ts` (skip `/c/*` entries when flag off), `src/components/coach/CoachShareProfileButton.tsx` (hide when flag off).
- Permission/tenant: public read only; no change to selected fields.
- Audit: none (read path).
- Tests: `src/lib/__tests__/coach-public.test.ts` for a pure `shouldIndexCoach({flag, verified, isPublic})` helper in `src/lib/coach-public.ts`.
- Acceptance: flag off ⇒ no `/c/` URLs in sitemap, page has `noindex`; flag on ⇒ today's behaviour.

**S2 — Schema + read model.**
- Objective: add `CoachProfile`, `CoachCredential` (SQL above, not applied) and a pure mapper.
- Files: `prisma/schema.prisma` (additive), `prisma/sql/2026-11-XX_coach_careers.sql`, `src/lib/coach-credentials.ts` (kinds, statuses, `badgeFor(credentials)` → `NONE | CLAIMED | ACADEMY_VERIFIED | TRIQ_VERIFIED`, `isExpired`), `src/lib/__tests__/coach-credentials.test.ts`, backfill script `scripts/backfill-coach-credentials.ts` (dry-run default).
- Permission/tenant: n/a (no actions yet).
- Tests: badge precedence, expiry handling, legacy JSON → credential mapping (pure).
- Acceptance: `prisma generate` passes; code ships only after SQL is applied (Prisma selects all columns).

**S3 — Coach edits own profile + claims credentials.**
- Objective: coach-side "My profile" in `CoachMePanel` behind flag.
- Files: `src/app/actions/coach-profile.ts` (`getMyCoachProfile`, `saveMyCoachProfile`, `addCredential`, `submitCredential`, `removeCredential` — async only), `src/components/coach/CoachProfileEditor.tsx`, `CoachMePanel.tsx` (mount).
- Permission/tenant: `requireMember(["COACH","ADMIN"])`; `userId` is always `session.id` — never from input. Coach may only set CLAIMED/SUBMITTED.
- Audit: `COACH_PROFILE_UPDATED`, `COACH_CREDENTIAL_ADDED`, `COACH_CREDENTIAL_SUBMITTED` (orgId = active org).
- Tests: input validation helper in `src/lib/coach-credentials.ts` (lengths, URL via `safeHttpUrl`, kind whitelist).
- Acceptance: a coach cannot write another user's rows; `isPublic` defaults false.

**S4 — Academy verification of credentials.**
- Objective: replace JSON checklist in `CoachVerification.tsx` with credential rows when flag on (old UI stays when off).
- Files: `src/app/actions/coach-credentials-admin.ts` (`listCoachCredentials`, `verifyCredential`, `rejectCredential`), `src/components/org/CoachVerification.tsx` (branch on flag).
- Permission/tenant: `requirePermission("team.manage")`; target coach must have an ACTIVE `OrgMembership` in `session.orgId`; writes `verifierType='ACADEMY'`, `verifiedByOrgId=session.orgId`. An academy can only revoke what it verified.
- Audit: `COACH_CREDENTIAL_VERIFIED`, `COACH_CREDENTIAL_REJECTED`, `COACH_CREDENTIAL_REVOKED`.
- Tests: pure `canVerify({membership, credential, orgId})`.
- Acceptance: academy B cannot verify a coach who is not its member; revoking at A leaves B's verification intact.

**S5 — Public profile v2 + career history.**
- Objective: `/c/[coachId]` shows profile, per-credential provenance, academies (ACTIVE + past memberships with year range), sessions taken; only when `coachOS && CoachProfile.isPublic`.
- Files: `src/app/c/[coachId]/page.tsx`, `src/lib/coach-public.ts`.
- Permission/tenant: public; select only public-safe fields; past academies shown by name only if org `isActive`; never phone/email/student data.
- Audit: none.
- Tests: `careerTimeline(memberships)` pure helper.
- Acceptance: label never says "Verified" without a VERIFIED, non-expired credential; source named.

**S6 — Triq ops verification (optional).**
- Files: `src/app/ops/coaches/page.tsx`, `src/app/ops/coaches/actions.ts` (`requireAuth(["SUPER_ADMIN"])`, as in `src/app/ops/leads/actions.ts`).
- Audit: `COACH_CREDENTIAL_TRIQ_VERIFIED` (orgId null).
- Acceptance: `TRIQ_VERIFIED` badge only from this path.

## 7. Feature flag

`coachOS` (`NEXT_PUBLIC_FEATURE_COACH_OS`), already defined in `src/lib/features.ts`, default **false**.
Gates: coach profile editor, credential actions (actions return an error when off), new verification UI,
public profile v2, `/c/*` sitemap entries.

## 8. Dependencies

- **Vertical 1 (Academy operations):** relies on `OrgMembership` being authoritative for "who coaches here" (known issue 4.D in `docs/known-issues.md`: `batch.ts` validates coach via `User.orgId` only). Fix 4.D first or career history will be wrong for multi-academy coaches. Payroll (`StaffPayout`) stays in V1; careers only reads session counts.
- **Vertical 4 (Participation):** public profile CTA routes to `/trial`; trial attribution to a coach needs V4's trial source field.
- **Vertical 6 (Competitions):** later, coach results/achievements could appear on the profile — out of v1.

## 9. Risks and open questions

1. `/c/*` is already public and indexed while `coachOS` is off. Keep it live (it drives trials) or noindex it until coaches opt in? Recommendation: keep page, noindex + drop from sitemap until `isPublic`.
2. Should an academy's verification be visible after the coach leaves that academy? (Proposal: yes, labelled with academy name and date.)
3. Will Triq ever verify credentials itself (ops capacity, liability)? If not, drop S6 and never show "Verified by Triq".
4. Storing ID-proof links (Aadhaar/PAN) is sensitive; proposal is to record only "ID checked by <academy> on <date>" with no evidence URL for `ID_PROOF`.
5. Backfill: 5 legacy steps → which existing `verified: true` users have no step data (set via `toggleCoachVerification`)? Unverified; needs a read-only DB count before the backfill is approved.
6. RLS status of `User` is not covered by `prisma/sql/2026-10-14_enable_rls_on_exposed_tables.sql`; could not verify from code.
