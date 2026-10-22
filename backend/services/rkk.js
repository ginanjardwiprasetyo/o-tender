/**
 * RKK — engine tabel B1 / B2 / D2 / E1 untuk dokumen.
 *
 * Berisi:
 *  - DEFAULTS : format HTML tiap tabel (bisa diedit user di halaman RKK)
 *  - VARS     : daftar variabel per tabel (dipakai form pembuatan dokumen)
 *  - render*  : merakit tabel — nomor baris DINAMIS (1,2,3… sesuai jumlah baris),
 *                nilai risiko = F x A, tingkat risiko dari ambang (kecil/sedang/besar)
 *
 * Konvensi placeholder:
 *   {{1mungkin}} {{1parah}} {{1resiko}} {{1tingkat}}  → prefix angka = nomor baris
 *   {{uraian_b1}} {{identifikasi_b1}}                  → sufiks _b1 = baris 1
 * Saat baris ke-N dirakit, semua placeholder baris-1 otomatis jadi baris-N.
 */

const DEFAULTS = {
    b1: `<table border="1" style="border-collapse: collapse; text-align: center;">
  <thead>
    <tr>
      <th rowspan="2">No</th>
      <th colspan="3">Deskripsi Risiko</th>
      <th rowspan="2">Persyaratan Pemenuhan Peraturan</th>
      <th rowspan="2">Pengendalian Awal</th>
      <th colspan="4">Penilaian Tingkat Risiko</th>
      <th rowspan="2">Pengendalian Lanjutan</th>
      <th colspan="4">Penilaian Sisa Risiko</th>
      <th rowspan="2">Keterangan</th>
    </tr>
    <tr>
      <th>Uraian Pekerjaan</th>
      <th>Identifikasi Bahaya</th>
      <th>Jenis Bahaya</th>
      <th>Kemungkinan (F)</th>
      <th>Keparahan (A)</th>
      <th>Nilai Risiko (FxA)</th>
      <th>Tingkat Risiko (TR)</th>
      <th>Kemungkinan (F)</th>
      <th>Keparahan (A)</th>
      <th>Nilai Risiko (FxA)</th>
      <th>Tingkat Risiko (TR)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>{{uraian_b1}}</td>
      <td>{{identifikasi_b1}}</td>
      <td>Terjadi kecelakan pada pekerja akibat risiko {{kategori_b1}}.</td>
      <td>{{syaratAturan}}</td>
      <td>{{pengAwal}}</td>
      <td>{{1mungkin}}</td>
      <td>{{1parah}}</td>
      <td>{{1resiko}}</td>
      <td>{{1tingkat}}</td>
      <td>{{pengLanjut}}</td>
      <td>n/a</td>
      <td>n/a</td>
      <td>n/a</td>
      <td>n/a</td>
      <td></td>
    </tr>
  </tbody>
</table>`,

    b2: `<table border="1" style="border-collapse: collapse; text-align: center;">
  <thead>
    <tr>
      <th rowspan="2">No</th>
      <th rowspan="2">Pengendalian Risiko (sesuai kolom tabel 6 IBPRP)</th>
      <th colspan="2">Sasaran</th>
      <th colspan="6">Program</th>
    </tr>
    <tr>
      <th>Uraian</th>
      <th>Tolak ukur</th>
      <th>Uraian Kegiatan</th>
      <th>Sumber Daya</th>
      <th>Jadwal Pelaksanaan</th>
      <th>Bentuk Monitoring</th>
      <th>Indikator Pencapaian</th>
      <th>Penanggung Jawab</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>{{isi_b2_1}}</td>
      <td>{{isi_b2_2}}</td>
      <td>{{isi_b2_3}}</td>
      <td>{{isi_b2_4}}</td>
      <td>{{isi_b2_5}}</td>
      <td>{{isi_b2_6}}</td>
      <td>{{isi_b2_7}}</td>
      <td>{{isi_b2_8}}</td>
      <td>{{isi_b2_9}}</td>
    </tr>
  </tbody>
</table>`,

    d2: `<table border="1" style="border-collapse: collapse; text-align: center;">
  <thead>
    <tr>
      <th>Urutan Langkah Pekerjaan</th>
      <th>Identifikasi Bahaya</th>
      <th>Pengendalian</th>
      <th>Penanggung Jawab</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>{{uraian_b1}}</td>
      <td>{{identifikasi_b1}}</td>
      <td>{{pengD2}}</td>
      <td>{{pjD2}}</td>
    </tr>
  </tbody>
</table>`,

    // E1 — formatnya menyusul: langsung di form pembuatan dokumen
    e1: '',
};

