
-- Add kop surat columns to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS kop_is_image BOOLEAN DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS kop_image_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS kop_nama TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS kop_alamat TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS kop_kontak TEXT;
