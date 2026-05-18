require('dotenv').config();
const db = require('../config/db');

async function main() {
    // Test 1: year as number
    try {
        const r = await db.query('SELECT kode_tender FROM crawled_tenders WHERE tahun_anggaran = $1 LIMIT 1', [2026]);
        console.log('number year OK:', r.rows.length);
    } catch(e) {
        console.error('number year ERROR:', e.message);
    }
    
    // Test 2: year as string
    try {
        const r = await db.query('SELECT kode_tender FROM crawled_tenders WHERE tahun_anggaran = $1 LIMIT 1', ['2026']);
        console.log('string year OK:', r.rows.length);
    } catch(e) {
        console.error('string year ERROR:', e.message);
    }
    
    // Test 3: deepScanMissingData query with string year
    try {
        const r = await db.query(`
            SELECT kode_tender, slug FROM crawled_tenders 
            WHERE tahun_anggaran = $1 AND (sbu IS NULL OR sbu = '-' OR batas_upload IS NULL OR batas_upload = '-')
            ORDER BY crawled_at DESC LIMIT 5
        `, ['2026']);
        console.log('deepScan string year OK:', r.rows.length);
    } catch(e) {
        console.error('deepScan string year ERROR:', e.message);
    }
    
    // Test 4: INSERT with string year
    try {
        await db.query(`
            INSERT INTO crawled_tenders (kode_tender, kd_lpse, nama_lpse, nama_paket, instansi, pagu, hps, kategori, metode_pemilihan, status_tender, lokasi, tahun_anggaran, slug, raw_data, sbu, batas_upload)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            ON CONFLICT (kode_tender, kd_lpse) DO NOTHING
        `, ['TEST-STR-YEAR', 21, 'Test', 'Test', 'Test', 0, 0, 'Pekerjaan Konstruksi', '-', '-', null, '2026', 'test', null, null, null]);
        console.log('INSERT string year OK');
    } catch(e) {
        console.error('INSERT string year ERROR:', e.message);
    }
    
    process.exit(0);
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
