// Cek cepat filter antrean deep scan — jalankan: node services/test_status_lewat.js (dari backend/)
const assert = require('assert');
const { statusLewat } = require('./crawler');

// lewat masa upload → jangan masuk antrean (hemat timeout GitHub Action)
assert.strictEqual(statusLewat('Tender Sudah Selesai'), true);
assert.strictEqual(statusLewat('tender gagal'), true);
assert.strictEqual(statusLewat('Tender Batal'), true);
assert.strictEqual(statusLewat('Penandatanganan Kontrak'), true);
assert.strictEqual(statusLewat('Masa Sanggah'), true);
assert.strictEqual(statusLewat('Surat Penunjukan Penyedia Barang/Jasa [...]'), true);
assert.strictEqual(statusLewat('Evaluasi Administrasi, Kualifikasi, Teknis, dan Harga'), true);
assert.strictEqual(statusLewat('Pengumuman Pascakualifikasi'), true);
assert.strictEqual(statusLewat('Pembukaan Dokumen Penawaran'), true);

// masih bisa upload / status tak dikenal → TETAP masuk antrean
assert.strictEqual(statusLewat('Download Dokumen Pemilihan'), false);
assert.strictEqual(statusLewat('Tahap Pengadaan'), false);
assert.strictEqual(statusLewat('-'), false);
assert.strictEqual(statusLewat(''), false);
assert.strictEqual(statusLewat(null), false);

console.log('OK: statusLewat filter - 14 kasus lulus');
