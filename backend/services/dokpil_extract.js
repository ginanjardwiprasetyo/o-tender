/**
 * Dokpil LDP extractor — deterministik dari teks BAB IV (LEMBAR DATA PEMILIHAN).
 * Patokan akurasi: panel "Preview BAB IV" (raw text) di UI #dokpil —
 * fixture: fixtures/ldp-brspa.txt, test: test_dokpil_extract.js.
 * ponytail: parser berbasis label/baris LDP (format standar SPSE); kalau ada PDF
 * yang kolomnya tak terurai rapi, upgrade = rekonstruksi kolom via koordinat pdfjs-dist.
 */
const { terbilang } = require('../utils/terbilang');

// Cari posisi BAB IV LEMBAR DATA PEMILIHAN yang SESUNGGUHNYA (bukan entri Daftar Isi)
function findLDP(text) {
    const re = /(?:BAB\s+IV[.\s-]*)?LEMBAR\s+DATA\s+PEMILIHAN/gi;
    let m, last = -1;
    while ((m = re.exec(text)) !== null) {
        const window = text.substring(m.index, m.index + 6000);
        if (/Identitas\s+Pokja|Alamat\s+Pokja\s+Pemilihan|Nama\s+paket\s+pekerjaan|Lingkup\s+Pekerjaan/i.test(window)) last = m.index;
    }
    if (last !== -1) return last;
    const first = text.search(/(?:BAB\s+IV[.\s-]*)?LEMBAR\s+DATA\s+PEMILIHAN/i);
    if (first !== -1) return first;
    const alt = text.search(/Lembar\s+Data|LDP/i);
    if (alt !== -1) return alt;
    return 0;
}

// Ambil teks dari start pattern sampai end pattern (atau akhir teks)
function grab(str, startPat, endPat) {
    const m = str.match(new RegExp(startPat, 'i'));
    if (!m) return '';
    const from = m.index + m[0].length;
    const rest = str.substring(from);
    if (!endPat) return rest.trim();
    const ei = rest.search(new RegExp(endPat, 'i'));
    const to = ei === -1 ? rest.length : ei;
    return rest.substring(0, to).trim();
}

