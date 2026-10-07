// Uji parser list ScrapingAnt tanpa API key (fixture HTML sintetis).
// Jalankan: node test-ant-list.js
const assert = require('assert');
const { parseAntListHtml } = require('./services/crawler');

const ROW = ['10161867000', "Bangunan <span class='badge badge-warning'>Tender Gagal</span>",
    'Kota Surabaya', 'Tender Gagal', '11,3 M', 'Pascakualifikasi Satu File', 'Tender',
    'Harga Terendah Sistem Gugur', 'Pekerjaan Konstruksi - TA 2026', '5',
    'Rp. 1.700.977.950,85', 'null', 'null', '0', '0', 'null'];

// 1. Jalur utama: JSON 16 kolom yang ditempel js_snippet ke <pre id="__ant">
let res = parseAntListHtml(`<html><body><table class="dataTable"></table><pre id="__ant">${JSON.stringify([ROW])}</pre></body></html>`);
assert(Array.isArray(res) && res.length === 1, 'baris __ant harus terbaca');
assert.strictEqual(res[0]['Kode Tender'], '10161867000');
assert.strictEqual(res[0].Pagu, 11300000000, 'pagu "11,3 M" → 11.300.000.000');
assert.strictEqual(res[0].HPS, 1700977950, 'hps "Rp. 1.700.977.950,85" → 1.700.977.950');
assert(!/<|>/.test(res[0]['Nama Paket']), 'tag HTML di nama paket harus dibersihkan');
assert.strictEqual(res[0]['Kategori Pekerjaan'], 'Pekerjaan Konstruksi');

// 2. Fallback DOM: tabel render cuma punya 5 kolom tampil → pagu 0
const dom = '<table class="dataTable"><tbody><tr><td>10149273000</td><td>Nama Paket X</td>' +
    '<td>Kota Y</td><td>Pengumuman</td><td>2,5 M</td></tr></tbody></table>';
res = parseAntListHtml(dom);
assert(Array.isArray(res) && res.length === 1, 'fallback DOM harus terbaca');
assert.strictEqual(res[0].Pagu, 0, 'DOM tidak menyimpan kolom pagu');
assert.strictEqual(res[0].HPS, 2500000000, 'HPS dari kolom terakhir ("2,5 M")');

// 3. Snippet error / halaman kosong → null
assert.strictEqual(parseAntListHtml('<pre id="__ant">["ERR:jQuery is not defined"]</pre>'), null);
assert.strictEqual(parseAntListHtml('<html><body></body></html>'), null);

// 4. Baris < 11 kolom dilewati
assert.strictEqual(parseAntListHtml('<pre id="__ant">[["123","terlalu-pendek"]]</pre>'), null);

console.log('OK parseAntListHtml: 4 kasus lulus');
process.exit(0);
