-- Migration: Create followed_tenders table
CREATE TABLE IF NOT EXISTS followed_tenders (
    id SERIAL PRIMARY KEY,
    kode_tender BIGINT UNIQUE NOT NULL,
    nama_tender TEXT NOT NULL,
    pagu BIGINT,
    hps BIGINT,
    klpd TEXT,
    satuan_kerja TEXT,
    tahun INTEGER,
    lokasi_pekerjaan TEXT,
    followed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
