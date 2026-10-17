-- 020: wizard dokumen lelang (form 4 langkah + rekap)
-- 1. alamat direktur (kolom baru, opsional)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS alamat_direktur TEXT;

-- 2. split kapasitas alat → angka + satuan
ALTER TABLE equipments ADD COLUMN IF NOT EXISTS kapasitas_angka NUMERIC;
ALTER TABLE equipments ADD COLUMN IF NOT EXISTS kapasitas_satuan TEXT;
-- backfill: "1,7 m"→1.7/m, "350 liter", "2 inch", "4 ton", "1 m3"
UPDATE equipments SET
    kapasitas_angka = NULLIF(REGEXP_REPLACE((regexp_match(kapasitas, '^\s*([\d.,]+)'))[1], ',', '.'), '')::NUMERIC,
    kapasitas_satuan = NULLIF(TRIM(regexp_replace(kapasitas, '^\s*[\d.,]+\s*', '')), '')
WHERE kapasitas IS NOT NULL AND kapasitas <> '';

-- 3. rekam semua variabel dokumen (JSONB)
ALTER TABLE tender_documents ADD COLUMN IF NOT EXISTS variables JSONB;

-- 4. lampiran per alat (1 alat N file; 2 alat boleh berbagi 1 file)
CREATE TABLE IF NOT EXISTS equipment_doc_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES equipments(id) ON DELETE CASCADE,
    label TEXT,
    file_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_equip_doc_files_equipment ON equipment_doc_files(equipment_id);
