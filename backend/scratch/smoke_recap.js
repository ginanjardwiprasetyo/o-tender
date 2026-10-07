// Smoke test logika sel rekap (tender-recap.js) + field peserta per perusahaan dari eval_scraper
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function assert(cond, msg) {
    if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; }
    else console.log('OK:', msg);
}

// ── 1. Load TenderRecapPage dengan stub Fmt/lucide ──
const code = fs.readFileSync(path.join(__dirname, '../../frontend/js/pages/tender-recap.js'), 'utf8');
const sandbox = {
    Fmt: { escape: s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])), rupiah: n => 'Rp ' + n },
    lucide: { createIcons() {} },
    document: { getElementById: () => null }, // renderTable return early saat el null
    Modal: { open(t, b, f, o) { this.last = { t, b, f, o }; } },
    console
};
vm.createContext(sandbox);
vm.runInContext(code + '\n;globalThis.__page = TenderRecapPage;', sandbox);
const page = sandbox.__page;
assert(!!page && typeof page._cell === 'function', 'TenderRecapPage termuat');

const compA = { nama_perusahaan: 'CV Natamarga' };
const compB = { nama_perusahaan: 'CV Garrel Multi Perkasa' };
const none = '<span class="recap-none">—</span>';

// _cocok tanpa awalan cv/pt (nama di laman hasil bisa "GARREL MULTI PERKASA")
assert(page._cocok('GARREL MULTI PERKASA', 'CV Garrel Multi Perkasa'), '_cocok: nama tanpa awalan CV tetap match');
assert(page._cocok('CV. UTAMA GRAHA MANDIRI', 'CV Utama Graha Mandiri'), '_cocok: beda kapital/tanda baca tetap match');
assert(!page._cocok('CV. SETIA BUDI', 'CV Garrel Multi Perkasa'), '_cocok: nama lain tidak ikut match');
assert(!page._cocok('CV. UTAMA KARYA', 'CV Utama Graha Mandiri'), '_cocok: sebagian kata tidak cukup');

// Kalah + alasan per perusahaan → tombol Alasan (popup), teks tidak lagi inline di sel
const kalah = {
    status: 'Kalah', kode_tender: '10166213000', slug: 'slemankab',
    history_alasan: 'Tidak melampirkan FHO sesuai yang dipersyaratkan',
    history_peserta: [
        { nama: 'CV.Utama Graha Mandiri', alasan: '' },
        { nama: 'CV Nata Marga', alasan: 'Tidak melampirkan FHO sesuai yang dipersyaratkan' }
    ]
};
page._alasanBag = [];
const cellAlasan = page._cell(kalah, compA);
assert(cellAlasan.includes('Kalah') && cellAlasan.includes('showAlasan'), 'Kalah + alasan → badge + ikon segitiga pemicu');
assert(cellAlasan.includes('alert-triangle') && cellAlasan.includes('alasan-trigger'), 'pemicu = ikon segitiga ! menempel pada badge Kalah');
assert(!cellAlasan.includes('Tidak melampirkan'), 'alasan tidak lagi inline di sel');
assert(page._alasanBag.length === 1 && page._alasanBag[0].alasan.includes('Tidak melampirkan FHO'), 'alasan masuk bag popup sesuai nama');
assert(page._cell(kalah, compB) === none, 'perusahaan tak ada di hasil → —');
const cellTanpaAlasan = page._cell({ ...kalah, history_peserta: [{ nama: 'CV Nata Marga', alasan: '' }] }, compA);
assert(cellTanpaAlasan.includes('Kalah') && !cellTanpaAlasan.includes('showAlasan'), 'peserta tanpa alasan → badge saja tanpa tombol');

// Baris lama tanpa history_peserta → tombol Alasan dari history_alasan; kosong → badge saja
const legacyKalah = { status: 'Kalah', kode_tender: 'X', slug: 's', history_alasan: 'Gugur', history_peserta: null };
page._alasanBag = [];
const legacyCell = page._cell(legacyKalah, compB);
assert(legacyCell.includes('showAlasan') && page._alasanBag[0].alasan === 'Gugur', 'legacy Kalah: tombol Alasan + isi bag');
const legacyKosong = { status: 'Kalah', kode_tender: 'X', slug: 's', history_alasan: '', history_peserta: null };
assert(legacyKosong && page._cell(legacyKosong, compB).includes('Kalah') && !page._cell(legacyKosong, compB).includes('showAlasan'), 'legacy tanpa alasan → badge saja');

// Menang + pemenang cocok → badge di kolom pemenang saja
const menang = { status: 'Menang', kode_tender: 'Y', slug: 's', history_alasan: 'Pemenang: CV Natamarga', history_peserta: [{ nama: 'CV Natamarga', alasan: '' }] };
assert(page._cell(menang, compA).includes('Menang'), 'Menang: badge di kolom pemenang');
assert(page._cell(menang, compB) === none, 'Menang: kolom lain —');

// Diproses → badge info
assert(page._cell({ status: 'Diproses', kode_tender: 'Z', slug: 's' }, compA).includes('Diproses'), 'Diproses: badge info');

