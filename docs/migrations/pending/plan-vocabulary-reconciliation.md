# Pending migration — Plan vocabulary reconciliation

**Status:** DOCUMENTED, NOT EXECUTED
**Reference:** Sprint 1 Task 1 · audit §4.H · plan §12 step 3 safety rule
**Author:** Claude Opus 4.7 (`claude.ai/code/session_01SHFsy2bnwW7XvrtnTNaszP`)
**Needs:** founder approval before any production SQL

## Why

Three different plan vocabularies grew up in parallel:

| System | Vocabulary | Source |
|---|---|---|
| Pricing / UI | `free` / `growth` / `academy` | `src/lib/pricing.ts` |
| Organization table | `FREE_TRIAL` | `onboarding.ts`, `register-academy.ts` |
| Subscription table | `FREE` / `STARTER` / `PRO` / `ENTERPRISE` | `billing-service.ts` |

Code is now reconciled around canonical lowercase `"free" | "growth" | "academy"` via
`canonicalPlan()` in `pricing.ts`. Reads tolerate every historic value; new writes use the
canonical set.

**Data is NOT migrated.** Every existing Organization row still has `plan = "FREE_TRIAL"`.
`canonicalPlan()` maps that to `"free"` at read time, so entitlement checks are consistent
immediately. A one-shot migration below cleans the data when the founder approves.

## Current production state (verified 2026-10-20)

```sql
SELECT plan, COUNT(*) FROM "Organization" GROUP BY plan;
-- Expected: ("FREE_TRIAL", 8)
```

## Proposed migration (NOT EXECUTED)

Idempotent. Safe to re-run.

```sql
BEGIN;

-- 1. Document the before state in a one-row audit record.
--    (Omit if no Migration audit table exists; this is for your reference.)

-- 2. Normalize Organization.plan to canonical lowercase.
UPDATE "Organization"
SET    "plan" = 'free'
WHERE  "plan" IN ('FREE_TRIAL', 'FREE', 'free_trial', 'Free', '');

UPDATE "Organization"
SET    "plan" = 'growth'
WHERE  "plan" IN ('STARTER', 'PRO', 'Starter', 'Pro', 'Growth');

UPDATE "Organization"
SET    "plan" = 'academy'
WHERE  "plan" IN ('ENTERPRISE', 'Enterprise', 'Academy');

-- 3. Same normalization for Subscription.plan (if any rows exist).
UPDATE "Subscription"
SET    "plan" = 'free'
WHERE  "plan" IN ('FREE', 'FREE_TRIAL', 'Free', '');

UPDATE "Subscription"
SET    "plan" = 'growth'
WHERE  "plan" IN ('STARTER', 'PRO', 'Starter', 'Pro', 'Growth');

UPDATE "Subscription"
SET    "plan" = 'academy'
WHERE  "plan" IN ('ENTERPRISE', 'Enterprise', 'Academy');

-- 4. Verify.
SELECT 'org'   AS kind, plan, COUNT(*) FROM "Organization" GROUP BY plan
UNION ALL
SELECT 'sub'   AS kind, plan, COUNT(*) FROM "Subscription" GROUP BY plan;

-- Expected post-state: every row has plan IN ('free', 'growth', 'academy').

COMMIT;
```

## Rollback

The old vocabulary is already tolerated by `canonicalPlan()`. If the migration goes wrong,
reverse the specific UPDATE statements for the rows that changed; code behaviour is
unaffected either way (the helper normalises on read).

## Risk

Low:
- 8 Organization rows affected
- 0 Subscription rows affected (checked 2026-10-20: `SELECT COUNT(*) FROM "Subscription"` → 0)
- No code reads the raw string any more — all callers go through `canonicalPlan()`
- Fully reversible

## Approval checkbox

- [ ] Founder has read this migration
- [ ] Backup verified on `tfekmfumwsnxcddixlxm` within last 24 hours
- [ ] Migration run against staging / preview DB first (there isn't one — N/A today)
- [ ] Run on production, verify counts match
- [ ] Delete this file once applied; log the run in `docs/migrations/applied/`

Not to be run until all four boxes above are honestly checkable.
