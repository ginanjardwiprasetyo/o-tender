-- 023: alat milik perusahaan (kolom PT = kode singkatan)
ALTER TABLE equipments ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
