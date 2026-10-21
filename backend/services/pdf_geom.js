/**
 * Rekonstruksi tabel LDP dari KOORDINAT pdf.js.
 *
 *Parser berbasis text-stream punya batas: sel"& kolom PDF interleaved, jadi nilai sel
 * (mis. pengalaman "2") dan nomor baris ("2.")形态 sama → tak bisa dibedakan.
 * Dengan koordinat, tiap sel punya posisi x → kolom bisa dipisah akurat.
 *
 * Sumber data: pdf-parse 1.1.1 (pdf.js v1.10.100) → page.getTextContent() memberi
 * item.str + transform[4] (x) + transform[5] (y).
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
        // teks dengan urutan baca yg sama spt pdf-parse bawaan
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

// ── Kata kunci header kolom tabel personel ──
const COL_WORDS = [
    { kind: 'no',        re: /^\s*No\.?\s*$/i },
    { kind: 'jabatan',   re: /^\s*Jabatan/i },
    { kind: 'ijazah',    re: /^\s*(Tingkat|Pendidikan|Ijazah|Pendidikan\/Ijazah)/i },
    { kind: 'pengalaman', re: /^\s*Penga/i },
    { kind: 'sertifikat', re: /^\s*(Sertifikat|Kompetensi)/i },
    { kind: 'jumlah',    re: /^\s*(Jumla?h|Jml|Orang)/i },
];

/** Cari kandidat header tabel personel (bisa >1 per dokumen: form + tabel syarat). */
function findPersonelHeaders(items) {
    const out = [];
    for (const pg of [...new Set(items.map((i) => i.page))]) {
        const pi = items.filter((i) => i.page === pg);
        for (const h of pi.filter((i) => /^Jabatan/i.test(i.s.trim()))) {
            const near = pi.filter((i) => Math.abs(i.y - h.y) <= 80);
            const pick = (re) => {
                let best = null, bestD = 1e9;
                for (const i of near) {
                    if (!re.test(i.s.trim())) continue;
                    const d = Math.abs(i.y - h.y);
                    if (d < bestD) { bestD = d; best = i; }
                }
                return best;
            };
            const kinds = new Map();
            kinds.set('jabatan', h);
            const peng = pick(/^\s*Penga/i);
            const sert = pick(/^\s*(Sertifikat|Kompetensi)/i);
            if (!peng && !sert) continue;                 // bukan header tabel personel
            if (peng) kinds.set('pengalaman', peng);
            if (sert) kinds.set('sertifikat', sert);
            const no = pick(/^\s*N(?:o\.?)?\s*$/i);
            if (no) kinds.set('no', no);
            const jml = pick(/^\s*(Jumla?h|Jml|Orang)/i);
            if (jml) kinds.set('jumlah', jml);
            const ija = pick(/^\s*(Tingkat|Pendidikan|Ijazah)/i);
            if (ija) kinds.set('ijazah', ija);
            // baris header bisa multi-baris (Jabatan di atas, Pengalaman/Sertifikat di bawahnya)
            // → area data mulai dari baris header TERENDAH
            const yBottom = Math.max(...[...kinds.values()].map((i) => i.y));
            out.push({ page: pg, y: h.y, yBottom, kinds });
        }
    }
    return out;
}

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
 * Rekonstruksi tabel personel dari koordinat.
 * @returns {{header: string[], rows: string[][]}|null}
 */
function personelByCoords(items) {
    const headers = findPersonelHeaders(items);
    let best = null, bestScore = -1;
    for (const hdr of headers) {
        const t = buildFromHeader(items, hdr);
        if (!t) continue;
        // skor: jumlah baris dgn sertifikat terisi (tabel form placeholder → nilai kosong)
        const filled = t.rows.filter((r) => r[4] && !/_{2,}|\bdst\b|CONTOH/i.test(r[4])).length;
        const score = filled * 100 + t.rows.length;
        if (score > bestScore) { bestScore = score; best = t; }
    }
    return best;
}

