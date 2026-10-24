/**
 * Tes tabel builder RKK (#rkk): decorate → edit → serialize harus round-trip.
 *
 * Kunci yang dijaga:
 *  1. Semua token {{var}} format asli SELAMAT (tak ada variable hilang/invented).
 *  2. Nilai isian tdk bocor ke format (chip → token, bukan teks nilai).
 *  3. Sel hitungan ({{1resiko}}/{{1tingkat}}) menghitung F×A + ambang.
 *  4. Simpan hanya mengirim tab yang diedit (tab lain tdk ditimpa).
 *
 * Jalankan:  npm run test:rkk
 * Exit code 1 = round-trip rusak (template RKK akan hilang variabelnya).
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const RKK = require('../../../backend/services/rkk');

const src = fs.readFileSync(path.join(__dirname, 'rkk.js'), 'utf8');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
const { document } = dom.window;

// elemen yg dibutuhkan renderBody/save (Pengaturan Umum + titik render tab)
document.body.innerHTML = `
  <button id="rkk-save-btn"></button>
  <input id="rkk-baris-b1" value="2"><input id="rkk-baris-b2" value="1">
  <input id="rkk-mungkin" value="3"><input id="rkk-parah" value="4">
  <input id="rkk-kecil" value="4"><input id="rkk-sedang" value="12"><input id="rkk-besar" value="25">
  <div id="rkk-tab-body"></div>`;

const saved = {};
const Fmt = {
    escape(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
};
const API = { updateSettings: async (p) => { Object.assign(saved, p); return { data: p }; } };
const Toast = { success() {}, error(m) { throw new Error(m); } };
const lucide = { createIcons() {} };

// eslint-disable-next-line no-new-func
const RkkPage = new Function('document', 'Fmt', 'API', 'Toast', 'lucide', 'console',
    src + '\n;return RkkPage;')(document, Fmt, API, Toast, lucide, console);

let failed = 0;
const ok = (cond, msg) => {
    if (cond) { console.log('  ✓ ' + msg); }
    else { failed++; console.error('  ✗ ' + msg); }
};
const tokens = (html) => new Set((html.match(/\{\{\s*\w+\s*\}\}/g) || []).map(t => t.replace(/\s+/g, '')));
const sameTokens = (a, b) => {
    const A = tokens(a), B = tokens(b);
    return A.size === B.size && [...A].every(t => B.has(t));
};

// format uji: default backend + gaya tersimpan (B2 & E1 konkret, persis isi DB)
const FORMATS = {
    b1: RKK.DEFAULTS.b1,
    b2: RKK.DEFAULTS.b2,
    d2: RKK.DEFAULTS.d2,
    e1: `<table border="1" style="border-collapse: collapse; text-align: center;"><thead><tr><th rowspan="2">No</th><th rowspan="2">Kegiatan</th><th rowspan="2">PIC</th><th colspan="7">Minggu ke-</th></tr><tr><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th></tr></thead><tbody><tr><td>1</td><td>Inspeksi</td><td>{{posisi_k3}}</td><td>x</td><td></td><td></td><td></td><td></td><td></td><td></td></tr></tbody></table>`,
};

RkkPage.defaults = { b1: RKK.DEFAULTS.b1, b2: RKK.DEFAULTS.b2, d2: RKK.DEFAULTS.d2, e1: RKK.DEFAULTS.e1 };
RkkPage.varDefs = RKK.VARS;
RkkPage.cfg = {
    rkk_val_isi_b2_1: 'Penggunaan APD lengkap', rkk_val_syaratAturan: 'UU 1/1970',
    rkk_val_mungkin_b1: '3', rkk_val_parah_b1: '4', rkk_tabel_e1: FORMATS.e1,
};

console.log('\n1. Token round-trip (decorate → serialize)');
for (const tab of ['b1', 'b2', 'd2', 'e1']) {
    RkkPage._tab = tab;
    RkkPage._tbl = null;
    RkkPage.renderTab();
    ok(!!RkkPage._tbl, `${tab}: builder merender <table> (bukan empty-state)`);
    if (!RkkPage._tbl) continue;
    const out = RkkPage._serialize(RkkPage._tbl);
    ok(sameTokens(FORMATS[tab], out), `${tab}: token identik dgn format asli (${tokens(FORMATS[tab]).size} token)`);
    ok(!/contenteditable|class="rkk-|data-rkk-/.test(out), `${tab}: atribut builder tdk bocor ke format`);
}

console.log('\n2. Sel nilai: tampilkan nilai, simpan sbg token');
RkkPage._tab = 'b1';
RkkPage._tbl = null;
RkkPage.renderTab();
const chipSyarat = RkkPage._tbl.querySelector('[data-rkk-key="syaratAturan"]');
ok(!!chipSyarat, 'token {{syaratAturan}} jadi chip nilai');
ok(chipSyarat && chipSyarat.textContent.includes('UU 1/1970'), 'chip menampilkan nilai tersimpan');
if (chipSyarat) {
    chipSyarat.textContent = 'PP 14/2021';
    RkkPage._onEdit({ target: chipSyarat });
    ok(RkkPage._dirtyVals['rkk_val_syaratAturan'] === 'PP 14/2021', 'edit chip → rkk_val_syaratAturan ter-capture');
    const out = RkkPage._serialize(RkkPage._tbl);
    ok(out.includes('{{syaratAturan}}'), 'serialize mengembalikan {{syaratAturan}}');
    ok(!out.includes('PP 14/2021'), 'nilai TDK bocor ke format');
    ok(RkkPage._dirtyTabs['b1'] === true, 'tab ditandai dirty');
}

console.log('\n3. Sel hitungan: F=3, A=4 → 12 / Risiko Sedang');
const resiko = RkkPage._tbl.querySelector('[data-rkk-name="resiko"]');
const tingkat = RkkPage._tbl.querySelector('[data-rkk-name="tingkat"]');
ok(resiko && resiko.textContent === '12', `{{1resiko}} = ${resiko && resiko.textContent} (harus 12)`);
ok(tingkat && tingkat.textContent === 'Risiko Sedang', `{{1tingkat}} = ${tingkat && tingkat.textContent} (harus Risiko Sedang)`);
const fChip = RkkPage._tbl.querySelector('[data-rkk-key="mungkin_b1"]');
ok(fChip && fChip.textContent === '3', 'chip F menampilkan nilai manual (3)');

console.log('\n4. Chip dihapus user → token dipulihkan');
const cellUraian = [...RkkPage._tbl.querySelectorAll('td')].find(td => td.dataset.rkkPure === '{{uraian_b1}}');
ok(!!cellUraian, 'sel murni {{uraian_b1}} punya penanda data-rkk-pure');
if (cellUraian) {
    cellUraian.innerHTML = '';
    const out = RkkPage._serialize(RkkPage._tbl);
    ok(out.includes('{{uraian_b1}}'), 'token dipulihkan saat chip hilang');
}

console.log('\n5. Teks statis bisa diedit & ikut tersimpan');
const staticCell = [...RkkPage._tbl.querySelectorAll('td')].find(td => td.textContent.trim() === 'n/a');
ok(!!staticCell, 'sel statis (n/a) ditemukan');
if (staticCell) {
    staticCell.textContent = 'Ditutup';
    RkkPage._onEdit({ target: staticCell });
    const out = RkkPage._serialize(RkkPage._tbl);
    ok(out.includes('Ditutup') && !/ Ditutup<\/td>[\s\S]*n\/a<\/td>/.test(''), 'edit teks statis ikut ter-serialize');
}

console.log('\n6. Simpan: hanya tab dirty + isian yg dikirim');
(async () => {
    await RkkPage.save();
    ok('rkk_tabel_b1' in saved, 'rkk_tabel_b1 terkirim (tab diedit)');
    ok(!('rkk_tabel_d2' in saved) && !('rkk_tabel_e1' in saved) && !('rkk_tabel_b2' in saved),
        'rkk_tabel b2/d2/e1 TDK dikirim (tak ditimpa)');
    ok(saved.rkk_baris_b1 === 2 && saved.rkk_ambang_sedang === 12, 'pengaturan umum ikut terkirim');
    ok(saved.rkk_val_syaratAturan === 'PP 14/2021', 'nilai isian terkirim');
    ok(RkkPage._dirtyTabs['b1'] === undefined && Object.keys(RkkPage._dirtyVals).length === 0,
        'state dirty dibersihkan setelah simpan');

    console.log(`\n${failed ? 'GAGAL: ' + failed + ' asersi' : 'OK: semua asersi lulus'}\n`);
    process.exit(failed ? 1 : 0);
})().catch(e => { console.error('✗ save gagal:', e.message); process.exit(1); });
