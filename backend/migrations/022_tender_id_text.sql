-- 022: tender_documents.tender_id fleksibel (id INT followed / kode BIGINT / uuid tenders)
ALTER TABLE tender_documents DROP CONSTRAINT IF EXISTS tender_documents_tender_id_fkey;
ALTER TABLE tender_documents ALTER COLUMN tender_id TYPE TEXT USING tender_id::text;
