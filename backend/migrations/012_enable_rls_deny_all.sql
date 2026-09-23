-- ═══════════════════════════════════════════════════════════
-- TenderBuild — Enable RLS, deny-all (tanpa policy)
-- Backend akses via DATABASE_URL (postgres) → owner bypass RLS
-- PostgREST/anon → ditolak semua (linter rls_disabled_in_public clear)
-- ═══════════════════════════════════════════════════════════

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- Pastikan tidak ada policy permissive yang lolot
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;
