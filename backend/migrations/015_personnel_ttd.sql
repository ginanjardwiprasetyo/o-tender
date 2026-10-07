-- 015: tanda tangan personil (dipakai {{ttd_personil}} / {{ttd_gabungan}} saat cetak surat)
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS ttd_image_url TEXT;
