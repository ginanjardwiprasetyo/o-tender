-- ═══════════════════════════════════════════════════════════
-- TenderBuild — Disable RLS (backend uses service role, bypasses RLS)
-- RLS warnings are false positives: frontend only talks to Express API
-- ═══════════════════════════════════════════════════════════

-- Drop permissive policies first (clean up)
DROP POLICY IF EXISTS "Allow all" ON tenders;
DROP POLICY IF EXISTS "Allow all" ON tender_schedules;
DROP POLICY IF EXISTS "Allow all" ON equipments;
DROP POLICY IF EXISTS "Allow all" ON personnel;
DROP POLICY IF EXISTS "Allow all" ON education_history;
DROP POLICY IF EXISTS "Allow all" ON experience_history;
DROP POLICY IF EXISTS "Allow all" ON templates;
DROP POLICY IF EXISTS "Allow all" ON tender_documents;
DROP POLICY IF EXISTS "Allow all" ON tender_personnel_assignments;
DROP POLICY IF EXISTS "Allow all" ON settings;
DROP POLICY IF EXISTS "Allow all" ON companies;
DROP POLICY IF EXISTS "Allow all" ON personnel_ska;
DROP POLICY IF EXISTS "Allow all" ON crawled_tenders;
DROP POLICY IF EXISTS "Allow all" ON crawl_logs;
DROP POLICY IF EXISTS "Allow all" ON letters;
DROP POLICY IF EXISTS "Allow all" ON followed_tenders;
DROP POLICY IF EXISTS "Allow all" ON wa_logs;

-- Disable RLS on all tables
ALTER TABLE tenders DISABLE ROW LEVEL SECURITY;
ALTER TABLE tender_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE equipments DISABLE ROW LEVEL SECURITY;
ALTER TABLE personnel DISABLE ROW LEVEL SECURITY;
ALTER TABLE education_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE experience_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE tender_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE tender_personnel_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_ska DISABLE ROW LEVEL SECURITY;
ALTER TABLE crawled_tenders DISABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE letters DISABLE ROW LEVEL SECURITY;
ALTER TABLE followed_tenders DISABLE ROW LEVEL SECURITY;
ALTER TABLE wa_logs DISABLE ROW LEVEL SECURITY;
