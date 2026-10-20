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
assert.strictEqual(crawler.notifKeywordMatch('Paket Apa Saja'), false);

// 2) Filter SBU saja → hanya cocok kode SBU (perilaku lama)
set(['BG001', 'BG002'], []);
assert.strictEqual(crawler.notifTargetMatch('BG 001', 'Gedung'), true);
assert.strictEqual(crawler.notifTargetMatch('BS 004', 'Gedung'), false);

// 3) SBU + kata kunci → OR (salah satu cukup)
set(['BG001'], ['jalan tol', 'bendungan']);
assert.strictEqual(crawler.notifTargetMatch('BG 001', 'Peningkatan Jalan'), true);      // via SBU
assert.strictEqual(crawler.notifTargetMatch('BS 004', 'Peningkatan Jalan Tol Lingkar'), true); // via kata kunci
assert.strictEqual(crawler.notifTargetMatch('BS 004', 'Perpaudan Kantor'), false);

// 4) KASUS UTAMA: kode SBU tidak terdeteksi ('-') tapi nama paket kena kata kunci
set(['BG001'], ['jalan tol']);
assert.strictEqual(crawler.notifTargetMatch('-', 'Pembangunan Jalan Tol Ruas A'), true);
assert.strictEqual(crawler.notifKeywordMatch('Pembangunan Jalan Tol Ruas A'), true);
assert.strictEqual(crawler.notifTargetMatch('-', 'Perpaudan Kantor'), false);

// 5) Kata kunci saja (tanpa SBU) → hanya kata kunci yang menentukan
set([], ['tol']);
assert.strictEqual(crawler.notifTargetMatch('-', 'Jalan Tol'), true);
assert.strictEqual(crawler.notifTargetMatch('BG001', 'Gedung Sekolah'), false);

// 6) Case-insensitive + multi koma (diparse dari string setting "TOL, bendungan")
set([], 'TOL, bendungan'.split(',').map(s => s.trim().toLowerCase()));
assert.strictEqual(crawler.notifKeywordMatch('JALAN TOL LINGKAR'), true);
assert.strictEqual(crawler.notifKeywordMatch('Bendungan Kecil'), true);
assert.strictEqual(crawler.notifKeywordMatch('Jalan Biasa'), false);

console.log('OK: notifTargetMatch/notifKeywordMatch - 15 kasus lulus');
