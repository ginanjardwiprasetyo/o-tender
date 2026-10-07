// Backfill satu-kali: isi history_peserta + history_alasan (alasan asli per perusahaan
// dari laman hasil) untuk baris Kalah lama yang masih alasan karangan.
// Aman dijalankan berulang — hanya proses baris yang history_peserta IS NULL.
// `node backfill-peserta.js --all` → proses ulang SEMUA baris Kalah (refresh setelah
// matcher nama diperbaiki, mis. "GARREL MULTI PERKASA" tanpa awalan CV).
// Status TIDAK di-reset; hanya dikoreksi ke Menang bila bukti pemenang menunjukkan kita menang.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../config/db');
const { checkWinLose, getPemenang } = require('../services/eval_scraper');

const ALL = process.argv.includes('--all');

(async () => {
    const { rows: companies } = await db.query('SELECT nama_perusahaan FROM companies');
    const companyNames = companies.map(c => c.nama_perusahaan).filter(Boolean);
    const where = ALL
        ? "status = 'Kalah'"
        : "status = 'Kalah' AND history_peserta IS NULL";
    const { rows } = await db.query(
        `SELECT id, kode_tender, slug, status FROM followed_tenders WHERE ${where} ORDER BY id`
    );
    console.log(`${rows.length} baris Kalah tanpa history_peserta`);

    for (const t of rows) {
        const r = await checkWinLose(t.slug, t.kode_tender, companyNames);
        if (!r.success) {
            if (r.error === 'Perusahaan tidak terdaftar sebagai peserta') {
                // Tidak ada di laman hasil → alasan kosong (karangan lama dibuang)
                await db.query("UPDATE followed_tenders SET history_alasan = '', history_peserta = '[]'::jsonb WHERE id = $1", [t.id]);
                console.log(`KOSONG ${t.kode_tender} (${t.slug}): tidak ada di laman hasil → alasan dikosongkan`);
            } else {
                console.log(`SKIP  ${t.kode_tender} (${t.slug}): ${r.error} — jalankan ulang script ini`);
            }
            continue;
        }
        const alasan = r.isMenang
            ? (r.bukti || 'Pemenang terverifikasi')
            : ((r.peserta.find(p => p.alasan) || {}).alasan || '');
        await db.query(
            `UPDATE followed_tenders SET status = $1, history_alasan = $2, history_peserta = $3::jsonb WHERE id = $4`,
            [r.isMenang ? 'Menang' : 'Kalah', alasan, JSON.stringify(r.peserta), t.id]
        );
        console.log(`${r.isMenang ? 'MENANG' : 'KALAH '} ${t.kode_tender} (${t.slug}): ` +
            r.peserta.map(p => `${p.nama}="${p.alasan || '(kosong)'}"`).join(' | '));
    }

    // Pass 2: isi history_pemenang (nama pemenang dari halaman pemenang)
    const { rows: belum } = await db.query(
        "SELECT id, kode_tender, slug FROM followed_tenders WHERE history_pemenang IS NULL ORDER BY id"
    );
    console.log(`\n${belum.length} baris tanpa history_pemenang`);
    for (const t of belum) {
        const pem = await getPemenang(t.slug, t.kode_tender);
        if (!pem.valid) { console.log(`SKIP  ${t.kode_tender} (${t.slug}): ${pem.error} — jalankan ulang script ini`); continue; }
        // valid tapi winner null → '' (belum diumumkan) supaya tidak diulang terus
        await db.query('UPDATE followed_tenders SET history_pemenang = $1 WHERE id = $2', [pem.winner || '', t.id]);
        console.log(`PEMENANG ${t.kode_tender} (${t.slug}): ${pem.winner || '(belum diumumkan)'}`);
    }
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
