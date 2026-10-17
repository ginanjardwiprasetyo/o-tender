-- 017: Google Docs template binding + hasil generate dokumen
ALTER TABLE templates ADD COLUMN IF NOT EXISTS gdoc_id VARCHAR(100);
ALTER TABLE templates ADD COLUMN IF NOT EXISTS gdoc_synced_at TIMESTAMPTZ;

ALTER TABLE tender_documents ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE tender_documents ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE tender_documents ADD COLUMN IF NOT EXISTS page_count INT;
