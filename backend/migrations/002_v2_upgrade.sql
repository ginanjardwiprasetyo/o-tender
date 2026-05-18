-- ═══ Perusahaan ═══
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama_perusahaan VARCHAR(500) NOT NULL,
    singkatan VARCHAR(50),           -- "CV. GM" / "PT. XYZ"
    direktur VARCHAR(255),
    nik_direktur VARCHAR(20),
    npwp_usaha VARCHAR(30),
    npwp_direktur VARCHAR(30),
    kbli TEXT,                       -- KBLI codes, comma-separated
    no_hp VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    alamat TEXT,
    kota VARCHAR(100),
    provinsi VARCHAR(100),
    foto_logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ Personnel upgrades ═══
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS jabatan VARCHAR(255);
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS ktp_url TEXT;
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS npwp_url TEXT;

-- Education: tambah jurusan, jenjang
ALTER TABLE education_history ADD COLUMN IF NOT EXISTS jenjang VARCHAR(10); -- S1, S2, D3 etc
ALTER TABLE education_history ADD COLUMN IF NOT EXISTS jurusan VARCHAR(255);
ALTER TABLE education_history ADD COLUMN IF NOT EXISTS ijazah_url TEXT;     -- Upload ijazah

-- ═══ SKA (multi-SKA per personnel) ═══
CREATE TABLE IF NOT EXISTS personnel_ska (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    personnel_id UUID REFERENCES personnel(id) ON DELETE CASCADE,
    nama_sertifikat VARCHAR(500),     -- "Ahli Teknik Bangunan Gedung - Madya"
    no_registrasi VARCHAR(100),
    sub_klasifikasi VARCHAR(100),     -- BG004, etc
    berlaku_sampai DATE,
    file_url TEXT,                    -- Upload berkas SKA
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ Experience: tambah referensi upload ═══
ALTER TABLE experience_history ADD COLUMN IF NOT EXISTS surat_referensi_url TEXT;
ALTER TABLE experience_history ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- ═══ Crawled Tenders ═══
CREATE TABLE IF NOT EXISTS crawled_tenders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kode_tender VARCHAR(50),
    kd_lpse INT,
    nama_lpse VARCHAR(500),
    nama_paket TEXT,
    instansi TEXT,
    pagu NUMERIC,
    hps NUMERIC,
    kategori VARCHAR(255),
    metode_pemilihan VARCHAR(255),
    status_tender VARCHAR(255),
    lokasi TEXT,
    tahun_anggaran INT,
    slug VARCHAR(100),
    raw_data JSONB,
    crawled_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(kode_tender, kd_lpse)
);

-- ═══ Crawl Log ═══
CREATE TABLE IF NOT EXISTS crawl_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    total_lpse INT,
    total_tenders INT,
    total_konstruksi INT,
    status VARCHAR(50) DEFAULT 'running',
    error TEXT
);

-- ═══ Letters / Surat ═══
CREATE TABLE IF NOT EXISTS letters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id),
    nomor_urut INT NOT NULL,
    kode_surat VARCHAR(10) NOT NULL,        -- SK, SP, ST, etc
    bulan INT NOT NULL,
    tahun INT NOT NULL,
    nomor_surat VARCHAR(100) NOT NULL,       -- Generated: 005/SK/CV.GM/V/2026
    perihal TEXT,
    tanggal DATE,
    konten TEXT,
    template_id UUID REFERENCES templates(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crawled_tenders_lpse ON crawled_tenders(kd_lpse);
CREATE INDEX IF NOT EXISTS idx_crawled_tenders_tahun ON crawled_tenders(tahun_anggaran);
CREATE INDEX IF NOT EXISTS idx_crawled_tenders_crawled ON crawled_tenders(crawled_at);
CREATE INDEX IF NOT EXISTS idx_personnel_ska ON personnel_ska(personnel_id);
CREATE INDEX IF NOT EXISTS idx_letters_company ON letters(company_id);
CREATE INDEX IF NOT EXISTS idx_letters_nomor ON letters(nomor_urut, kode_surat, tahun);

-- RLS (Note: the project currently uses a global allow-all approach for development)
-- Here we're applying the same pattern as existing tables
