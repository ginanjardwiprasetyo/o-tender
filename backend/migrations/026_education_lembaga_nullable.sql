-- 026: "Lembaga Pendidikan" jadi OPSIONAL
-- Riwayat pendidikan bisa diisi sebagian (cukup jenjang/jurusan/tahun lulus),
-- jadi kolom lembaga tidak lagi wajib (NOT NULL dilepas).
ALTER TABLE education_history ALTER COLUMN lembaga DROP NOT NULL;
