// Test deterministik dokpil LDP — jalankan: node services/test_dokpil_extract.js (dari backend/)
// Ground truth = panel "Preview BAB IV" (raw text) pada UI #dokpil — fixture: fixtures/ldp-brspa.txt
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { extractLdp } = require('./dokpil_extract');

const text = fs.readFileSync(path.join(__dirname, 'fixtures', 'ldp-brspa.txt'), 'utf8');
const { fields, tables } = extractLdp(text);

// ── Field ──
assert.strictEqual(fields.pokja, 'Pokja Pemilihan Pengadaan Konstruksi Pemeliharaan Barang Milik Daerah Penunjang Urusan Pemerintahan Daerah Paket Pekerjaan Rehab Ruang Bermain, Ruang Konseling dan Aula BRSPA Unit Sleman', 'pokja');
assert.strictEqual(fields.alamat_pokja, 'Gedung Janaka (unit 7) Lantai 2 Kompleks Kepatihan, Danurejan, Yogyakarta', 'alamat_pokja');
assert.strictEqual(fields.nama_paket, 'Rehab Ruang Bermain, Ruang Konseling dan Aula BRSPA Unit Sleman', 'nama_paket');
assert.strictEqual(fields.lokasi, 'BRSPA Unit Sleman, Kalurahan Bimomartani, Kapanewon Ngemplak, Kab. Sleman', 'lokasi');
assert.strictEqual(fields.jangka_waktu, '105', 'jangka_waktu');
assert.strictEqual(fields.pagu_anggaran, '1034390000', 'pagu_anggaran');
assert.strictEqual(fields.pagu_terbilang, 'satu miliar tiga puluh empat juta tiga ratus sembilan puluh ribu rupiah', 'pagu_terbilang');
assert.strictEqual(fields.kir, 'tidak', 'kir tidak ada di LDP ini');

// ── Tabel peralatan ──
assert.ok(tables.peralatan, 'tabel peralatan ada');
assert.deepStrictEqual(tables.peralatan.header, ['No', 'Jenis Alat', 'Kapasitas', 'Jumlah']);
assert.deepStrictEqual(tables.peralatan.rows, [
  ['1', 'Schafolding', '1,7 m', '1 unit @50 set'],
  ['2', 'Pick up', '1.000 – 2.500 cc', ''],
], 'peralatan rows');

// ── Tabel personel ──
assert.ok(tables.personel, 'tabel personel ada');
assert.deepStrictEqual(tables.personel.header, ['No', 'Jabatan', 'Pengalaman Kerja (tahun)', 'Sertifikat Kompetensi Kerja']);
assert.deepStrictEqual(tables.personel.rows, [
  ['1', 'Pelaksana', '1 Tahun', 'SKK Pelaksana Lapangan Pekerjaan Gedung Jenjang 4'],
  ['2', 'Petugas Keselamatan Konstruksi', '0 Tahun', 'SKK Petugas Keselamatan Konstruksi Jenjang 3'],
], 'personel rows');

// ── Tabel RKK ──
assert.ok(tables.rkk, 'tabel rkk ada');
assert.deepStrictEqual(tables.rkk.header, ['No', 'Uraian Pekerjaan', 'Identifikasi Bahaya']);
assert.deepStrictEqual(tables.rkk.rows, [
  ['1', 'Pekerjaan Atap', 'Terjatuh dari ketinggian'],
], 'rkk rows');

// ── KIR = ya (teks minimal) ──
const kir = extractLdp('LEMBAR DATA PEMILIHAN\nIdentitas Pokja\n1. KIR disyaratkan untuk paket ini\n2. Pagu Anggaran: Rp50.000,00');
assert.strictEqual(kir.fields.kir, 'ya', 'kir = ya');

// ── Layout beda (ldp-new.txt): kolom pengalaman "1 tahun" & kolom pengalaman ter-merge/absen ──
// Regresi: parsePersonel dulu salah split — jabatan menelan teks sertifikat (SKK) & "Jenjang 3" jadi tahun.
const n = extractLdp(fs.readFileSync(path.join(__dirname, 'fixtures', 'ldp-new.txt'), 'utf8'));
assert.deepStrictEqual(n.tables.personel.rows, [
  ['1', 'Pelaksana Lapangan', '1 Tahun', 'Pelaksana Lapangan Pekerjaan Gedung minimal Jenjang 4'],
  ['2', 'Petugas Keselamatan Konstruksi', '', 'SKK Petugas Keselamatan dan Kesehatan Kerja (K3) Konstruksi atau Petugas Keselamatan Konstruksi Jenjang 3 atau Personil Keselamatan dan Kesehatan Kerja minimal jenjang 4'],
], 'personel rows (layout baru)');
assert.strictEqual(n.fields.pokja, 'Pokja 1 Putaran Ke Delapan UKPBJ Sekretariat Daerah Kabupaten Sleman', 'pokja (layout baru)');
assert.strictEqual(n.fields.jangka_waktu, '60', 'jangka_waktu (layout baru)');

// ── Layout dgn kolom "Jumlah (Orang)" (SDN 3 Gentan) ──
// Regresi: kolom jumlah ikut nyangkut ke kolom Jabatan ("Pelaksana 1") &
// pengalaman "Tidak dipersyaratkan" jadi kata yg terpotong ("dipersya"+"ratkan").
const g = extractLdp(fs.readFileSync(path.join(__dirname, 'fixtures', 'ldp-personel-jumlah.txt'), 'utf8'));
assert.deepStrictEqual(g.tables.personel.header, ['No', 'Jabatan', 'Jumlah (Orang)', 'Pengalaman Kerja (tahun)', 'Sertifikat Kompetensi Kerja'], 'personel header (kolom jumlah)');
assert.strictEqual(g.tables.personel.rows.length, 2, '2 baris personel');
assert.deepStrictEqual(g.tables.personel.rows.map(r => r.slice(0, 4)), [
  ['1', 'Pelaksana', '1', '2 Tahun'],
  ['2', 'Petugas Keselamatan Konstruksi atau Ahli K3 Konstruksi/Ahli Keselamatan Konstruksi', '1', 'Tidak dipersyaratkan'],
], 'personel rows (kolom jumlah)');
assert.ok(g.tables.personel.rows[1][4].startsWith('SKT Petugas K3'), 'sertifikat terpisah dari jabatan');

// ── Urutan kolom BERBEDA: "Jabatan | Pengalaman | Jumlah (Orang)" (LDP Polly) ──
// Regresi: pengalaman "1 Tahun" ada di tengah baris → parser ngarahin ke kolom
// Jabatan ("Pelaksana 1 Tahun") & kolom Pengalaman kosong.
const o = extractLdp(fs.readFileSync(path.join(__dirname, 'fixtures', 'ldp-personel-urutan.txt'), 'utf8'));
assert.deepStrictEqual(o.tables.personel.header, ['No', 'Jabatan', 'Jumlah (Orang)', 'Pengalaman Kerja (tahun)', 'Sertifikat Kompetensi Kerja'], 'personel header (urutan kolom beda)');
assert.deepStrictEqual(o.tables.personel.rows.map(r => r.slice(0, 4)), [
  ['1', 'Pelaksana', '1', '1 Tahun'],
  ['2', 'Petugas Keselamatan Konstruksi', '1', '0 Tahun'],
], 'personel rows (urutan kolom beda)');

console.log('OK: dokpil_extract — 22 assertion lulus (BRSPA + KIR + layout baru + kolom jumlah + urutan kolom)');