// XSS: alasan tak muncul inline & popup meng-escape; popup = teks murni (tanpa tombol/link)
const evil = { status: 'Kalah', kode_tender: 'E', slug: 's', history_alasan: '<img src=x>', history_peserta: null };
page._alasanBag = [];
assert(!page._cell(evil, compA).includes('<img'), 'alasan tak inline di sel');
const popHtml = page._alasanHtml(0);
assert(popHtml && !popHtml.includes('<img') && popHtml.includes('&lt;img'), 'popup alasan escape HTML');
assert(!popHtml.includes('<button') && !popHtml.includes('<a ') && !popHtml.includes('Buka SPSE'), 'popup hanya teks — tanpa tombol/buka SPSE/silang');
assert(page._alasanHtml(99) === '', 'index tak ada → html kosong');

// ── 1b. TenderManagePage: badge Kalah(n)/Menang(n) ──
const mCode = fs.readFileSync(path.join(__dirname, '../../frontend/js/pages/tender-manage.js'), 'utf8');
vm.runInContext(mCode + '\n;globalThis.__manage = TenderManagePage;', sandbox);
const manage = sandbox.__manage;
assert(!!manage && typeof manage._statusBadge === 'function', 'TenderManagePage termuat');
manage.companies = [
    { nama_perusahaan: 'CV Utama Graha Mandiri' },
    { nama_perusahaan: 'CV Natamarga' },
    { nama_perusahaan: 'CV Garrel Multi Perkasa' }
];
const bKalah2 = manage._statusBadge({ status: 'Kalah', history_peserta: [{ nama: 'a', alasan: '' }, { nama: 'b', alasan: '' }] });
assert(bKalah2.includes('Kalah(2)'), 'badge Kalah = Kalah(jml perusahaan): ' + bKalah2);
assert(manage._statusBadge({ status: 'Kalah', history_peserta: [] }).includes('Kalah<'), 'Kalah tanpa data peserta → tanpa angka');
const bMenang = manage._statusBadge({ status: 'Menang', history_pemenang: 'CV Natamarga' });
assert(bMenang.includes('Menang(1)'), 'badge Menang = Menang(jml pemenang): ' + bMenang);
assert(manage._statusBadge({ status: 'Diproses' }).includes('Diproses'), 'Diproses tanpa angka');
assert(manage.perPage === 10, 'Tender Saya pagination 10/halaman');

// ── 2. eval_scraper: peserta = [{nama, alasan}], pemenang, tanpa teks karangan ──
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { checkWinLose, getPemenang } = require('../services/eval_scraper');
(async () => {
    const r = await checkWinLose('slemankab', '10166213000', ['CV Natamarga', 'CV Garrel Multi Perkasa', 'CV Utama Graha Mandiri']);
    console.log('checkWinLose Kalah =', JSON.stringify(r));
    assert(r.success && r.isMenang === false && Array.isArray(r.peserta) && r.peserta.length > 0, 'verdict Kalah tercapai');
    assert(r.peserta.every(p => typeof p.nama === 'string' && typeof p.alasan === 'string'), 'peserta = [{nama, alasan}]');
    assert(!r.peserta.some(p => /Gugur|Tidak Lulus Evaluasi|^Pemenang:/.test(p.alasan)), 'tanpa teks karangan');
    assert(r.peserta.some(p => p.alasan), 'ada baris dengan alasan asli dari laman hasil');
    assert(r.pemenang === 'CV. CITRA PERKASA', 'field pemenang terisi: ' + r.pemenang);

    const rWin = await checkWinLose('slemankab', '10166213000', ['CV CITRA PERKASA']);
    console.log('checkWinLose Menang =', JSON.stringify(rWin));
    assert(rWin.success && rWin.isMenang && rWin.peserta[0].nama === 'CV. CITRA PERKASA', 'Menang: peserta[0].nama = pemenang');
    assert(rWin.pemenang === 'CV. CITRA PERKASA', 'Menang: field pemenang terisi');

    // getPemenang ringan tanpa hasil page
    const pem = await getPemenang('slemankab', '10166213000');
    assert(pem.valid && pem.winner === 'CV. CITRA PERKASA', 'getPemenang standalone: ' + JSON.stringify(pem));

    // _cellPemenang dari data DB asli
    const db = require('../config/db');
    const { rows: tRows } = await db.query("SELECT * FROM followed_tenders WHERE kode_tender = '10166213000'");
    const row = tRows[0];
    page.companies = [{ nama_perusahaan: 'CV Natamarga' }, { nama_perusahaan: 'CV Utama Graha Mandiri' }, { nama_perusahaan: 'CV Garrel Multi Perkasa' }];
    const pm = page._cellPemenang(row);
    assert(pm.includes('CV. CITRA PERKASA'), 'kolom pemenang terisi dari history_pemenang');
    assert(page._cellPemenang({ status: 'Diproses' }).includes('—'), 'proyek belum diumumkan → —');

    // Pagination: 14 proyek → 2 halaman, 10 per halaman
    const { rows: all } = await db.query('SELECT * FROM followed_tenders ORDER BY followed_at DESC');
    page.tenders = all;
    page.page = 1;
    const total = Math.ceil(page.tenders.length / page.perPage);
    const p1 = page.tenders.slice(0, page.perPage);
    assert(page.perPage === 10 && p1.length <= 10 && total === Math.ceil(all.length / 10), `pagination: ${all.length} proyek → ${total} halaman @10`);
    page.goto(99); assert(page.page === total, 'goto clamp ke halaman terakhir');
    page.goto(-5); assert(page.page === 1, 'goto clamp ke halaman 1');
    page.page = 1;

    console.log(process.exitCode ? 'SMOKE TEST FAILED' : 'SMOKE TEST PASSED');
    process.exit(process.exitCode || 0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
