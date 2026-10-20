-- 025: dokpil_data — hasil ekstraksi dokpil yang disimpan ke Tender Saya
CREATE TABLE IF NOT EXISTS dokpil_data (
  id SERIAL PRIMARY KEY,
  kode_tender BIGINT NOT NULL,
  nama_file TEXT,
  pokja TEXT,
  alamat_pokja TEXT,
  nama_paket TEXT,
  lokasi TEXT,
  jangka_waktu TEXT,
  pagu_anggaran TEXT,
  pagu_terbilang TEXT,
  kir TEXT DEFAULT 'tidak',
  peralatan JSONB DEFAULT '[]'::jsonb,
  personel JSONB DEFAULT '[]'::jsonb,
  rkk JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dokpil_data_kode ON dokpil_data(kode_tender);
