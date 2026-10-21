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

// Tabel personel punya kolom "Jumlah (Orang)" pada sebagian LDP → jumlah orang (mis. "1")
// harus dipisah dari pengalaman kerja ("1 Tahun") supaya tidak mengotori kolom Jabatan.
function hasJumlahColumn(lines) {
    const idx = lines.findIndex(l => /^\s*\d+[.\s]/.test(l));
    const head = (idx === -1 ? lines : lines.slice(0, idx)).join(' ');
    return /jumla?h/i.test(head) || /juml/i.test(head);
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

/** Kelompokkan baris jadi row bernomor urut (1,2,3…); sisanya = lanjutan row. */
function groupRows(lines) {
    const rows = [];
    let cur = null, expected = 1;
    for (const raw of lines) {
        const l = raw.replace(/[ \t]+$/, '').trim();
        if (!l) continue;
        if (HDR_FRAGMENT_RE.test(l) || NOISE_RE.test(l) || PLACEHOLDER_RE.test(l)) continue;
        const m = l.match(/^(\d+)\.?\s+(.*)$/);
        const n = m ? parseInt(m[1], 10) : NaN;
        if (m && n === expected) {
            if (cur) rows.push(cur);
            cur = { no: String(expected), parts: [m[2].trim()] };
            expected = n + 1;
        } else if (cur) {
            if (/^\s*\d+\.\s+[A-Z]/.test(l)) break; // item daftar global baru → row selesai
            if (/^\s*Keterangan\s*:/i.test(l)) break; // catatan bawah tabel → row selesai
            cur.parts.push(l);
        }
        // baris sebelum row pertama (header tabel/yaitu:) diabaikan
    }
    if (cur) rows.push(cur);
    return rows.map(r => ({ no: r.no, text: r.parts.join(' ').replace(/\s{2,}/g, ' ').trim() }));
}

/** peralatan: <jenis> <kapasitas?> <jumlah [..]> */
function parsePeralatan(no, text) {
    if (!text) return null;
    let pre = text, jumlah = '';
    const qty = text.match(/(\d+)\s*(?:unit|set|bh|buah|org|paket|orang|kali|lot|ls)\b/i);
    if (qty) {
        jumlah = text.substring(qty.index).trim();
        pre = text.substring(0, qty.index).trim();
    }
    const cap = pre.match(/^(.*?)\s*(\d[\d.,]*\s*(?:[–\-]\s*\d[\d.,]*\s*)?(?:m3|m2|m³|cc|meter|ton|kg|lt|liter|ps|hp|kva|kw|cv|pk|bar|psi|btu|kaki|m)\b.*)$/i);
    let jenis = pre, kap = '';
    if (cap && cap[1].trim()) { jenis = cap[1].trim(); kap = cap[2].trim(); }
    if (!jenis && !kap && !jumlah) return null;
    return [no, jenis.trim(), kap, jumlah];
}

/** personel: <jabatan> [N tahun|tidak dipersyaratkan] [jumlah] <sertifikat…>
 * Kolom bisa beda layout DAN beda urutan antar LDP:
 *   - "Jabatan | Jumlah (Orang) | Pengalaman | Sertifikat"  (mis. SDN 3 Gentan)
 *   - "Jabatan | Pengalaman | Jumlah (Orang) | Sertifikat"  (mis. LDP Polly)
 * Jadi pengalaman DICARI di mana aja (bukan wajib di ujung), lalu sisa angka polos
 * di ujung = jumlah orang (hanya bila tabel punya kolom tsb).
 * Tanpa kolom Jumlah → angka polos di ujung = pengalaman. */
function parsePersonel(no, text, hasJumlah) {
    if (!text) return null;
    const CERT = '(?:SKK|SKT|SKA|SKP|SKG|SIP|SIO|Sertifikat|BNSP|LSP|LSK|Strata|Sarjana|Diploma|Gelar|Pelatihan|Training|Profesional|Tenaga Ahli)';
    const cm = text.match(new RegExp(CERT, 'i'));
    if (cm && cm.index > 0) {
        let before = text.slice(0, cm.index).trim();
        const sert = text.slice(cm.index).trim();
        let peng = '', jml = '';
        // buang sel pengalaman dr `before` (bisa di tengah, jg bisa di ujung)
        const cut = (m) => (before.slice(0, m.index) + ' ' + before.slice(m.index + m[0].length)).replace(/\s{2,}/g, ' ').trim();
        // 1) "N Tahun"
        let pm = before.match(/\s+(\d+)\s*(?:tahun|thn|th)\b/i);
        if (pm) { peng = `${pm[1]} Tahun`; before = cut(pm); }
        else {
            // 2) "Tidak dipersyaratkan pengalaman" — regex toleran pemenggalan kata
            pm = before.match(/\s+(tidak\s+dipersya\s*ratkan)(?:\s+pengala\s*man)?/i);
            if (pm) { peng = 'Tidak dipersyaratkan'; before = cut(pm); }
            // 3) tabel tanpa kolom Jumlah → angka polos di ujung = pengalaman
            else if (!hasJumlah) {
                pm = before.match(/\s+(\d+)\s*$/);
                if (pm) { peng = `${pm[1]} Tahun`; before = before.slice(0, pm.index).trim(); }
            }
        }
        // 4) kolom jumlah ada → sisa angka polos di ujung = jumlah orang
        if (hasJumlah) {
            const qm = before.match(/\s+(\d+)\s*$/);
            if (qm) { jml = qm[1]; before = before.slice(0, qm.index).trim(); }
        }
        before = before.replace(/\s*[-–—:.]\s*$/, '').trim();
        // "Konstruksi/ Ahli" → "Konstruksi/Ahli" (spasiSlash dr pemenggalan kolom PDF)
        before = before.replace(/\s*\/\s*/g, '/').trim();
        if (before) return [no, before, jml, peng, sert];
    }
    const ym = text.match(/^(.*?)\s*(\d+)\s*(?:tahun|thn|th)\b\s*(?:\([^)]*\))?\s+(.*)$/i);
    if (ym && ym[1] && ym[3]) return [no, ym[1].trim(), '', `${ym[2]} Tahun`, ym[3].trim()];
    return [no, text, '', '', ''];
}