function buildFromHeader(items, hdr) {
    // batas kolom: x tiap kata kunci header (x terkecil utk kata2 yg sama)
    const cols = [...hdr.kinds.entries()]
        .map(([kind, it]) => ({ kind, x: it.x }))
        .sort((a, b) => a.x - b.x);
    if (cols.length < 2) return null;

    const pi = items.filter((i) => i.page === hdr.page);
    const rows = visualRows(pi.filter((i) => i.y < hdr.y - 4));

    // kolom penanda baris: No kalo ada, else Jabatan
    const anchorKind = cols.some((c) => c.kind === 'no') ? 'no' : 'jabatan';
    const anchorIdx = cols.findIndex((c) => c.kind === anchorKind);

    // Sel = item2 yg berdekatan (sel membungkus kata ke baris berikutnya) → pakai
    // tepi kanan item (x+w) buat nentuin Stillness. lalu tiap sel masuk ke kolom
    // berdasar TITIK TENGAH sel (sel bisa|centered, jg bukan).
    const cellsOf = (r) => {
        const cells = [];
        let cur = null;
        for (const it of r.items) {
            if (!cur || it.x - cur.lastX > 12) { cur = { x: it.x, lastX: it.x, txt: [] }; cells.push(cur); }
            cur.txt.push(it.s);
            cur.lastX = it.x;
        }
        return cols.map((c, ci) => {
            const x0 = c.x - 6;
            const x1 = cols[ci + 1] ? cols[ci + 1].x - 6 : Infinity;
            return cells.filter((cc) => cc.x >= x0 && cc.x < x1)
                .map((cc) => cc.txt.join(' ').replace(/\s+/g, ' ').trim()).join(' ').trim();
        });
    };

    // area data: baris2 header (kolom No kosong) dilewati; mulai dr baris pertama
    // yang kolom-No-nya berisi angka. Berhenti di "Keterangan"/sub-seksi/header tabel lain.
    const dataRows = [];
    let started = false;
    for (const r of rows) {
        const lineText = r.items.map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim();
        if (!started) {
            const cells = cellsOf(r);
            if (/^\d+$/.test(cells[anchorIdx] || '')) started = true;
            else continue;
        }
        if (/^\s*(?:Keterangan\b|[a-z]\.\s+[A-Z])/i.test(lineText)) break;
        if (/Uraian\s+Pekerjaan|Identifikasi\s+Bahaya|Jenis\s+Alat\b|Kapasitas\s+Jumlah/i.test(lineText)) break;
        dataRows.push(r);
    }
    if (!dataRows.length) return null;

    // baris logis: baris baru mulai saat kolom penanda terisi
    const logical = [];
    for (const r of dataRows) {
        const cells = cellsOf(r);
        if (cells[anchorIdx] !== '' || !logical.length) logical.push(cells.map((c) => (c ? [c] : [])));
        else cells.forEach((c, ci) => { if (c) logical[logical.length - 1][ci].push(c); });
    }

    const out = [];
    for (const cells of logical) {
        const get = (kind) => {
            const i = cols.findIndex((c) => c.kind === kind);
            return i === -1 ? '' : cells[i].join(' ').replace(/\s+/g, ' ').trim();
        };
        const no = get('no');
        const jabatan = get('jabatan');
        if (!jabatan) continue;
        const jumlah = get('jumlah');
        const pengalaman = get('pengalaman') || get('ijazah');
        const sertifikat = get('sertifikat');
        if (!sertifikat) continue;
        // baris placeholder form ("___", "dst", "CONTOH") → bukan data nyata
        if (/^[_\.]+$/i.test(jabatan)) continue;
        if (/_{2,}|\bdst\b|^CONTOH$/i.test(sertifikat) && !/^SK/i.test(sertifikat)) continue;
        out.push([no || String(out.length + 1), jabatan, jumlah, pengalaman, sertifikat]);
    }
    if (!out.length) return null;

    const header = ['No', 'Jabatan'];
    if (cols.some((c) => c.kind === 'jumlah')) header.push('Jumlah (Orang)');
    header.push('Pengalaman Kerja (tahun)', 'Sertifikat Kompetensi Kerja');
    return { header, rows: out };
}

module.exports = { parsePdf, personelByCoords, findPersonelHeaders, buildFromHeader, visualRows };
