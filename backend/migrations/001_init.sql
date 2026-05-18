-- ═══════════════════════════════════════════════════════════
-- TenderBuild — Supabase Database Migration
-- Run this SQL in your Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Tenders ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kode_tender INT,
    kd_lpse INT,
    nama_lpse VARCHAR(500),
    nama_paket TEXT NOT NULL,
    instansi TEXT,
    satker TEXT,
    pagu NUMERIC,
    hps NUMERIC,
    kategori_pekerjaan VARCHAR(255),
    metode_pemilihan VARCHAR(255),
    metode_evaluasi VARCHAR(255),
    status_tender VARCHAR(100),
    status_internal VARCHAR(50) DEFAULT 'Persiapan',
    lokasi_paket JSONB,
    anggaran JSONB,
    jadwal_pengumuman JSONB,
    jadwal_penawaran JSONB,
    jumlah_pendaftar INT,
    jumlah_penawar INT,
    catatan TEXT,
    is_followed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Tender Schedules ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS tender_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tender_id UUID REFERENCES tenders(id) ON DELETE CASCADE,
    stage_name VARCHAR(255) NOT NULL,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    reminded_start BOOLEAN DEFAULT FALSE,
    reminded_end BOOLEAN DEFAULT FALSE
);

-- ─── Equipments ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    jenis VARCHAR(255) NOT NULL,
    kapasitas VARCHAR(100),
    jumlah INT,
    tahun_produksi INT,
    merk_type VARCHAR(255),
    kondisi VARCHAR(50) DEFAULT 'Baik',
    lokasi_sekarang VARCHAR(255),
    bukti_kepemilikan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Personnel ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personnel (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama VARCHAR(255) NOT NULL,
    tempat_lahir VARCHAR(100),
    tanggal_lahir DATE,
    tingkat_pendidikan VARCHAR(50),
    tahun_pengalaman INT,
    sertifikat_keahlian TEXT,
    no_registrasi_ska VARCHAR(100),
    ijasah_ref TEXT,
    foto_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Education History ────────────────────────────────────
CREATE TABLE IF NOT EXISTS education_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    personnel_id UUID REFERENCES personnel(id) ON DELETE CASCADE,
    lembaga VARCHAR(255) NOT NULL,
    tempat VARCHAR(255),
    tahun_tamat INT
);

-- ─── Experience History ───────────────────────────────────
CREATE TABLE IF NOT EXISTS experience_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    personnel_id UUID REFERENCES personnel(id) ON DELETE CASCADE,
    tahun VARCHAR(50),
    nama_kegiatan TEXT,
    lokasi VARCHAR(255),
    pengguna_jasa TEXT,
    perusahaan VARCHAR(255),
    uraian_tugas TEXT,
    waktu_pelaksanaan VARCHAR(100),
    posisi VARCHAR(255)
);

-- ─── Templates ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama_template VARCHAR(255) NOT NULL,
    kategori VARCHAR(100),
    html_content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Tender Documents ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS tender_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tender_id UUID REFERENCES tenders(id) ON DELETE CASCADE,
    template_id UUID REFERENCES templates(id),
    personnel_snapshot JSONB,
    equipment_snapshot JSONB,
    org_structure JSONB,
    generated_html TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Tender Personnel Assignments ─────────────────────────
CREATE TABLE IF NOT EXISTS tender_personnel_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tender_id UUID REFERENCES tenders(id) ON DELETE CASCADE,
    personnel_id UUID REFERENCES personnel(id),
    jabatan VARCHAR(255),
    urutan INT
);

-- ─── Settings ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Disable RLS for development ──────────────────────────
ALTER TABLE tenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tender_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE experience_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tender_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tender_personnel_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow all operations with anon key (dev mode)
CREATE POLICY "Allow all" ON tenders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON tender_schedules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON equipments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON personnel FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON education_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON experience_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON tender_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON tender_personnel_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON settings FOR ALL USING (true) WITH CHECK (true);

-- ─── Indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tender_schedules_tender ON tender_schedules(tender_id);
CREATE INDEX IF NOT EXISTS idx_tender_schedules_dates ON tender_schedules(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_education_personnel ON education_history(personnel_id);
CREATE INDEX IF NOT EXISTS idx_experience_personnel ON experience_history(personnel_id);
CREATE INDEX IF NOT EXISTS idx_assignments_tender ON tender_personnel_assignments(tender_id);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
