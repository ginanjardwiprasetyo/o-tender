/**
 * Rekonstruksi tabel LDP dari KOORDINAT pdf.js — algoritma generik (semua tabel).
 *
 * Parser berbasis text-stream punya batas fundamental: sel & kolom PDF interleaved,
 * jadi nilai sel (mis. pengalaman "2") dan nomor baris ("2.") identik di teks → tak bisa
 * dibedakan. Koordinat (x, y, lebar) memungkinkan tabel direkonstruksi sebagai GRID:
 *
 *   1. AREA TABEL  : item di bawah header tabel, berhenti di "Keterangan" /
 *                     sub-seksi ("b. Untuk …") / seksi baru / celah vertikal besar.
 *   2. BARIS       : item dengan y sama → baris visual.
 *   3. KOLOM       : PROYEKSI WHITESPACE VERTIKAL — rentang x yang tidak tercover
 *                     item di SEMUA baris = batas kolom. Otomatis, tanpa asumsi posisi.
 *   4. SEL         : item yg masuk rentang kolom.
 *   5. SEMANTIK    : kata kunci header tiap tabel dipetakan ke kolom terdekat.
 *   6. BARIS LOGIS : baris baru mulai saat kolom No terisi (nomor urut).
 *
 * Semua tabel pakai engine yang sama;beda cuma di daftar kata kunci header & pemetaan
 * kolomnya (lihat TABLE_SPECS).
 */
const pdfParse = require('pdf-parse');

/** Parse PDF → { text, items:[{s,x,y,w,page}] } */
async function parsePdf(buf) {
    const items = [];
    let page = 0;
    const pagerender = (pageData) => pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: true }).then((tc) => {
        page++;
        for (const it of tc.items) {
            if (!it.str || !it.str.trim()) continue;
            items.push({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0, page });
        }
        let lastY = null, text = '';
        for (const it of tc.items) {
            if (lastY === null || it.transform[5] === lastY) text += it.str;
            else text += '\n' + it.str;
            lastY = it.transform[5];
        }
        return text;
    });
    const data = await pdfParse(buf, { pagerender });
    return { text: data.text, items, numpages: data.numpages };
}

// ── Spec per tabel: kata kunci header + pemetaan ke kolom output ──
const TABLE_SPECS = {
    personel: {
        anchor: 'jabatan',
        requireAny: ['pengalaman', 'sertifikat'],
        words: [
            { kind: 'no', re: /^\s*N(?:o\.?)?\s*$/i },
            { kind: 'jabatan', re: /^\s*Jabatan/i },
            { kind: 'ijazah', re: /^\s*(Tingkat|Pendidikan|Ijazah)/i },
            { kind: 'pengalaman', re: /^\s*Penga/i },
            { kind: 'sertifikat', re: /^\s*(Sertifikat|Kompetensi)/i },
            { kind: 'jumlah', re: /^\s*(Jumla?h|Jml|Orang)/i },
        ],
        columns: [
            { out: 'No', kinds: ['no'] },
            { out: 'Jabatan', kinds: ['jabatan'] },
            { out: 'Jumlah (Orang)', kinds: ['jumlah'] },
            { out: 'Pengalaman Kerja (tahun)', kinds: ['pengalaman', 'ijazah'] },
            { out: 'Sertifikat Kompetensi Kerja', kinds: ['sertifikat'] },
        ],
    },
    peralatan: {
        anchor: 'jenis',
        requireAny: ['kapasitas', 'jumlah'],
        words: [
            { kind: 'no', re: /^\s*N(?:o\.?)?\s*$/i },
            { kind: 'jenis', re: /^\s*(Jenis|Alat)/i },
            { kind: 'kapasitas', re: /^\s*Kapasitas/i },
            { kind: 'jumlah', re: /^\s*(Jumla?h|Jml|Orang)/i },
        ],
        columns: [
            { out: 'No', kinds: ['no'] },
            { out: 'Jenis Alat', kinds: ['jenis'] },
            { out: 'Kapasitas', kinds: ['kapasitas'] },
            { out: 'Jumlah', kinds: ['jumlah'] },
        ],
    },
    rkk: {
        anchor: 'uraian',
        requireAny: ['bahaya', 'pekerjaan'],
        words: [
            { kind: 'no', re: /^\s*N(?:o\.?)?\s*$/i },
            { kind: 'uraian', re: /^\s*Uraian/i },
            { kind: 'pekerjaan', re: /^\s*Pekerjaan/i },
            { kind: 'bahaya', re: /^\s*(Identifikasi|Bahaya)/i },
        ],
        columns: [
            { out: 'No', kinds: ['no'] },
            { out: 'Uraian Pekerjaan', kinds: ['uraian', 'pekerjaan'] },
            { out: 'Identifikasi Bahaya', kinds: ['bahaya'] },
        ],
    },
};

