-- APPLIED to production (project triq, tfekmfumwsnxcddixlxm) on 2026-11-06 with founder approval,
-- as Supabase migration "revoke_public_execute_rls_auto_enable". Sprint 1, item 5.
-- Fixes Supabase advisor warnings 0028/0029: SECURITY DEFINER function callable by anon/authenticated.
-- Verified after apply: anon=false, authenticated=false, service_role=true, postgres=true.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, PUBLIC;
-- Rollback: GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO anon, authenticated;
