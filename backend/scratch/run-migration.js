/**
 * Run Migration via Supabase Management API
 * Jalankan: node scratch/run-migration.js
 * 
 * Butuh SUPABASE_ACCESS_TOKEN dari: https://supabase.com/dashboard/account/tokens
 * Tambahkan ke .env: SUPABASE_ACCESS_TOKEN=sbp_xxxxx
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

// Extract project ref dari URL: https://xsrvztxlgaljgqpzovny.supabase.co
const projectRef = SUPABASE_URL ? SUPABASE_URL.replace('https://', '').split('.')[0] : null;

if (!projectRef) {
    console.error('❌ SUPABASE_URL tidak ditemukan di .env');
    process.exit(1);
}

if (!ACCESS_TOKEN) {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  SUPABASE_ACCESS_TOKEN tidak ditemukan!');
    console.log('');
    console.log('Cara mendapatkan Access Token:');
    console.log('1. Buka https://supabase.com/dashboard/account/tokens');
    console.log('2. Klik "Generate new token"');
    console.log('3. Tambahkan ke backend/.env:');
    console.log('   SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxx');
    console.log('4. Jalankan ulang: node backend/scratch/run-migration.js');
    console.log('');
    console.log('ATAU jalankan SQL langsung di Supabase Dashboard:');
    console.log(`   https://supabase.com/dashboard/project/${projectRef}/sql/new`);
    console.log('   Copy-paste isi file: backend/migrations/001_init.sql');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(0);
}

const SQL = `
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS tenders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kode_tender BIGINT,
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

CREATE TABLE IF NOT EXISTS tender_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tender_id UUID REFERENCES tenders(id) ON DELETE CASCADE,
    stage_name VARCHAR(255) NOT NULL,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    reminded_start BOOLEAN DEFAULT FALSE,
    reminded_end BOOLEAN DEFAULT FALSE
);

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

CREATE TABLE IF NOT EXISTS education_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    personnel_id UUID REFERENCES personnel(id) ON DELETE CASCADE,
    lembaga VARCHAR(255) NOT NULL,
    tempat VARCHAR(255),
    tahun_tamat INT
);

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

CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama_template VARCHAR(255) NOT NULL,
    kategori VARCHAR(100),
    html_content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS tender_personnel_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tender_id UUID REFERENCES tenders(id) ON DELETE CASCADE,
    personnel_id UUID REFERENCES personnel(id),
    jabatan VARCHAR(255),
    urutan INT
);

CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tenders' AND policyname='Allow all') THEN
    CREATE POLICY "Allow all" ON tenders FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tender_schedules' AND policyname='Allow all') THEN
    CREATE POLICY "Allow all" ON tender_schedules FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='equipments' AND policyname='Allow all') THEN
    CREATE POLICY "Allow all" ON equipments FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='personnel' AND policyname='Allow all') THEN
    CREATE POLICY "Allow all" ON personnel FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='education_history' AND policyname='Allow all') THEN
    CREATE POLICY "Allow all" ON education_history FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='experience_history' AND policyname='Allow all') THEN
    CREATE POLICY "Allow all" ON experience_history FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='templates' AND policyname='Allow all') THEN
    CREATE POLICY "Allow all" ON templates FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tender_documents' AND policyname='Allow all') THEN
    CREATE POLICY "Allow all" ON tender_documents FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tender_personnel_assignments' AND policyname='Allow all') THEN
    CREATE POLICY "Allow all" ON tender_personnel_assignments FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='settings' AND policyname='Allow all') THEN
    CREATE POLICY "Allow all" ON settings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tender_schedules_tender ON tender_schedules(tender_id);
CREATE INDEX IF NOT EXISTS idx_tender_schedules_dates ON tender_schedules(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_education_personnel ON education_history(personnel_id);
CREATE INDEX IF NOT EXISTS idx_experience_personnel ON experience_history(personnel_id);
CREATE INDEX IF NOT EXISTS idx_assignments_tender ON tender_personnel_assignments(tender_id);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
`;

function runSQL(sql) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ query: sql });
        const options = {
            hostname: 'api.supabase.com',
            path: `/v1/projects/${projectRef}/database/query`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(json);
                    } else {
                        reject(new Error(json.message || json.error || `HTTP ${res.statusCode}`));
                    }
                } catch {
                    reject(new Error(`Parse error: ${data.substring(0, 200)}`));
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function main() {
    console.log(`\n🚀 Menjalankan migration ke project: ${projectRef}\n`);
    try {
        await runSQL(SQL);
        console.log('✅ Migration berhasil dijalankan!');
        console.log('\n🎉 Semua tabel sudah dibuat. Coba akses: http://localhost:3000');
    } catch (err) {
        console.error('❌ Migration gagal:', err.message);
        console.log('\nCoba jalankan SQL manual di:');
        console.log(`https://supabase.com/dashboard/project/${projectRef}/sql/new`);
    }
}

main();
