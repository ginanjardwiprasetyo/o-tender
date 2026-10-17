-- 021: segmen PA nomor surat (001/PA/SDG/UGM/X/2026)
ALTER TABLE letters ADD COLUMN IF NOT EXISTS perihal_singkatan TEXT DEFAULT 'PA';
