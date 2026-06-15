-- ═══════════════════════════════════════════════════════════
-- TenderBuild — Enable RLS on tables created after 001_init
-- ═══════════════════════════════════════════════════════════

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_ska ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawled_tenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE followed_tenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_logs ENABLE ROW LEVEL SECURITY;

-- Allow all operations with anon key (dev mode, same pattern as 001_init)
CREATE POLICY "Allow all" ON companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON personnel_ska FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON crawled_tenders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON crawl_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON letters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON followed_tenders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON wa_logs FOR ALL USING (true) WITH CHECK (true);
