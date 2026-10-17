-- 019: alamat personil (opsional, fallback "-" bila kosong)
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS alamat TEXT;