/** Grupkan item jadi baris visual (y sama). */
function visualRows(items, tol = 3) {
    const rows = [];
    for (const it of items.slice().sort((a, b) => b.y - a.y || a.x - b.x)) {
        let r = rows.find((r) => Math.abs(r.y - it.y) <= tol);
        if (r) { r.items.push(it); r.y = (r.y * (r.items.length - 1) + it.y) / r.items.length; }
        else rows.push({ y: it.y, items: [it] });
    }
    rows.forEach((r) => r.items.sort((a, b) => a.x - b.x));
    return rows.sort((a, b) => b.y - a.y);
}

/**
 * Proyeksi whitespace vertikal → batas kolom.
 * @returns [[x0,x1], ...] rentang kolom (terpisah celah whitespace)
 */
function columnRuns(items) {
    if (!items.length) return [];
    let min = Infinity, max = -Infinity;
    for (const it of items) { min = Math.min(min, it.x); max = Math.max(max, it.x + (it.w || 0)); }
    const n = Math.ceil(max - min) + 2;
    const cover = new Uint8Array(n);
    for (const it of items) {
        const i0 = Math.max(0, Math.floor(it.x - min));
        const i1 = Math.min(n - 1, Math.ceil(it.x + (it.w || 0) - min));
        for (let i = i0; i <= i1; i++) cover[i] = 1;
    }
    const runs = [];
    let start = -1;
    for (let i = 0; i < n; i++) {
        if (cover[i]) { if (start === -1) start = i; }
        else if (start !== -1) { runs.push([start + min, i + min]); start = -1; }
    }
    if (start !== -1) runs.push([start + min, n + min]);
    return runs.filter((r) => r[1] - r[0] >= 4);   // buang run sempit (noise antar kata)
}

/** Isi sel pada baris visual: item2 yg masuk rentang kolom. */
function cellOf(row, runs, ci) {
    const r = runs[ci];
    return row.items
        .filter((i) => i.x + (i.w || 0) > r[0] && i.x < r[1])
        .map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim();
}

/** Kandidat header tabel: item anchor + kata kunci lain di dekatnya. */
function findHeaderCandidates(items, spec) {
    const out = [];
    for (const pg of [...new Set(items.map((i) => i.page))]) {
        const pi = items.filter((i) => i.page === pg);
        const anchor = spec.words.find((w) => w.kind === spec.anchor);
        for (const h of pi.filter((i) => anchor.re.test(i.s.trim()))) {
            const near = pi.filter((i) => Math.abs(i.y - h.y) <= 90);
            const kinds = new Map();
            for (const { kind, re } of spec.words) {
                if (kinds.has(kind)) continue;
                let best = null, bestD = 1e9;
                for (const i of near) {
                    if (!re.test(i.s.trim())) continue;
                    const d = Math.abs(i.y - h.y);
                    if (d < bestD) { bestD = d; best = i; }
                }
                if (best) kinds.set(kind, best);
            }
            if (!kinds.has(spec.anchor)) continue;
            if (!spec.requireAny.some((k) => kinds.has(k))) continue;
            out.push({ page: pg, y: h.y, kinds });
        }
    }
    return out;
}

/** Area data tabel: item di bawah header, berhenti di Keterangan/sub-seksi/seksi baru/celah. */
function dataRegion(items, hdr) {
    const pi = items.filter((i) => i.page === hdr.page);
    const rows = visualRows(pi.filter((i) => i.y < hdr.y - 4));
    const out = [];
    let prevY = null;
    for (const r of rows) {
        const lineText = r.items.map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim();
        if (/^\s*Keterangan\b/i.test(lineText)) break;
        if (/^\s*[a-z]\.\s+[A-Z]/.test(lineText)) break;              // sub-seksi baru ("b. Untuk …")
        if (/^\s*\d+\.\s+[A-Z]/.test(lineText)) break;              // seksi baru ("4. Bagian …")
        if (/Uraian\s+Pekerjaan|Identifikasi\s+Bahaya|Jenis\s+Alat\b|Kapasitas\s+Jumlah/i.test(lineText)) break; // header tabel lain
        if (prevY !== null && r.y < prevY - 22) break;                 // celah vertikal besar
        out.push(r);
        prevY = r.y;
    }
    return out;
}

