/**
 * Validasi hasil ekstraksi LDP — alat training/batch-check.
 *
 * Cara pakai:
 *   node services/train_check.js file.pdf        # pakai jalur koordinat (rekonstruksi tabel)
 *   node services/train_check.js file.txt        # jalur text-streamaja
 *   node services/train_check.js folder/*.pdf    # banyak file
 *
 * Yang dicek (objektif, bukan asumsi substring utk nilai yg disusun dari beberapa
 * potongan non-kontigu karena kolom PDF interleaved):
 *   - field wajib terisi
 *   - tabel personel wajib ada & punya baris
 *   - tidak ada nomor halaman / paraf / placeholder / entri daftar isi yg bocor ke sel
 *   - tidak ada sel yg menyerap item daftar berikutnya
 *   - kolom Jabatan tidak boleh membawa angka pengalaman/jumlah
 *   - nomor baris berurutan
 */
const fs = require('fs');
const path = require('path');
const { extractLdp } = require('./dokpil_extract');

const PAGE = /^\s*[-–—]\s*\d+\s*[-–—]\s*$/;                 // "- 73 -"
const PARA = /^\s*Paraf\b/i;                                   // "Paraf 1 Paraf 2 Paraf 3"
const PLACE = /_{3,}|\.{4,}|\[diisi|\(tulis|\bdst\b/i;        // placeholder / instruksi isian
const TOC = /\.{4,}.*\d+\s*$/;                                 // entri daftar isi
const NEXTITEM = /\b[a-z]\.\s+[A-Z]|\b\d{1,2}\.\s+[A-Z][a-z]{3,}/;
const LEAK = /\b(\d+)\s*(tahun|thn|th|orang|personil)\b/i;    // pengalaman/jumlah nyangkut

function check(r) {
    const issues = [];
    const push = (m) => issues.push(m);

    for (const k of ['pokja', 'nama_paket', 'lokasi', 'jangka_waktu', 'pagu_anggaran']) {
        if (!r.fields[k]) push(`field kosong: ${k}`);
    }
    if (!r.tables.personel) push('tabel personel TIDAK ADA');
    else if (!r.tables.personel.rows.length) push('tabel personel kosong (0 baris)');

    for (const [tn, tb] of Object.entries(r.tables)) {
        tb.rows.forEach((row) => {
            row.forEach((cell, ci) => {
                const v = String(cell || '').trim();
                if (!v) return;
                if (PAGE.test(v)) push(`${tn}[${row[0]}] c${ci} nomor halaman: ${JSON.stringify(v)}`);
                if (PARA.test(v)) push(`${tn}[${row[0]}] c${ci} paraf: ${JSON.stringify(v)}`);
                if (PLACE.test(v)) push(`${tn}[${row[0]}] c${ci} placeholder/instruksi: ${JSON.stringify(v.slice(0, 60))}`);
                if (TOC.test(v)) push(`${tn}[${row[0]}] c${ci} entri daftar isi: ${JSON.stringify(v.slice(0, 60))}`);
                if (NEXTITEM.test(v)) push(`${tn}[${row[0]}] c${ci} serap item daftar berikut: ${JSON.stringify(v.slice(0, 70))}`);
            });
            if (tn === 'personel' && !String(row[row.length - 1] || '').trim())
                push(`personel[${row[0]}] sertifikat kosong → baris terpotong`);
            if (tn === 'personel' && LEAK.test(String(row[1] || '')))
                push(`personel[${row[0]}] Jabatan membawa angka: ${JSON.stringify(String(row[1]).slice(0, 60))}`);
        });
        const nos = tb.rows.map((x) => x[0]);
        if (nos.length && nos.some((n, i) => n !== String(i + 1)))
            push(`${tn} nomor baris tak berurutan: ${JSON.stringify(nos)}`);
    }
    return issues;
}

async function load(file) {
    if (/\.pdf$/i.test(file)) {
        const { parsePdf } = require('./pdf_geom');
        const { text, items } = await parsePdf(fs.readFileSync(file));
        return extractLdp(text, items);
    }
    return extractLdp(fs.readFileSync(file, 'utf8'));
}

(async () => {
    const files = process.argv.slice(2);
    if (!files.length) { console.log('pakai: node services/train_check.js <file.pdf|file.txt> ...'); process.exit(0); }
    let bad = 0;
    for (const f of files) {
        let issues = [];
        try { issues = check(await load(f)); }
        catch (e) { issues = ['ERROR ' + e.message]; }
        if (issues.length) { bad++; console.log(`✗ ${path.basename(f)}  (${issues.length} isu)`); issues.slice(0, 6).forEach((i) => console.log('     - ' + i)); }
        else console.log(`✓ ${path.basename(f)}`);
    }
    console.log(`\n=== ${files.length - bad}/${files.length} bersih ===`);
})().catch((e) => { console.log('ERR', e.message); process.exit(1); });
