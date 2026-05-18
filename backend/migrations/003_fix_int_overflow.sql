-- 🏗️ Migration: Fix Integer Overflow for Tender Codes
-- Changes INT to BIGINT for kode_tender and kd_lpse

-- 1. Tenders Table
ALTER TABLE tenders ALTER COLUMN kode_tender TYPE BIGINT;
ALTER TABLE tenders ALTER COLUMN kd_lpse TYPE BIGINT;

-- 2. Crawled Tenders Table
ALTER TABLE crawled_tenders ALTER COLUMN kd_lpse TYPE BIGINT;