// Ambang tingkat risiko (nilai F x A). Default sesuai ketentuan: 1-4 kecil, 5-12 sedang, 13-25 besar.
const AMBANG = { kecil: 4, sedang: 12, besar: 25 };

// Daftar variabel per tabel (dipakai halaman RKK & form pembuatan dokumen).
// perBaris → nama variabelnya berakhiran nomor baris: {{uraian_b1}}, {{uraian_b2}}, ...
const VARS = {
    b1: [
        { key: 'uraian_b', label: 'Uraian Pekerjaan', ket: 'diisi manual per baris', perBaris: true },
        { key: 'identifikasi_b', label: 'Identifikasi Bahaya', ket: 'diisi manual per baris', perBaris: true },
        { key: 'kategori_b', label: 'Jenis Bahaya', ket: 'diisi manual per baris', perBaris: true },
        { key: 'syaratAturan', label: 'Persyaratan Pemenuhan Peraturan', ket: 'diisi manual', perBaris: false },
        { key: 'pengAwal', label: 'Pengendalian Awal', ket: 'diisi manual', perBaris: false },
        { key: 'pengLanjut', label: 'Pengendalian Lanjutan', ket: 'diisi manual', perBaris: false },
        { key: 'mungkin_b', label: 'Kemungkinan (F)', ket: 'default 1', perBaris: true, default: 1 },
        { key: 'parah_b', label: 'Keparahan (A)', ket: 'default 1', perBaris: true, default: 1 },
    ],
    b2: [
        { key: 'isi_b2_1', label: 'Pengendalian Risiko (kolom tabel 6 IBPRP)', ket: 'diisi manual', perBaris: false },
        { key: 'isi_b2_2', label: 'Sasaran — Uraian', ket: 'diisi manual', perBaris: false },
        { key: 'isi_b2_3', label: 'Program — Uraian Kegiatan', ket: 'diisi manual', perBaris: false },
        { key: 'isi_b2_4', label: 'Program — Sumber Daya', ket: 'diisi manual', perBaris: false },
        { key: 'isi_b2_5', label: 'Program — Jadwal Pelaksanaan', ket: 'diisi manual', perBaris: false },
        { key: 'isi_b2_6', label: 'Program — Bentuk Monitoring', ket: 'diisi manual', perBaris: false },
        { key: 'isi_b2_7', label: 'Program — Indikator Pencapaian', ket: 'diisi manual', perBaris: false },
        { key: 'isi_b2_8', label: 'Program — Penanggung Jawab', ket: 'diisi manual', perBaris: false },
    ],
    d2: [
        { key: 'pengD2', label: 'Pengendalian', ket: 'diisi manual', perBaris: false },
        { key: 'pjD2', label: 'Penanggung Jawab', ket: 'diisi manual', perBaris: false },
    ],
    e1: [],
};

/** Tingkat risiko dari nilai (F x A). */
function tingkatRisiko(nilai, ambang = AMBANG) {
    const n = Number(nilai) || 0;
    if (n <= (Number(ambang.kecil) || 0)) return 'Risiko Kecil';
    if (n <= (Number(ambang.sedang) || 0)) return 'Risiko Sedang';
    if (n <= (Number(ambang.besar) || 0)) return 'Risiko Besar';
    return 'Risiko Besar';
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Ambil <tr> pertama di dalam <tbody> (baris template). */
function firstBodyRow(html) {
    const tb = html.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i);
    if (!tb) return null;
    const tr = tb[1].match(/<tr\b[\s\S]*?<\/tr>/i);
    return tr ? tr[0] : null;
}

/** Ganti placeholder baris-1 → baris-N (prefix & sufiks) + nomor urut kolom No. */
function renumberRow(rowHtml, n) {
    return rowHtml
        .replace(/\{\{\s*(\d+)([A-Za-z_]\w*)\s*\}\}/g, (m, d, name) => `{{${n}${name}}}`)
        .replace(/\{\{\s*([A-Za-z_]\w*?)_b(\d+)\s*\}\}/g, (m, name, d) => `{{${name}_b${n}}}`)
        // sel pertama "No" yg isinya angka polos → jadi nomor baris
        .replace(/^(<tr\b[^>]*>\s*<td\b[^>]*>)\s*\d+\s*(<\/td>)/i, `$1${n}$2`);
}