// Bersihkan nilai field: gabung spasi/newline, buang marker list
function cleanVal(s) {
    s = String(s || '').split(/\[diisi/i)[0];  // buang teks instruksi isian ("[diisi …]")
    s = s.replace(/\s+/g, ' ').trim();
    s = s.replace(/^[a-z]\.\s*/i, '');
    s = s.replace(/\s+[a-z]\.\s*$/i, '');
    s = s.replace(/^[:-]\s*/, '');
    s = s.replace(/\s*[:-]$/, '');
    return s.trim();
}

const HEADERS = {
    peralatan: ['No', 'Jenis Alat', 'Kapasitas', 'Jumlah'],
    personel: ['No', 'Jabatan', 'Pengalaman Kerja (tahun)', 'Sertifikat Kompetensi Kerja'],
    rkk: ['No', 'Uraian Pekerjaan', 'Identifikasi Bahaya'],
};

// Kosakata dokumen (kata → frekuensi) utk menyambung kata yg terpotong antar baris.
function buildVocab(text) {
    const cnt = new Map();
    for (const w of String(text || '').match(/[A-Za-z]+/g) || []) {
        const k = w.toLowerCase();
        cnt.set(k, (cnt.get(k) || 0) + 1);
    }
    return cnt;
}

// PDF kolom sempit memotong kata di tengah baris ("dipersya"+"ratkan" → "dipersyaratkan").
// Gabung kalo hasil gabung ada di kosakata dokumen & jauh lebih sering drpd pecahan pertamanya.
function joinBrokenWords(lines, vocab) {
    const out = [];
    for (const raw of lines) {
        let cur = raw;
        while (out.length) {
            const prev = out[out.length - 1];
            const mp = prev.match(/^(.*?)([A-Za-z]+)(\s*)$/);
            const mc = cur.match(/^(\s*)([A-Za-z]+)(.*)$/);
            if (!mp || !mc) break;
            const a = mp[2], b = mc[2];
            const joined = (a + b).toLowerCase();
            const cJoined = vocab.get(joined) || 0;
            const cA = vocab.get(a.toLowerCase()) || 0;
            if (cJoined < 2 || cJoined <= cA * 2) break;
            out[out.length - 1] = mp[1] + a + b + mc[3];
            cur = null;
            break;
        }
        if (cur !== null) out.push(cur);
    }
    return out;
}

// Struktur kolom tabel personel dari header:
//   jumlah      = ada kolom "Jumlah (Orang)"?
//   jumlahFirst = "Jumlah" muncul SEBELUM "Pengalaman" di header? (urutan kolom beda antar LDP)
// Header di PDF sering terpecah ("Juml"+"ah", "Penga-"+"laman") → spasi dibuang saat dicari.
function personelCols(lines) {
    const idx = lines.findIndex(l => /^\d+\.?\s+[^\s\d]/.test(l));
    const head = (idx === -1 ? lines : lines.slice(0, idx)).join(' ');
    const flat = head.replace(/\s+/g, '');
    const jml = flat.search(/jumla?h|jml|orang/i);   // "Jumlah" kadang terpotong jadi "Jml"
    if (jml === -1) return { jumlah: false, jumlahFirst: false };
    const peng = flat.search(/pengalaman|penga-laman|tahun/i);
    if (peng === -1) return { jumlah: true, jumlahFirst: true };
    return { jumlah: true, jumlahFirst: jml < peng };
}

// Baris penanda akhir seksi (item daftar global berikutnya)
const END_ITEM_RE = /^\s*(?:\d+\.\s+)?(?:Memiliki|Bagian|Pernyataan|Rencana|Cara|Preferensi|Bentuk|Jaminan|Ketentuan|Atas\s+penggunaan|Pembayaran)/i;
// Noise header/footer halaman yang tak boleh jadi lanjutan baris tabel
const NOISE_RE = /^(?:Paraf\b|HAL\b|KETENTUAN DAN INFORMASI|[-–—]\s*\d+\s*[-–—]$)/i;
const HDR_FRAGMENT_RE = /^(?:No\.?|Jabatan|Kapasitas|Jumlah|Uraian|Identifikasi|Bahaya|Sertifikat Kompetensi|Pengalaman|Kerja|Jenis)$/i;
// Baris placeholder template (bukan data nyata): garis bawah, titik-titik, "Dst Catatan"
const PLACEHOLDER_RE = /^(?:_{3,}|\.{3,}|Dst\s+Catatan|Catatan\s*:)|\s+_{3,}$|\.{4,}/i;

/** Baris dari setelah baris anchor sampai baris end (terakhir tidak diambil). */
function sectionLines(lines, anchorRe, endRe) {
    const start = lines.findIndex(l => anchorRe.test(l));
    if (start === -1) return [];
    const out = [];
    for (let i = start + 1; i < lines.length; i++) {
        if (endRe.test(lines[i])) break;
        if (NOISE_RE.test(lines[i].trim())) continue;
        out.push(lines[i]);
    }
    return out;
}

/** Kelompokkan baris jadi row bernomor urut (1,2,3…); sisanya = lanjutan row.
 * Nomor baris WAJIB diikuti karakter non-angka: baris "2 1 SKK Execute" itu
 * continuation baris sebelumnya (nilai pengalaman=2 + jumlah=1), bukan baris baru.
 * Nomor juga boleh berdiri sendiri ("1." di baris sendiri, isi di baris bawahnya) —
 * tapi hanya kalau baris berikutnya bukan angka (kalau angka itu nilai sel, bukan baris baru). */
function groupRows(lines) {
    const rows = [];
    let cur = null, expected = 1;
    const clean = lines.map(s => s.replace(/[ \t]+$/, '').trim()).filter(Boolean);
    for (let i = 0; i < clean.length; i++) {
        const l = clean[i];
        if (HDR_FRAGMENT_RE.test(l) || NOISE_RE.test(l) || PLACEHOLDER_RE.test(l)) continue;
        let m = l.match(/^(\d+)(\.?)\s*(.*)$/);
        if (m) {
            const n = parseInt(m[1], 10);
            const content = m[3].trim();
            if (n !== expected) m = null;                       // bukan urutan baris → nilai sel
            else if (content && !/^[^\s\d]/.test(content)) m = null;  // "2 1 SKT …" → continuation
            // angka sendirian: marker hanya kalo bertitik ("1.") atau baris pertama,
            // & baris berikutnya bukan angka (kalau angka itu nilai sel, bukan baris baru)
            else if (!content && (!m[2] && cur)) m = null;
            else if (!content && /^\d/.test(clean[i + 1] || '')) m = null;
        }
        if (m) {
            if (cur) rows.push(cur);
            cur = { no: String(expected), parts: [m[3].trim()] };
            expected = parseInt(m[1], 10) + 1;
        } else if (cur) {
            if (/^\s*\d+\.\s+[A-Z]/.test(l)) break; // item daftar global baru → row selesai
            if (/^\s*[a-z]\.\s+[A-Z]/.test(l)) break; // sub-seksi baru ("b. Untuk pekerjaan …") → row selesai
            if (/^\s*Keterangan\s*:/i.test(l)) break; // catatan bawah tabel → row selesai
            cur.parts.push(l);
        }
        // baris sebelum row pertama (header tabel/yaitu:) diabaikan
    }
    if (cur) rows.push(cur);
    return rows.map(r => ({ no: r.no, text: r.parts.join(' ').replace(/\s{2,}/g, ' ').trim() }));
}

/** Bersihkan satu sel tabel: buang teks instruksi isian ("[diisi …]") & sisa placeholder. */
function cleanCell(v) {
    return String(v || '').split(/\[diisi/i)[0].replace(/_{3,}|\.{4,}/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

/** peralatan: <jenis> <kapasitas?> <jumlah [..]> */
function parsePeralatan(no, text) {
    if (!text) return null;
    let pre = text, jumlah = '';
    const qty = text.match(/(\d+)\s*(?:unit|set|bh|buah|org|paket|orang|kali|lot|ls)\b/i);
    if (qty) {
        jumlah = text.substring(qty.index).trim();
        pre = text.substring(0, qty.index).trim();
    } else {
        // jumlah tanpa satuan di ekor (mis. "Excavator 0.7 m3 1")
        const bare = text.match(/\s+(\d+)\s*$/);
        if (bare && bare.index > 0) {
            jumlah = bare[1];
            pre = text.substring(0, bare.index).trim();
        }
    }
    const cap = pre.match(/^(.*?)\s*(\d[\d.,]*\s*(?:[–\-]\s*\d[\d.,]*\s*)?(?:m3|m2|m³|cc|meter|ton|kg|lt|liter|ps|hp|kva|kw|cv|pk|bar|psi|btu|kaki|m)\b.*)$/i);
    let jenis = pre, kap = '';
    if (cap && cap[1].trim()) { jenis = cap[1].trim(); kap = cap[2].trim(); }
    if (!jenis && !kap && !jumlah) return null;
    return [no, cleanCell(jenis), cleanCell(kap), cleanCell(jumlah)];
}

/** personel: <jabatan> [jumlah|pengalaman] [N tahun|tidak dipersyaratkan] <sertifikat…>
 * Kolom & URUTAN-nya beda antar LDP:
 *   - "Jabatan | Jumlah (Orang) | Pengalaman | Sertifikat"   (mis. SDN 3 Gentan)
 *   - "Jabatan | Pengalaman | Jumlah (Orang) | Sertifikat"   (mis. LDP Polly, SMA N 7)
 * Pengalaman bisa "N Tahun", "Tidak dipersyaratkan", atau angka polos ("2").
 * Karena pengalaman polos & jumlah sama-sama angka, urutannya diambil dari header.
 * Tanpa kolom Jumlah → angka polos di ekor = pengalaman. */
function parsePersonel(no, text, cols) {
    if (!text) return null;
    const CERT = '(?:SKK|SKT|SKA|SKP|SKG|SIP|SIO|Sertifikat|BNSP|LSP|LSK|Strata|Sarjana|Diploma|Gelar|Pelatihan|Training|Profesional|Tenaga Ahli)(?![A-Za-z])';

    // ── Tabel TANPA kolom "Jumlah (Orang)": Pablo = Jabatan | Pengalaman | Sertifikat.
    // Batasnya keyword sertifikat, pengalaman = "N Tahun" atau angka polos di ujung.
    if (!cols.jumlah) {
        const cm = text.match(new RegExp(CERT, 'i'));
        if (cm && cm.index > 0) {
            let before = text.slice(0, cm.index).trim();
            const sert = text.slice(cm.index).trim();
            let peng = '';
            let pm = before.match(/\s+(\d+)\s*(?:tahun|thn|th)\b/i);
            if (pm) { peng = `${pm[1]} Tahun`; before = before.slice(0, pm.index).trim(); }
            else { pm = before.match(/\s+(\d+)\s*$/); if (pm) { peng = `${pm[1]} Tahun`; before = before.slice(0, pm.index).trim(); } }
            before = before.replace(/\s*[-–—:.\s]+$/, '').trim().replace(/\s*\/\s*/g, '/');
            if (before) return [no, cleanCell(before), '', peng, cleanCell(sert)];
        }
        const ym = text.match(/^(.*?)\s*(\d+)\s*(?:tahun|thn|th)\b\s*(?:\([^)]*\))?\s+(.*)$/i);
        if (ym && ym[1] && ym[3]) return [no, cleanCell(ym[1]), '', `${ym[2]} Tahun`, cleanCell(ym[3])];
        return [no, cleanCell(text), '', '', ''];
    }

    // ── Tabel DGN kolom "Jumlah (Orang)": kolom2+ = jumlah / pengalaman / sertifikat.
    // Konsumsi kolom angka dari DEPAN (urutan kolom dari header), sisanya = sertifikat.
    // Batas Jabatan = angka polos pertama (kolom2+ = jumlah/pengalaman/sertifikat).
    const mn = text.match(/\s+(\d+)(?![A-Za-z])/);
    const mtdk = text.match(/\s+(tidak\s+dipersya\s*ratkan)/i);
    const cuts = [];
    if (mn) cuts.push(mn.index);
    if (mtdk) cuts.push(mtdk.index);
    let jab = '', rest = text;
    if (cuts.length) {
        const c = Math.min(...cuts);
        jab = text.slice(0, c).trim();
        rest = text.slice(c).trim();
    } else {
        const cm0 = text.match(new RegExp(CERT, 'i'));
        if (cm0 && cm0.index > 0) { jab = text.slice(0, cm0.index).trim(); rest = text.slice(cm0.index).trim(); }
        else { jab = text.trim(); rest = ''; }
    }
    jab = jab.replace(/\s*[-–—:.\s]+$/, '').trim().replace(/\s*\/\s*/g, '/');
    if (!jab) return null;

    const RE_JML  = /^(\d+)\s*(?:orang|personil)?\b\s*/i;
    const RE_PENG = /^(?:(\d+)\s*(?:tahun|thn|th)\b|(tidak\s+dipersya\s*ratkan)(?:\s+pengala\s*man)?)\s*/i;
    let jml = '', peng = '';
    const takeJml = () => { const m = RE_JML.exec(rest); if (m) { jml = m[1]; rest = rest.slice(m[0].length); return true; } return false; };
    // pengalaman boleh juga angka polos ("2") → pakai urutan kolom sbg penentu
    const takePeng = (allowBare) => {
        const m = RE_PENG.exec(rest);
        if (m) { peng = m[1] ? `${m[1]} Tahun` : 'Tidak dipersyaratkan'; rest = rest.slice(m[0].length); return true; }
        if (allowBare) { const b = /^(\d+)\b\s*/.exec(rest); if (b) { peng = `${b[1]} Tahun`; rest = rest.slice(b[0].length); return true; } }
        return false;
    };
    if (cols.jumlahFirst) { takeJml(); takePeng(true); }
    else { takePeng(true); takeJml(); }
    // kolom jumlah di ujung baris: ambil angka polos terakhir
    if (!jml) { const m = rest.match(/\s+(\d+)\s*$/); if (m) { jml = m[1]; rest = rest.slice(0, m.index).trim(); } }
    if (!peng) { const m = rest.match(/^(\d+)\b\s*/); if (m) { peng = `${m[1]} Tahun`; rest = rest.slice(m[0].length); } }
    return [no, cleanCell(jab), jml, peng, cleanCell(rest)];
}

// ponytail: split RKK (uraian | bahaya) — 2+ spasi dulu, lalu leksikon awal kata bahaya;
// kalau mulai sering meleset → pakai koordinat kolom pdfjs-dist
const BAHAYA_RE = /\s+(?=(?:Ter(?:jatuh|peleset|timpa|lindas|bakar|sengat|guling|cebur|perosot|pecah|gelincir|tumbang|campak|perangkap|jegal|senggol|pepet|pental|tumpah|tular|jadi|paku|tancap|jepit|lilit|jerat|perosok|tahan|kait|perangkap)|Kebakaran|Kebocoran|Keruntuhan|Keracunan|Longsor|Ambruk|Putus|Runtuh|Roboh|Retak|Patah|Letusan|Ledakan|Banjir|Genangan|Gempa|Radiasi|Getaran|Paparan|Bising|Debu|Asap|Uap|Aliran|Hubung|Sentuh|Pendulum|Beban|Ketinggian|Akibat|Bahaya|Tertimpa|Tersengat|Terguling|Tergelincir|Tertuang|Tertekan|Kaca|Papan|Material|Peralatan|Mesin|Kendaraan|Listrik|Curah|Angin)\b)/i;

function parseRkk(no, text) {
    if (!text) return null;
    const sp = text.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
    if (sp.length >= 3) return [no, cleanCell(sp[0]), cleanCell(sp.slice(1).join(' '))];
    const hm = text.match(BAHAYA_RE);
    if (hm && hm.index > 0) return [no, cleanCell(text.slice(0, hm.index)), cleanCell(text.slice(hm.index))];
    return [no, cleanCell(text), ''];
}

function buildTable(type, lines) {
    if (!lines.length) return null;
    const parser = { peralatan: parsePeralatan, personel: parsePersonel, rkk: parseRkk }[type];
    const cols = type === 'personel' ? personelCols(lines) : null;
    let rows = groupRows(lines).map(r => parser(r.no, r.text, cols)).filter(Boolean);
    rows = rows.filter((r) => !r.some((v) => /\[(?:jenis|kapasitas|diisi)/i.test(String(v))));   // [diisi jenis, kapasitas…]
    if (!rows.length) return null;
    // Kolom "Jumlah (Orang)" hanya ada di sebagian LDP → header & rows ikut menyesuaikan
    if (type === 'personel' && !cols.jumlah) rows = rows.map(r => [r[0], r[1], r[3], r[4]]);
    const header = (type === 'personel' && cols.jumlah)
        ? ['No', 'Jabatan', 'Jumlah (Orang)', 'Pengalaman Kerja (tahun)', 'Sertifikat Kompetensi Kerja']
        : HEADERS[type];
    return { header, rows };
}

/**
 * Ekstrak fields + tabel dari teks LDP.
 * @returns {{fields: object, tables: {peralatan?: {header, rows}, personel?: {...}, rkk?: {...}}, debug: object}}
 */
function extractLdp(text, items) {
    const fields = {}, tables = {}, debug = { ldpStart: -1 };
    const clean = String(text || '').replace(/^[-–—]\s*\d+\s*[-–—]$/gm, '');
    const start = findLDP(clean);
    debug.ldpStart = start;
    if (start === -1) return { fields, tables, debug };
    const ldp = clean.substring(start);

    // ── Field berlabel (format standar SPSE) ──
    // label bisa diawali penanda list: "a. ", "- ", atau bernomor "3.2 "
    const LIST = '(?:[a-z]\\.\\s*|-\\s*|\\d+(?:\\.\\d+)*\\.?\\s*)';
    let v;
    // Pokja: label "Pokja Pemilihan" (dengan/tanpa kolon) → stop di Alamat/Website/next item.
    // Varian: "Kelompok Kerja (Pokja) Pemilihan 16" (label dgn sisa "Pemilihan").
    v = grab(ldp, `(?:^|\\n)\\s*${LIST}?(?:Kelompok\\s+Kerja\\s*)?\\(?\\s*Pokja\\s*\\)?\\s*Pemilihan\\s*:?\\s*`, '(?:^|\\n)\\s*(?:Alamat\\s+Pokja|Website\\s+LPSE|[b-z]\\.\\s+\\w)');
    if (v) fields.pokja = cleanVal(v);

    v = grab(ldp, `(?:^|\\n)\\s*${LIST}?Alamat\\s+Pokja(?:\\s+Pemilihan)?\\s*:?\\s*`, '(?:^|\\n)\\s*(?:[a-z]\\.\\s*|-\\s*)?Website\\s+LPSE');
    if (v) fields.alamat_pokja = cleanVal(v);

    v = grab(ldp, `(?:^|\\n)\\s*${LIST}?Nama\\s+paket\\s+pekerjaan\\s*:?\\s*`, '(?:^|\\n)\\s*(?:[a-z]\\.\\s*|-\\s*)?(?:Uraian\\s+singkat|Lingkup)');
    if (v) fields.nama_paket = cleanVal(v);

    v = grab(ldp, `(?:^|\\n)\\s*${LIST}?Lokasi\\s+pekerjaan\\s*:?\\s*`, '(?:^|\\n)\\s*(?:[A-J]\\.\\s*[A-Z]|[a-z]\\.\\s+|-\\s+)');
    if (v) fields.lokasi = cleanVal(v);

    // Jangka waktu: baris label "Jangka waktu pelaksanaan pekerjaan" (SEMUA kata di 1 baris,
    // bukan judul seksi yang terpecah "Jangka / Waktu / Pelaksanaan / Pekerjaan").
    // Nilai = baris pertama setelah label ATAU sisa baris yang sama setelah label.
    const jangkaM = ldp.match(/(?:^|\n)[ \t]*[^\n]*?Jangka\s+waktu\s+pelaksanaa?n\s+pekerjaan[ \t]*:[ \t]*(?:\n|[ \t]+)([^\n]*)/i)
        || ldp.match(/(?:^|\n)[ \t]*[^\n]*?Jangka\s+waktu\s+pelaksanaa?n\s+pekerjaan[ \t]+(\d+[^\n]*)/i);
    if (jangkaM) {
        const raw = (jangkaM[1] || '').trim();
        const n = raw.match(/(\d+)/);
        if (n) fields.jangka_waktu = n[1];
    }

    v = grab(ldp, `(?:^|\\n)\\s*(?:${LIST}|\\d+\\.\\s*)?Pagu\\s+[Aa]nggaran\\s*:?\\s*`, '(?:^|\\n)\\s*\\d+\\.\\s');
    if (v) {
        const raw = cleanVal(v);
        const num = raw.replace(/,\d{1,2}/g, '').replace(/[^\d]/g, '');
        fields.pagu_anggaran = num || raw;
        const parsedNum = parseInt(num, 10);
        if (parsedNum) fields.pagu_terbilang = terbilang(parsedNum);
    }

    // KIR: kemunculan di LDP = disyaratkan (tombol UI tetap tampil ya/tidak)
    fields.kir = /\bKIR\b/i.test(ldp) ? 'ya' : 'tidak';

    // ── Tabel dari seksi "F. Persyaratan Teknis" ──
    // Anchor peralatan: "peralatan utama" bisa terpisah baris atau tanpa "utama"
    const lines = ldp.split(/\r?\n/);
    // Kolom PDF sempit memotong kata di tengah baris ("dipersya"+"ratkan") → sambung dulu
    const vocab = buildVocab(clean);
    const t1 = buildTable('peralatan', sectionLines(lines, /peralatan\s*(?:utama)?|menyediakan\s+peralatan/i, END_ITEM_RE));
    if (t1) tables.peralatan = t1;
    const t2 = buildTable('personel', joinBrokenWords(sectionLines(lines, /personel\s+manajerial|personil\s+manajerial|menyediakan\s+personel/i, END_ITEM_RE), vocab));
    if (t2) tables.personel = t2;
    const t3 = buildTable('rkk', sectionLines(lines, /Rencana\s+Keselamatan\s+Konstruksi\s*\(?\s*RKK/i, END_ITEM_RE));
    if (t3) tables.rkk = t3;
    // Tabel dari KOORDINAT (pdf.js) — dipakai kalo hasil text-stream rusak
    // (baris tertempel / kolom kosong). Text-stream tak bisa bedain nilai sel "2"
    // vs nomor baris "2."; koordinat bisa.
    if (items && items.length) {
        try {
            const geom = require('./pdf_geom');
            const seqNo = (g) => {
                const noCol = g.header.findIndex((h) => /^no$/i.test(h));
                const nums = noCol >= 0 ? g.rows.map((r) => String(r[noCol] || '').replace(/[.)]+$/, '')) : [];
                return nums.length > 0 && nums.every((n, i) => n === String(i + 1));
            };
            // Tabel personel: pakai koordinat kalo hasil text-stream rusak
            const badPersonel = !tables.personel || !tables.personel.rows.length
                || tables.personel.rows.some((r) => !String(r[r.length - 1] || '').trim())
                // Jabatan yg membawa angka pengalaman/jumlah → baris kepotong
                || tables.personel.rows.some((r) => /\b\d+\s*(?:tahun|thn|th|orang|personil)\b/i.test(String(r[1] || '')))
                // Jabatan yg diawali "Tahun" → pengalaman yg kepotong jadi marker baris
                || tables.personel.rows.some((r) => /^\s*(?:tahun|thn)\b/i.test(String(r[1] || '')))
                // Dua baris steam jadi satu: sel memuat nomor baris berikut + kata jabatan
                || tables.personel.rows.some((r) => /\b[2-9]\d?\s+(?:Petugas|Pelaksana|Ahli|Kepala|Owner|Manajer|Teknisi)\b/i
                    .test(`${r[1] || ''} | ${r[r.length - 1] || ''}`));
            if (badPersonel) {
                const g = geom.personelByCoords(items);
                if (g && g.rows.length && seqNo(g)) { tables.personel = g; debug.personelSource = 'coords'; }
            }
            // peralatan & rkk: engine koordinat yg sama (spec berbeda). Ganti hasil
            // text-stream kalo koordinat lebih baik: baris lebih banyak (text-stream
            // suka menempelkan 2 baris jadi 1), kolom terakhir kosong, atau kosong.
            for (const t of ['peralatan', 'rkk']) {
                const g = geom.tableByCoords(items, t);
                if (!g || !g.rows.length || !seqNo(g)) continue;
                if (t === 'rkk' && !g.header.some((h) => /bahaya/i.test(h))) continue;   // salinan formulir BOQ bukan RKK
                const cur = tables[t];
                // teks remuk/referensi? (baris data berikut menerempel ke sel,
                // atau sel bahaya memuat proza syarat "Paket Pemilihan diberlakukan…")
                const curJunk = cur && cur.rows.some((r) => {
                    const c = `${r[1] || ''} ${r[r.length - 1] || ''}`;
                    return /(?:[4-6]\s+0\s+0\b)|(\b[2-9]\d?\s+[A-Z][a-zA-Z/]*[\s\S]+?\b\d+\s+(?:unit|orang|set)\b)/.test(c)
                        || /\b(?:Preferensi\s+Harga|Dokumen\s+Lain|;\s*[G-I]\.\s+\w)/.test(c);
                });
                const better = curJunk || !cur || !cur.rows.length
                    || g.rows.length > cur.rows.length
                    || cur.rows.some((r) => !String(r[r.length - 1] || '').trim());
                if (better) { tables[t] = g; debug[t + 'Source'] = 'coords'; }
            }
        } catch (e) { /* fallback ke text-stream */ }
    }

    debug.fields = Object.keys(fields);
    debug.tables = Object.keys(tables);
    return { fields, tables, debug };
}

module.exports = { findLDP, grab, cleanVal, extractLdp };