/** Bangun tabel dari kandidat header (engine generik). */
function buildFromHeader(items, hdr, spec) {
    const rows = dataRegion(items, hdr);
    if (!rows.length) return null;

    // ── KOLOM: proyeksi whitespace vertikal atas area tabel (otomatis, tanpa
    //           asumsi posisi kolom) ──
    const runs = columnRuns(rows.flatMap((r) => r.items));
    if (runs.length < 2) return null;

    // semantik: kata kunci header → kolom terdekat (batas tengah)
    const kindOf = new Array(runs.length).fill(null);
    for (const [kind, it] of hdr.kinds) {
        let best = -1, bd = 1e9;
        runs.forEach((r, i) => {
            const mid = (r[0] + r[1]) / 2;
            const d = Math.abs(mid - it.x);
            if (d < bd) { bd = d; best = i; }
        });
        if (best >= 0 && !kindOf[best]) kindOf[best] = kind;
    }
    // kolom No = kolom paling kiri yg isinya angka
    if (!kindOf.includes('no')) {
        const numish = runs.map((_, i) => {
            const vals = rows.map((r) => cellOf(r, runs, i)).filter(Boolean);
            return vals.length && vals.every((v) => /^\d+$/.test(v)) ? i : -1;
        }).filter((i) => i >= 0);
        if (numish.length) kindOf[numish[0]] = 'no';
    }
    if (!kindOf.includes(spec.anchor)) return null;

    // kolom output (urutan spec) → run index
    const colRuns = spec.columns.map((c) => {
        const idx = c.kinds.map((k) => kindOf.indexOf(k)).filter((i) => i >= 0);
        return { out: c.out, kinds: c.kinds, idx };
    }).filter((c) => c.idx.length);
    if (!colRuns.length) return null;

    // baris logis: baris baru mulai saat kolom No (atau kolom pertama) terisi
    const noIdx = kindOf.indexOf('no');
    const anchorIdx = noIdx >= 0 ? noIdx : colRuns[0].idx[0];
    // baris2 header (pecahan "N"+"o" dll) bukan data → mulai dr baris pertama
    // yg kolom-No-nya berisi angka
    let startRow = 0;
    if (noIdx >= 0) {
        const first = rows.findIndex((r) => /^\d+$/.test(cellOf(r, runs, noIdx)));
        if (first > 0) startRow = first;
    }
    const logical = [];
    for (const r of rows.slice(startRow)) {
        const cells = runs.map((_, i) => cellOf(r, runs, i));
        if (cells[anchorIdx] !== '' || !logical.length) logical.push(cells.map((c) => (c ? [c] : [])));
        else cells.forEach((c, ci) => { if (c) logical[logical.length - 1][ci].push(c); });
    }

    const out = [];
    for (const cells of logical) {
        const row = colRuns.map((c) => c.idx.map((i) => cells[i].join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ').trim());
        if (row.length > 1 && !row[1]) continue;                 // tanpa isi kolom utama → bukan data
        if (row.some((v) => /^[_.]+$/i.test(v))) continue;          // placeholder form
        if (row.some((v) => /_{2,}|\bdst\b|^CONTOH$/i.test(v))) continue;
        out.push(row);
    }
    if (!out.length) return null;

    // buang kolom kosong di semua baris + samakan header
    const keep = colRuns.map((_, i) => out.some((r) => r[i]));
    const header = colRuns.filter((_, i) => keep[i]).map((c) => c.out);
    const rowsOut = out.map((r) => r.filter((_, i) => keep[i]));
    return { header, rows: rowsOut };
}

/**
 * Rekonstruksi tabel dari koordinat (pilih kandidat header terbaik).
 * @param {string} type 'personel' | 'peralatan' | 'rkk'
 */
function tableByCoords(items, type) {
    const spec = TABLE_SPECS[type];
    if (!spec) return null;
    let best = null, bestScore = -1;
    for (const hdr of findHeaderCandidates(items, spec)) {
        const t = buildFromHeader(items, hdr, spec);
        if (!t) continue;
        const filled = t.rows.filter((r) => r[r.length - 1] && !/_{2,}|\bdst\b|CONTOH/i.test(r[r.length - 1])).length;
        // tabel yg kolom-No-nya bernomor urut (1,2,3…) = kandidat asli → skor tinggi
        const noCol = t.header.findIndex((h) => /^no$/i.test(h));
        const nums = noCol >= 0 ? t.rows.map((r) => String(r[noCol] || '').replace(/[.)]+$/, '')) : [];
        const hasNo = nums.length > 0 && nums.every((n, i) => n === String(i + 1));
        const score = (hasNo ? 100000 : 0) + filled * 100 + t.rows.length;
        if (score > bestScore) { bestScore = score; best = t; }
    }
    return best;
}

const personelByCoords = (items) => tableByCoords(items, 'personel');
const peralatanByCoords = (items) => tableByCoords(items, 'peralatan');
const rkkByCoords = (items) => tableByCoords(items, 'rkk');

module.exports = { parsePdf, personelByCoords, peralatanByCoords, rkkByCoords, tableByCoords };
