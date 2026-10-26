# TRIQ Security

Verified 2026-10-26 against `main` and the production Supabase project (read-only checks).

## Tenancy
- Every org-scoped table carries `orgId`; every query in server actions filters by the session's `orgId`. Pure helpers never take `orgId` from the client.
- Server actions validate input server-side and ignore client-supplied identity (e.g. `notifications.ts` ignores the `userId` argument).
- Consolidated (Enterprise) access must be an explicit, audited grant — never implicit through a parent org.

## Authentication
- Signed session cookie (HMAC), secret resolved at request time (`src/lib/auth.ts`). Production throws if the secret is missing.
- Preview deployments need their **own** `HMAC_SECRET` (separate value from production) — pending founder action in Vercel.
- Login by WhatsApp/SMS login links; OTP via MSG91 not yet configured.

## Authorisation
- `requirePermission` / `checkPermission` (`src/lib/membership.ts`), keys in `src/lib/team.ts`, per-member overrides in `OrgMembership.permissions`.
- Known gap: `checkPermission` admits only the ADMIN app role; non-admin roles (coach, physio, seller, verifier) need dedicated checks.

## Database
- Supabase Postgres, RLS **enabled on all 47 public tables with no policies** (deny-by-default to anon/authenticated). The app connects with the service role via Prisma, so RLS is a defence against direct REST access.
- New tables must `ENABLE ROW LEVEL SECURITY` in their SQL file.
- Advisor warnings to fix (need approval): `btree_gist` extension in `public` schema; `rls_auto_enable` SECURITY DEFINER function executable by anon/authenticated.
- Migration drift: production has 47 tables; repo SQL only covers recent ones. Schema of record is `prisma/schema.prisma`.
- Migrations are additive and applied only with founder approval.

## Sensitive data
- **Health** (medical info, incidents, wellness appointments): never on public pages or general dashboards; requires `health.view`/`health.manage`; audit records field names only, never values.
- **Minors**: no public profile beyond first name + last initial, only with guardian consent. No under-18 contact details on any public surface.
- **Payments**: per-org gateway secrets encrypted (`src/lib/secret-box.ts`); webhook signatures verified; amounts fixed server-side.
- **Logs**: no secrets, tokens, full phone numbers or medical values in logs or integration logs.

## Abuse prevention
- DB-backed rate limiting (`rateLimitDb`, `RateLimit` table) on login and public forms.
- Content reporting/moderation: planned in shared platform (`ContentReport`).

## Release checklist (each slice)
1. Input validated server-side; orgId-scoped queries; permission check; audit entry.
2. No `"use server"` file exports anything but async functions.
3. New table: `orgId`, RLS enabled, added to `src/app/actions/delete.ts`.
4. Feature flag default off; migration SQL in `prisma/sql/` awaiting approval.
5. Tests: pure rules unit-tested; tsc 0 errors; full `next build` passes.
