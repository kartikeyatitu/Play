# Sprint 1 Task 8 — Row-Level Security end-to-end verification

**Runbook. Executed by: Kartikeya (requires Supabase SQL Editor access). Expected duration: 20 min.**

## Why

`prisma/sql/2026-10-14_enable_rls_on_exposed_tables.sql` enables Postgres RLS on
several tables. **This is only effective if the app's DB role is actually subject
to the policies** — a role with BYPASSRLS, SUPERUSER, or OWNER privilege silently
ignores every policy.

Prisma typically connects as a non-superuser role, but Supabase assigns connection
URLs to specific roles (`postgres`, `service_role`, `anon`, `authenticated`). The
default `DATABASE_URL` from Supabase often uses `postgres` which **has BYPASSRLS**.

Translation: RLS might be theatre right now. This task proves one way or the other.

## Pre-flight

- [ ] Access to the Supabase project SQL Editor (`tfekmfumwsnxcddixlxm`)
- [ ] The `DATABASE_URL` env var's actual value from Vercel (so we can tell which role)

## Step 1 — Identify the app's DB role

In Supabase SQL Editor, run:

```sql
SELECT current_user, session_user;
-- Just to see what role the Editor itself is running as (usually postgres)
```

Then from the Vercel env vars, copy the username portion of `DATABASE_URL`:
```
postgresql://USERNAME:password@host:port/db
                      ^^^^^^^^
```
Share that username in the report back.

## Step 2 — Check if that role bypasses RLS

Run (replace `__APP_ROLE__` with the username from Step 1):

```sql
SELECT
  rolname,
  rolsuper   AS is_superuser,       -- superuser ignores RLS
  rolbypassrls AS bypasses_rls      -- explicit BYPASSRLS
FROM pg_roles
WHERE rolname IN ('__APP_ROLE__', 'postgres', 'service_role', 'anon', 'authenticated');
```

**Result interpretation:**
- `is_superuser = true` → RLS is theatre. Role must be downgraded or app must use a different role.
- `bypasses_rls = true` → same.
- Both false → RLS applies to this role. Continue to Step 3.

## Step 3 — List the tables that have RLS enabled

```sql
SELECT schemaname, tablename, rowsecurity, forcerowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true
ORDER BY tablename;
```

**Red flag:** if `forcerowsecurity = false` on a table, superuser-ish roles bypass
even on this table. `FORCE ROW LEVEL SECURITY` is needed for maximum protection.

## Step 4 — List existing policies

```sql
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

For each sensitive table (Student, FeeRecord, Payment, Receipt, etc.) there must
be at least one policy scoping reads/writes to the caller's `orgId`.

## Step 5 — Attempt a cross-tenant read as the app role

In Supabase SQL Editor, use "Run as" or switch to the app role (depends on your
Supabase plan — may require Pro). If not possible from Editor, open a `psql` with
the app's `DATABASE_URL` directly and run:

```sql
-- Pick two different orgs
SELECT id, name FROM "Organization" LIMIT 2;

-- Try to read Student rows WITHOUT an orgId filter
SELECT COUNT(*) FROM "Student";
-- Expected if RLS is enforcing: 0 (or an error about role not having privilege)
-- Red flag if returns the full count across all orgs
```

If the policy requires a session variable like `request.jwt.claims`, set it first:
```sql
SELECT set_config('request.jwt.claims', '{"org_id":"<ORG_ID>"}', false);
SELECT COUNT(*) FROM "Student";
-- Expected: count for just that org
```

## Step 6 — Report back

Share the output of each step. Claude will interpret and either:
- Confirm RLS is enforcing → mark Task 8 complete
- Identify the gap → open a follow-up PR to add the missing policy / change role / force RLS

## Expected outcomes

| Scenario | Verdict | Action |
|---|---|---|
| App role has BYPASSRLS | ❌ RLS is theatre | Switch connection role OR revoke BYPASSRLS |
| RLS on but no policy covers Student | ❌ Reads will fail | Add policy or disable RLS on that table |
| App role is scoped, policies exist, cross-tenant query returns 0 | ✅ RLS working | Mark complete, document the role in docs/known-issues.md |

## Safety

- No destructive statements in this runbook
- No data is created, modified, or deleted
- Read-only inspection + one count query
- If Step 5 crashes with "insufficient privilege" that's actually good news — RLS caught you