// ponytail: split RKK (uraian | bahaya) — 2+ spasi dulu, lalu leksikon awal kata bahaya;
// kalau mulai sering meleset → pakai koordinat kolom pdfjs-dist
const BAHAYA_RE = /\s+(?=(?:Ter(?:jatuh|peleset|timpa|lindas|bakar|sengat|guling|cebur|perosot|pecah|gelincir|tumbang|campak|perangkap|jegal|senggol|pepet|pental|tumpah|tular|jadi|paku|tancap|jepit|lilit|jerat|perosok|tahan|kait|perangkap)|Kebakaran|Kebocoran|Keruntuhan|Keracunan|Longsor|Ambruk|Putus|Runtuh|Roboh|Retak|Patah|Letusan|Ledakan|Banjir|Genangan|Gempa|Radiasi|Getaran|Paparan|Bising|Debu|Asap|Uap|Aliran|Hubung|Sentuh|Pendulum|Beban|Ketinggian|Akibat|Bahaya|Tertimpa|Tersengat|Terguling|Tergelincir|Tertuang|Tertekan|Kaca|Papan|Material|Peralatan|Mesin|Kendaraan|Listrik|Curah|Angin)\b)/i;

function parseRkk(no, text) {
    if (!text) return null;
    const sp = text.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
    if (sp.length >= 3) return [no, sp[0], sp.slice(1).join(' ')];
    const hm = text.match(BAHAYA_RE);
    if (hm && hm.index > 0) return [no, text.slice(0, hm.index).trim(), text.slice(hm.index).trim()];
    return [no, text, ''];
}

function buildTable(type, lines) {
    if (!lines.length) return null;
    const parser = { peralatan: parsePeralatan, personel: parsePersonel, rkk: parseRkk }[type];
    const hasJumlah = type === 'personel' ? hasJumlahColumn(lines) : false;
    let rows = groupRows(lines).map(r => parser(r.no, r.text, hasJumlah)).filter(Boolean);
    if (!rows.length) return null;
    // Kolom "Jumlah (Orang)" hanya ada di sebagian LDP → header & rows ikut menyesuaikan
    if (type === 'personel' && !hasJumlah) rows = rows.map(r => [r[0], r[1], r[3], r[4]]);
    const header = (type === 'personel' && hasJumlah)
        ? ['No', 'Jabatan', 'Jumlah (Orang)', 'Pengalaman Kerja (tahun)', 'Sertifikat Kompetensi Kerja']
        : HEADERS[type];
    return { header, rows };
}

/**
 * Ekstrak fields + tabel dari teks LDP.
 * @returns {{fields: object, tables: {peralatan?: {header, rows}, personel?: {...}, rkk?: {...}}, debug: object}}
 */
function extractLdp(text) {
    const fields = {}, tables = {}, debug = { ldpStart: -1 };
    const clean = String(text || '').replace(/^[-–—]\s*\d+\s*[-–—]$/gm, '');
    const start = findLDP(clean);
    debug.ldpStart = start;
    if (start === -1) return { fields, tables, debug };
    const ldp = clean.substring(start);

    // ── Field berlabel (format standar SPSE) ──
    const LIST = '(?:[a-z]\\.\\s*|-\\s*)';
    let v;
    // Pokja: label "Pokja Pemilihan" (dengan/tanpa kolon) → stop di Alamat/Website/next item
    v = grab(ldp, `(?:^|\\n)\\s*${LIST}?Pokja\\s+Pemilihan\\s*:?\\s*`, '(?:^|\\n)\\s*(?:Alamat\\s+Pokja|Website\\s+LPSE|[b-z]\\.\\s+\\w)');
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

    debug.fields = Object.keys(fields);
    debug.tables = Object.keys(tables);
    return { fields, tables, debug };
}

module.exports = { findLDP, grab, cleanVal, extractLdp };
