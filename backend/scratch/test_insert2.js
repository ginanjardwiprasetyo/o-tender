require('dotenv').config();
const db = require('../config/db');
const axios = require('axios');

async function main() {
    const resp = await axios.get('https://isb.lkpp.go.id/isb-2/api/satudata/TenderUmumPublik/2026/42', { timeout: 15000 });
    const tenders = Array.isArray(resp.data) ? resp.data : [];
    const t = tenders.find(x => (x['Kategori Pekerjaan']||'').toLowerCase().includes('konstruksi'));
    if (!t) { console.log('no konstruksi'); process.exit(0); }
    
    console.log('Kode Tender type:', typeof t['Kode Tender'], 'value:', t['Kode Tender']);
    console.log('Pagu type:', typeof t.Pagu, 'value:', t.Pagu);
    console.log('HPS type:', typeof t.HPS, 'value:', t.HPS);
    
    const kdLpseInt = parseInt(42);
    const paguVal = Math.round(parseFloat(t.Pagu || 0)) || 0;
    const hpsVal = Math.round(parseFloat(t.HPS || 0)) || 0;
    const jp = t.jadwal_penawaran;
    const batasUpload = (jp && typeof jp === 'object') ? (jp.tanggal_akhir || jp.berakhir || null) : null;
    let rawData = null;
    try { rawData = JSON.parse(JSON.stringify(t)); } catch {}
    
    const params = [
        String(t['Kode Tender'] || ''), kdLpseInt, 'LPSE Jateng',
        t['Nama Paket'] || '', t.Instansi || 'LPSE Jateng',
        paguVal, hpsVal, 'Pekerjaan Konstruksi',
        t['Metode Pemilihan'] || '-', t['Status_Tender'] || '-',
        t.lokasi_paket ? JSON.stringify(t.lokasi_paket) : null,
        parseInt(2026), 'jateng', rawData, t.SBU || null, batasUpload
    ];
    
    console.log('\nParam types:');
    params.forEach((p, i) => {
        console.log(`  $${i+1}: ${typeof p} = ${JSON.stringify(p) ? JSON.stringify(p).substring(0,50) : 'null'}`);
    });
    
    try {
        await db.query(`
            INSERT INTO crawled_tenders (
                kode_tender, kd_lpse, nama_lpse, nama_paket, instansi, 
                pagu, hps, kategori, metode_pemilihan, status_tender, 
                lokasi, tahun_anggaran, slug, raw_data, sbu, batas_upload
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            ON CONFLICT (kode_tender, kd_lpse) 
            DO UPDATE SET 
                nama_paket       = EXCLUDED.nama_paket,
                instansi         = EXCLUDED.instansi,
                pagu             = EXCLUDED.pagu,
                hps              = EXCLUDED.hps,
                status_tender    = EXCLUDED.status_tender,
                kategori         = EXCLUDED.kategori,
                metode_pemilihan = EXCLUDED.metode_pemilihan,
                lokasi           = EXCLUDED.lokasi,
                slug             = EXCLUDED.slug,
                raw_data         = EXCLUDED.raw_data,
                sbu = CASE 
                    WHEN crawled_tenders.sbu IS NULL OR crawled_tenders.sbu = '-' 
                    THEN EXCLUDED.sbu 
                    ELSE crawled_tenders.sbu 
                END,
                batas_upload = CASE 
                    WHEN EXCLUDED.batas_upload IS NOT NULL AND EXCLUDED.batas_upload != '-' 
                    THEN EXCLUDED.batas_upload 
                    ELSE crawled_tenders.batas_upload 
                END,
                crawled_at = NOW()
        `, params);
        console.log('\nINSERT OK');
    } catch(e) {
        console.error('\nINSERT ERROR:', e.message);
        console.error('Detail:', e.detail);
        console.error('Hint:', e.hint);
    }
    process.exit(0);
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
