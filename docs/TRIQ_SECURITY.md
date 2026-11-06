# TRIQ Security

Date: 2026-11-06. Sources: `docs/TRIQ_AUDIT.md` (Supabase advisor run 2026-11-06), `docs/SECURITY.md` (verified 2026-10-26), and the code on `release/sprint-1`. `docs/SECURITY.md` keeps the detailed per-slice checklist; this document is the security plan across the ecosystem.

## 1. Current controls

| Control | How it works | Status | Evidence |
|---|---|---|---|
| Database access | The app connects with the Supabase service role through Prisma. RLS is enabled on every table with **no policies**, so the public REST API (`anon`, `authenticated`) is denied by default | Built | Advisor reports 93 tables with RLS and no policies (intended) |
| New tables | Every new table enables RLS in its SQL file | In force | Wave 2 SQL follows it |
| Tenancy | Tenant tables carry `orgId`; server actions filter by the session's organisation, never one supplied by the client | Built | `docs/SECURITY.md` |
| Authentication | HMAC-signed session cookie; secret read at request time; production throws if it is missing. Login by WhatsApp/SMS login links | Built and used | `src/lib/auth.ts`, `login-links.ts` |
| Membership permissions | `requirePermission` / `checkPermission` with per-member overrides in `OrgMembership.permissions` | Built | `src/lib/membership.ts`, `src/lib/team.ts` |
| Money permissions | Reports, dashboard, history and reminders require finance permission | Built | `f3ba220` |
| Staff and coach permissions | Enforced from membership | Built (sprint-1 branch) | `bb9fa6f` |
| Cross-academy safety | Joining a second academy needs consent; login links cannot cross academies | Built (sprint-1 branch) | `96f467b` |
| Rate limits | Postgres-backed (`RateLimit` table) on login, public forms and all sensitive actions | Built | `b3dc136` |
| AI redaction | Children's and parents' names redacted before any model call | Built | `032d3fd` |
| Public views | Minors masked in public live views; public receipts masked | Built | `032d3fd` |
| Analytics privacy | Vercel Analytics drops child, family and token pages and strips query strings | Built (sprint-1 branch) | `src/lib/analytics-privacy.ts`, `94c5826` |
| Payment secrets | Per-academy gateway secrets encrypted; webhook signatures verified; amounts fixed server-side | Built | `src/lib/secret-box.ts` |
| Audit log | Mutations write `AuditLog` (organisation, user, action, entity, metadata). Health changes record field names, never values | Built and used | `AuditLog` 48 rows |
| Demo seeding | Blocked in production | Built | `b3dc136` |
| Logs | No secrets, tokens, full phone numbers or medical values in logs | Policy | `docs/SECURITY.md` |

Known gaps:

- Tenant isolation is tested only with mocked unit tests, not against a database.
- `checkPermission` historically admitted only the ADMIN app role; non-admin roles (coach, physio, seller, verifier) need their own checks. Re-check after the `bb9fa6f` merge.
- Runtime DDL in `src/lib/schema-ensure.ts` runs with service-role rights; retire it.
- No shared private file storage yet; files with children's or health data must not go to public buckets.
- No consent enforcement in AI context yet.

## 2. Supabase advisor findings (2026-11-06)

| Level | Finding | Fix | Status |
|---|---|---|---|
| WARN | `public.rls_auto_enable()` is a SECURITY DEFINER function executable by `anon` and `authenticated` through the REST API | `REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;` Run on staging, then production | **Applied to production 2026-11-06** (migration `revoke_public_execute_rls_auto_enable`, recorded in `prisma/sql/2026-11-06_revoke_rls_auto_enable.sql`). Verified: anon and authenticated can no longer execute it; service_role still can. |
| WARN | Extension `btree_gist` installed in the `public` schema | Move to an `extensions` schema in a planned, tested migration (check dependent exclusion constraints first) | Planned |
| INFO | 93 tables with RLS enabled and no policies | None. Intended design: service role for the app, public API denied. Keep and document (this file) | Accepted |

