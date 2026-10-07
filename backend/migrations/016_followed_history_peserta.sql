-- 016: simpan peserta/pemenang per tender (rekap per perusahaan)
ALTER TABLE followed_tenders ADD COLUMN IF NOT EXISTS history_peserta JSONB;
