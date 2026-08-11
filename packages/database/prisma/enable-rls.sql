-- Lock down Supabase Data API (PostgREST) for MotiveLife.
-- App access is via Prisma + DATABASE_URL (postgres role, BYPASSRLS) — not anon keys.
--
-- Clears advisors:
--   - rls_disabled_in_public
--   - sensitive_columns_exposed
--
-- Safe to re-run. Run in Supabase → SQL Editor, or:
--   node packages/database/scripts/enable-rls.mjs

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.table_name);
  END LOOP;
END $$;

-- No policies on purpose: deny-by-default for anon / authenticated via the Data API.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
