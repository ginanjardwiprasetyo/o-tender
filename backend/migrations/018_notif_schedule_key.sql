-- 018: kunci flag notifikasi ke jadwal (biar jadwal berubah → flag lama hangus)
ALTER TABLE followed_tenders ADD COLUMN IF NOT EXISTS notif_penjelasan_for TEXT;
ALTER TABLE followed_tenders ADD COLUMN IF NOT EXISTS notif_upload_for TEXT;
ALTER TABLE followed_tenders ADD COLUMN IF NOT EXISTS notif_pemenang_for TEXT;
