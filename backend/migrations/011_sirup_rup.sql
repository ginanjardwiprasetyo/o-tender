-- SIRUP RUP Table — Stores crawled Rencana Umum Pengadaan data
-- Source: sirup.inaproc.id

CREATE TABLE IF NOT EXISTS sirup_rup (
  id SERIAL PRIMARY KEY,
  kode_paket TEXT UNIQUE NOT NULL,
  nama_paket TEXT,
  pagu BIGINT DEFAULT 0,
  jenis_pengadaan TEXT,
  is_pdn BOOLEAN DEFAULT FALSE,
  is_umk BOOLEAN DEFAULT FALSE,
  metode TEXT,
  pemilihan TEXT,
  kldi TEXT,
  satuan_kerja TEXT,
  lokasi TEXT,
  lokasi_id TEXT,
  tahun_anggaran INT,
  bulan INT,
  detail_html TEXT,
  detail_data JSONB,
  raw_data JSONB,
  crawled_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sirup_rup_tahun ON sirup_rup(tahun_anggaran);
CREATE INDEX IF NOT EXISTS idx_sirup_rup_lokasi ON sirup_rup(lokasi_id);
CREATE INDEX IF NOT EXISTS idx_sirup_rup_jenis ON sirup_rup(jenis_pengadaan);
CREATE INDEX IF NOT EXISTS idx_sirup_rup_bulan ON sirup_rup(bulan);
CREATE INDEX IF NOT EXISTS idx_sirup_rup_metode ON sirup_rup(metode);