After each fix, re-run the advisor and record the result here.

## 3. Secrets handling

Rules:

- **Never in the repository.** No keys, connection strings, tokens or passwords in code, SQL, docs, tests or commit messages.
- **Never in chat.** Do not paste secrets into AI sessions, tickets or messages. Refer to them by variable name.
- Secrets live only in Vercel environment variables (and Supabase for the database).
- **Separate values per environment.** Preview gets its own `SESSION_SECRET` / `HMAC_SECRET`, its own staging `DATABASE_URL` and `DIRECT_URL`, and test payment keys only.
- The clinical-notes encryption key (planned) is separate from the payments key and exists only in production.
- Rotate any secret that has been exposed, and record the rotation (not the value) in the audit log or incident record.

Open configuration item: the AI key is saved in Vercel as `Triqprod`, but the code reads `ANTHROPIC_API_KEY` (last checked 2026-10-29). Re-check before testing AI features.

## 4. Tenant-isolation testing plan

Status: **Planned** (Sprint 1 item 12; depends on the staging database, item 6).

Goal: prove that one academy cannot read or change another academy's data through any server action.

1. **Fixture data on staging.** Two academies (A and B) with fictional students, guardians, coaches, batches, sessions, attendance, fee records, receipts, leads and skill reports. No real personal data.
2. **Actors.** For each academy: owner, finance staff, staff without money permission, coach, parent. Plus an outsider with no membership.
3. **Matrix.** For every server action that takes an ID: call it as each actor of academy A with IDs belonging to academy B. Expect not found or forbidden, and no data in the response.
4. **Priority entities first:** students, fees, receipts (sprint acceptance criterion), then attendance, leads, skill reports, medical info, payments, exports, AI context.
5. **Role checks within one academy:** coach sees only assigned batches; staff without finance permission get no money data; parent sees only their own children.
6. **Public surfaces:** receipt and live-match share links expose no child name or other academy's data.
7. **Run on every preview** once staging exists; a failure blocks merge to `main`.
8. **Extend** to the `care` schema before it holds data: no academy role can read tier 2 or 3, and every read writes `CareAccessLog`.

## 5. Incident response outline

A first outline. Contacts, regulator deadlines and notification wording need counsel (**COUNSEL:** confirm breach-notification duties and deadlines under DPDP and UAE law).

| Step | Action |
|---|---|
| 1. Detect | Sources: Supabase advisor and logs, Vercel runtime errors, rate-limit spikes, user reports |
| 2. Triage | Name an incident lead (founder until a security owner exists). Classify: data exposure, account takeover, availability, payment. Note whether minors' or health data is involved |
| 3. Contain | Revoke or rotate exposed secrets; disable the affected feature flag; Vercel instant rollback; block abusive sources; revoke sessions if needed |
| 4. Preserve | Keep logs and audit records. Do not delete evidence. Record a timeline |
| 5. Assess | Which organisations, people and data tiers were affected |
| 6. Notify | Founder immediately. Affected academies and guardians, and regulators where required, as counsel advises |
| 7. Recover | Fix on a feature branch, verify on preview against staging, merge with approval |
| 8. Review | Written post-incident review within a week: cause, fix, tests added, docs updated |

## 6. Security requirements for upcoming work

| Area | Requirement before release |
|---|---|
| Athlete Passport v1 | Parent sees only own children; another child's passport returns not found; share links show no child name; no medical or wellbeing field |
| Wave 2 tables | Applied on staging first; flags off until applied; RLS on each table |
| Mind & Performance C2/C3 | `care` schema, `CareAccessGrant`, `CareAccessLog`, application-level encryption, counsel and clinical sign-off |
| Messaging | Moderation, reporting and safeguarding controls before adults can message minors |
| AI | Permission-aware retrieval, consent checks, refusal tests for diagnosis and return-to-play |
