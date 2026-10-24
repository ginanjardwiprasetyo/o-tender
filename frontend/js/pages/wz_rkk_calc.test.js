/**
 * Tes wizard step-5 (DocumentsPage): tabel B1 preview —
 *  1. kolom "Nilai Risiko (FxA)" & "Tingkat Risiko (TR)" non-editabel (fungsi F×A + ambang);
 *  2. edit F/A → FxA & TR dihitung ulang otomatis;
 *  3. kriteria "Terjadi kecelakan pada pekerja akibat risiko {{kategori_b1}}" tetap ada;
 *  4. save preview membuang atribut dekorasi (contenteditable=false / data-wz-calc).
 *
 * Jalankan:  npm run test:rkk
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const RKK = require('../../../backend/services/rkk');

const src = fs.readFileSync(path.join(__dirname, 'documents.js'), 'utf8');

const dom = new JSDOM('<!doctype html><html><body><div id="box" contenteditable="true"></div></body></html>', { pretendToBeVisual: true });
const { document } = dom.window;

// eslint-disable-next-line no-new-func
const DocumentsPage = new Function('document', 'Fmt', 'API', 'Toast', 'lucide', 'console',
    src + '\n;return DocumentsPage;')(document, { escape: (s) => s }, {}, { success() {}, error(m) { throw new Error(m); } }, { createIcons() {} }, console);

let failed = 0;
const ok = (cond, msg) => {
    if (cond) { console.log('  ✓ ' + msg); }
    else { failed++; console.error('  ✗ ' + msg); }
};

const ambang = { kecil: 4, sedang: 12, besar: 25 };
// render B1 persis path preview: F=3, A=4 → 12 = Risiko Sedang
const html = RKK.renderB1(RKK.DEFAULTS.b1, { mungkin_b1: 3, parah_b1: 4 }, { jumlahBaris: 1, ambang });
const box = document.getElementById('box');
box.innerHTML = html;

console.log('\n1. Decorate B1 (fungsi FxA & TR)');
DocumentsPage._wzRkkDecorateB1(box, ambang);
const row = () => box.querySelector('tbody tr');
const cells = () => [...row().cells];
// indeks kolom template default: 6=F 7=A 8=FxA 9=TR 11=F* 12=A* 13=FxA* 14=TR*
ok(cells()[8].getAttribute('contenteditable') === 'false', 'kolom Nilai Risiko (FxA) non-editabel');
ok(cells()[9].getAttribute('contenteditable') === 'false', 'kolom Tingkat Risiko (TR) non-editabel');
ok(cells()[13].getAttribute('contenteditable') === 'false', 'kolom Nilai Risiko sisa risiko non-editabel');
ok(cells()[14].getAttribute('contenteditable') === 'false', 'kolom Tingkat Risiko sisa risiko non-editabel');
ok(cells()[6].getAttribute('contenteditable') !== 'false', 'kolom Kemungkinan (F) tetap editable');
ok(cells()[8].textContent.trim() === '12', 'FxA awal = 12 (3×4)');
ok(cells()[9].textContent.trim() === 'Risiko Sedang', 'TR awal = Risiko Sedang');
ok(cells()[3].textContent.includes('Terjadi kecelakan pada pekerja akibat'), 'kriteria Jenis Bahaya tetap ada');
ok(cells()[3].textContent.trim() === 'Terjadi kecelakan pada pekerja akibat Risiko Sedang.', 'kriteria = nilai TR (bukan rangkap "risiko Risiko …")');

console.log('\n2. Edit F/A → hitung ulang');
cells()[6].textContent = '5';   // F 3 → 5
cells()[6].dispatchEvent(new dom.window.Event('input', { bubbles: true }));
ok(cells()[8].textContent.trim() === '20', 'FxA terhitung ulang = 20 (5×4)');
ok(cells()[9].textContent.trim() === 'Risiko Besar', 'TR terhitung ulang = Risiko Besar (>12)');
ok(cells()[3].textContent.trim() === 'Terjadi kecelakan pada pekerja akibat Risiko Besar.', 'kriteria ikut live-update mengikuti TR');
// baris lain tidak ikut (sisa-risiko F/A masih "n/a" → tak dihitung, tak crash)
ok(cells()[13].textContent.trim() === 'n/a', 'kolom sisa risiko tak tersentuh (F/A belum angka)');

console.log('\n2b. Template dgn &nbsp; sebelum variabel (kondisi data asli di DB)');
const nbspHtml = html.replace(/akibat /, 'akibat&nbsp;');
box.innerHTML = nbspHtml;
DocumentsPage._wzRkkDecorateB1(box, ambang);
const row2 = box.querySelector('tbody tr');
ok(/Risiko Sedang\.$/.test(row2.cells[3].textContent.replace(/\u00A0/g, ' ')), 'kriteria terbentuk walau pemisah &nbsp;');
row2.cells[6].textContent = '6';
row2.cells[6].dispatchEvent(new dom.window.Event('input', { bubbles: true }));
ok(row2.cells[9].textContent.trim() === 'Risiko Besar', 'TR terhitung ulang dari template &nbsp; = Risiko Besar (6×4=24)');
ok(row2.cells[3].textContent.replace(/\u00A0/g, ' ').trim() === 'Terjadi kecelakan pada pekerja akibat Risiko Besar.', 'kriteria ikut live-update walau &nbsp; (regex tak mentah spasi)');
box.innerHTML = html;
DocumentsPage._wzRkkDecorateB1(box, ambang);
// ulangi skenario edit (F=5) agar state spt sebelumnya
const r3 = box.querySelector('tbody tr');
r3.cells[6].textContent = '5';
r3.cells[6].dispatchEvent(new dom.window.Event('input', { bubbles: true }));

console.log('\n3. Save preview bersih dari atribut dekorasi');
DocumentsPage._wz = { rkk: {} };
DocumentsPage._wzRkkSavePreview('b1', box);
const saved = DocumentsPage._wz.rkk.rkk_tabel_b1;
ok(!/contenteditable="false"/.test(saved), 'contenteditable="false" ikut dibuang');
ok(!/data-wz-calc/.test(saved), 'data-wz-calc ikut dibuang');
ok(saved.includes('Risiko Besar'), 'nilai hasil hitungan tetap tersimpan');

console.log('\n4. Tabel tanpa header RKK → aman (no-op)');
box.innerHTML = RKK.DEFAULTS.d2;
DocumentsPage._wzRkkDecorateB1(box, ambang);
ok(!box.querySelector('[contenteditable="false"]'), 'D2 tak punya kolom FxA/TR → tak dikunci');

console.log(failed ? `\n${failed} ASSERTION GAGAL` : '\nSemua assertion lolos');
process.exit(failed ? 1 : 0);