/** Isi nilai2 perhitungan + variabel untuk baris ke-N. */
function fillRow(rowHtml, n, vars, opt) {
    const F = Number(vars[`mungkin_b${n}`] ?? vars.mungkin ?? opt.defaultMungkin ?? 1) || 0;
    const A = Number(vars[`parah_b${n}`] ?? vars.parah ?? opt.defaultParah ?? 1) || 0;
    const risiko = F * A;
    const tingkat = tingkatRisiko(risiko, opt.ambang);
    return rowHtml
        .replace(/\{\{\s*(\d+)mungkin\s*\}\}/gi, String(F))
        .replace(/\{\{\s*(\d+)parah\s*\}\}/gi, String(A))
        .replace(/\{\{\s*(\d+)resiko\s*\}\}/gi, String(risiko))
        .replace(/\{\{\s*(\d+)tingkat\s*\}\}/gi, esc(tingkat))
        .replace(/\{\{\s*([A-Za-z_]\w*?)_b(\d+)\s*\}\}/g, (m, name) => esc(vars[`${name}_b${n}`] ?? vars[name] ?? ''));
}

/**
 * Rakit tabel B1 — baris dinamis, risiko & tingkat dihitung.
 * @param {string} html format tabel
 * @param {object} vars nilai variabel (uraian_b1, mungkin_b1, ...)
 * @param {object} opt { jumlahBaris, defaultMungkin, defaultParah, ambang }
 */
function renderB1(html, vars = {}, opt = {}) {
    const src = html || DEFAULTS.b1;
    const row = firstBodyRow(src);
    if (!row) return src;
    const n = Math.max(1, parseInt(opt.jumlahBaris, 10) || 1);
    const rows = [];
    for (let i = 1; i <= n; i++) {
        rows.push(fillRow(renumberRow(row, i), i, vars, opt));
    }
    return src.replace(/<tbody\b[^>]*>[\s\S]*?<\/tbody>/i,
        (m) => `<tbody>\n    ${rows.join('\n    ')}\n  </tbody>`);
}

/** Rakit tabel B2 / D2 — baris dinamis, placeholder diisi dari vars. */
function renderSimple(html, vars = {}, opt = {}) {
    const src = html || '';
    const row = firstBodyRow(src);
    if (!row) return src;
    const n = Math.max(1, parseInt(opt.jumlahBaris, 10) || 1);
    const rows = [];
    for (let i = 1; i <= n; i++) {
        rows.push(fillRow(renumberRow(row, i), i, vars, opt));
    }
    return src.replace(/<tbody\b[^>]*>[\s\S]*?<\/tbody>/i,
        (m) => `<tbody>\n    ${rows.join('\n    ')}\n  </tbody>`);
}

/** Ambil pengaturan RKK dari tabel settings (key rkk_*). */
async function loadSettings(db) {
    const { rows } = await db.query("SELECT key, value FROM settings WHERE key LIKE 'rkk\\_%'");
    const s = {};
    rows.forEach(r => { s[r.key] = r.value; });
    // nilai isian manual (prefix rkk_val_) → map ke nama variabel aslinya
    const vals = {};
    Object.keys(s).filter(k => k.startsWith('rkk_val_')).forEach(k => { vals[k.slice(8)] = s[k]; });
    const num = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
    return {
        b1: s.rkk_tabel_b1 || DEFAULTS.b1,
        b2: s.rkk_tabel_b2 || DEFAULTS.b2,
        d2: s.rkk_tabel_d2 || DEFAULTS.d2,
        e1: s.rkk_tabel_e1 || DEFAULTS.e1,
        barisB1: num(s.rkk_baris_b1, 1),
        barisB2: num(s.rkk_baris_b2, 1),
        ambang: {
            kecil: num(s.rkk_ambang_kecil, AMBANG.kecil),
            sedang: num(s.rkk_ambang_sedang, AMBANG.sedang),
            besar: num(s.rkk_ambang_besar, AMBANG.besar),
        },
        defaultMungkin: num(s.rkk_default_mungkin, 1),
        defaultParah: num(s.rkk_default_parah, 1),
        vals,
    };
}

/** Rakit semua tabel RKK dari pengaturan + variabel dokumen. */
function renderTables(cfg = {}, vars = {}) {
    const opt = {
        defaultMungkin: cfg.defaultMungkin,
        defaultParah: cfg.defaultParah,
        ambang: cfg.ambang || AMBANG,
    };
    return {
        b1: renderB1(cfg.b1 || DEFAULTS.b1, vars, { ...opt, jumlahBaris: cfg.barisB1 || 1 }),
        b2: renderSimple(cfg.b2 || DEFAULTS.b2, vars, { ...opt, jumlahBaris: cfg.barisB2 || 1 }),
        d2: renderSimple(cfg.d2 || DEFAULTS.d2, vars, { ...opt, jumlahBaris: 1 }),
    };
}

module.exports = { DEFAULTS, VARS, AMBANG, tingkatRisiko, renderB1, renderSimple, renderTables, loadSettings, firstBodyRow, renumberRow };
