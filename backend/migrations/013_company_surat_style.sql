-- Gaya surat per perusahaan: warna garis bawah kop + font teks surat
ALTER TABLE companies ADD COLUMN IF NOT EXISTS kop_garis_warna TEXT DEFAULT '#000000';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS font_surat TEXT DEFAULT 'Times New Roman';
