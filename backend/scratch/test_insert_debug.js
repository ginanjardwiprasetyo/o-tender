/**
 * Debug script to reproduce the 'operator does not exist: integer = text' error
 */
require('dotenv').config();
const db = require('../config/db');
const axios = require('axios');

async function main() {
    // Fetch a real konstruksi tender from LPSE 285 (Bantul)
    const resp = await axios.get('https://isb.lkpp.go.id/isb-2/api/satudata/TenderUmumPublik/2026/285', { timeout: 15000 });
    const tenders = Array.isArray(resp.data) ? resp.data : [];
    const konstruksi = tenders.filter(t => {
        const cat = (t['Kategori Pekerjaan'] || '').toLowerCase();
        return cat.includes('konstruksi') && !cat.includes('konsultansi');
    });
    console.log('konstruksi count for LPSE 285:', konstruksi.length);

    if (konstruksi.length > 0) {
        const t = konstruksi[0];
        console.log('sample tender keys:', Object.keys(t));
        console.log('Pagu:', t.Pagu, typeof t.Pagu);
        console.log('HPS:', t.HPS, typeof t.HPS);
        console.log('Kode Tender:', t['Kode Tender'], typeof t['Kode Tender']);
        console.log('jadwal_penawaran:', JSON.stringify(t.jadwal_penawaran));

        const kdLpseInt = parseInt(285);
        const instansi = t.Instansi || t.instansi ||
            (Array.isArray(t['Instansi dan Satker']) ? t['Instansi dan Satker'][0]?.nama_instansi : null) ||
            'LPSE Kabupaten Bantul';
        const jp = t['jadwal_penawaran'] || t.jadwal_penawaran;
        const batasUpload = t['Batas Upload'] || t.batas_upload ||
            (jp && typeof jp === 'object' ? jp.tanggal_akhir || jp.berakhir : null) || null;
        const paguVal = Math.round(parseFloat(t.Pagu || t.pagu || 0)) || 0;
        const hpsVal = Math.round(parseFloat(t.HPS || t.hps || 0)) || 0;
        let rawData = null;
        try { rawData = JSON.parse(JSON.stringify(t)); } catch { rawData = null; }

        console.log('\nParams:');
        console.log('$1 kode_tender:', String(t['Kode Tender'] || ''), typeof String(t['Kode Tender'] || ''));
        console.log('$2 kd_lpse:', kdLpseInt, typeof kdLpseInt);
        console.log('$6 pagu:', paguVal, typeof paguVal);
        console.log('$7 hps:', hpsVal, typeof hpsVal);
        console.log('$12 tahun_anggaran:', parseInt(2026), typeof parseInt(2026));
        console.log('$15 sbu:', t.SBU, typeof t.SBU);
        console.log('$16 batas_upload:', batasUpload, typeof batasUpload);

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
            `, [
                String(t['Kode Tender'] || t.kode_tender || ''),
                kdLpseInt,
                'LPSE Kabupaten Bantul',
                t['Nama Paket'] || t.nama_paket || '',
                instansi,
                paguVal,
                hpsVal,
                'Pekerjaan Konstruksi',
                t['Metode Pemilihan'] || t.metode_pemilihan || '-',
                t['Status_Tender'] || t['Status Tender'] || t.status_tender || '-',
                t.lokasi_paket ? JSON.stringify(t.lokasi_paket) : null,
                parseInt(2026),
                'bantul',
                rawData,
                t.SBU || null,
                batasUpload
            ]);
            console.log('\nINSERT OK');
        } catch (e) {
            console.error('\nINSERT ERROR:', e.message);
        }
    } else {
        // Try LPSE 42 (Jawa Tengah)
        const resp2 = await axios.get('https://isb.lkpp.go.id/isb-2/api/satudata/TenderUmumPublik/2026/42', { timeout: 15000 });
        const t2 = Array.isArray(resp2.data) ? resp2.data : [];
        const k2 = t2.filter(t => {
            const cat = (t['Kategori Pekerjaan'] || '').toLowerCase();
            return cat.includes('konstruksi') && !cat.includes('konsultansi');
        });
        console.log('konstruksi count for LPSE 42:', k2.length);
        if (k2.length > 0) console.log('sample:', JSON.stringify(k2[0]).substring(0, 500));
    }

    process.exit(0);
}

main().catch(e => { console.error('FATAL:', e.message, e.stack); process.exit(1); });
