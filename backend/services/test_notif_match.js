// Cek cepat logika match notifikasi SBU + kata kunci — jalankan: node services/test_notif_match.js (dari backend/)
const assert = require('assert');
const crawler = require('./crawler');

const set = (sbu, kw) => {
    crawler.status.waTargetSbu = sbu;
    crawler.status.waTargetKeywords = kw;
};

// 1) Tanpa filter apa pun → semua match (perilaku lama)
set([], []);
assert.strictEqual(crawler.notifTargetMatch('BS 004', 'Paket Apa Saja'), true);
assert.strictEqual(crawler.notifTargetMatch('-', 'Paket Apa Saja'), true);

// 2) Filter SBU saja → hanya kode SBU yang menentukan (perilaku lama)
set(['BG001', 'BG002'], []);
assert.strictEqual(crawler.notifTargetMatch('BG 001', 'Gedung'), true);
assert.strictEqual(crawler.notifTargetMatch('BS 004', 'Gedung'), false);

// 3) SBU terdetek → SBU menentukan, kata kunci TIDAK dipakai (tak ada notif dobel)
set(['BG001'], ['jalan tol']);
assert.strictEqual(crawler.notifTargetMatch('BG 001', 'Peningkatan Jalan'), true);   // cocok via SBU
assert.strictEqual(crawler.notifTargetMatch('BS 004', 'Jalan Tol Lingkar'), false);    // SBU tak cocok → keyword diabaikan
assert.strictEqual(crawler.notifSbuNote('BG 001'), '');                                 // terdetek → tanpa catatan

// 4) KASUS UTAMA: kode SBU tidak terdeteksi ('-') + kata kunci cocok → match + catatan dokpil
set(['BG001'], ['jalan tol']);
assert.strictEqual(crawler.notifTargetMatch('-', 'Pembangunan Jalan Tol Ruas A'), true);
assert.strictEqual(crawler.notifTargetMatch('-', 'Perpaudan Kantor'), false);
assert.strictEqual(
    crawler.notifSbuNote('-'),
    '\n⚠️ *SBU belum terdeteksi otomatis — cek kode SBU di dalam dokpil.*'
);

// 5) Kata kunci saja (tanpa SBU target) → kata kunci menentukan
set([], ['tol']);
assert.strictEqual(crawler.notifTargetMatch('-', 'Jalan Tol'), true);
assert.strictEqual(crawler.notifTargetMatch('BG001', 'Jalan Tol Lingkar'), true);
assert.strictEqual(crawler.notifTargetMatch('BG001', 'Gedung Sekolah'), false);

// 6) Case-insensitive + multi koma (diparse dari string setting "TOL, bendungan")
set([], 'TOL, bendungan'.split(',').map(s => s.trim().toLowerCase()));
assert.strictEqual(crawler.notifKeywordMatch('JALAN TOL LINGKAR'), true);
assert.strictEqual(crawler.notifKeywordMatch('Bendungan Kecil'), true);
assert.strictEqual(crawler.notifKeywordMatch('Jalan Biasa'), false);

console.log('OK: notifTargetMatch/notifKeywordMatch/notifSbuNote - 16 kasus lulus');
