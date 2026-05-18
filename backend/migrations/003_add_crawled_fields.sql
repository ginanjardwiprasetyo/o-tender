-- Migration 003: Add SBU and batas_upload to crawled_tenders

ALTER TABLE crawled_tenders 
ADD COLUMN IF NOT EXISTS sbu VARCHAR(255),
ADD COLUMN IF NOT EXISTS batas_upload VARCHAR(50);
