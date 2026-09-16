const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const pdfParse = require('pdf-parse');

// === AI Config (Cloudflare Workers AI) ===
const CLOUDFLARE_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const AI_MODEL = '@cf/meta/llama-3.1-8b-instruct';

async function aiExtract(text) {
  if (!CLOUDFLARE_ACCOUNT || !CLOUDFLARE_TOKEN) return null;
  const systemPrompt = `Anda adalah ekstraktor JSON. Dari teks LEMBAR DATA PEMILIHAN (LDP) di bawah, keluarkan JSON TANPA teks lain, TANPA markdown, TANPA kata pengantar.

FORMAT PERSIS (gunakan key names ini, jangan diubah):
{
  "pokja": "nama pokja",
  "alamat_pokja": "alamat pokja",
  "nama_paket": "nama paket pekerjaan",
  "lokasi": "lokasi pekerjaan",
  "jangka_waktu": "150",
  "pagu_anggaran": "2909753000",
  "peralatan": [{"no":"1","jenis_alat":"Dump Truck","kapasitas":"4000 - 10000 kg","jumlah":"1 unit"}],
  "personel": [{"no":"1","jabatan":"Pelaksana","pengalaman":"2 Tahun","sertifikat":"SKT Pelaksana"}],
  "rkk": [{"no":"1","uraian":"Pekerjaan atap","bahaya":"Terjadi insiden"}],
  "summary": "ringkasan 2-3 paragraf"
}

ATURAN:
- "pokja" → ambil dari "Pokja Pemilihan:"
- "alamat_pokja" → ambil dari "Alamat Pokja Pemilihan:" (bukan "alamat" saja)
- "nama_paket" → ambil dari "Nama paket pekerjaan:" (bukan "paket_pekerjaan")
- "lokasi" → ambil dari "Lokasi pekerjaan:"
- "jangka_waktu" → ANGKA SAJA. Contoh "150" bukan "150 hari kalender"
- "pagu_anggaran" → ANGKA SAJA. Contoh "2909753000" bukan "Rp 2.909.753.000,00"
- tabel "peralatan": ekstrak SEMUA baris (No, Jenis Alat, Kapasitas, Jumlah). Cari dari subjudul "peralatan utama"
- tabel "personel": ekstrak SEMUA baris (No, Jabatan, Pengalaman thn, Sertifikat). Jangan lewatkan baris manapun. Cari dari subjudul "personel manajerial" atau tabel yg ada kolom "Jabatan" dan "Sertifikat Kompetensi"
- tabel "rkk": ekstrak SEMUA baris dari "Rencana Keselamatan Konstruksi (RKK)"
- null jika tidak ada. [] jika tabel kosong.
- summary: ringkasan 2-3 paragraf Bahasa Indonesia tentang dokumen ini
- HANYA JSON. Baris pertama harus {. Tidak ada teks lain.`;
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT}/ai/run/${AI_MODEL}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${CLOUDFLARE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text.substring(0, 20000) }
        ],
        max_tokens: 4096
      })
    });
    const data = await res.json();
    if (!data.success) { console.warn('[Dokpil AI] API error:', JSON.stringify(data.errors)); return null; }
    return data.result.response;
  } catch (e) {
    console.warn('[Dokpil AI]', e.message);
    return null;
  }
}

const upload = multer({
  dest: path.join(os.tmpdir(), 'dokpil-uploads'),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Hanya file PDF yang diizinkan'));
    cb(null, true);
  }
});

// Cari posisi BAB IV LEMBAR DATA PEMILIHAN yang SESUNGGUHNYA
// (bukan entri Daftar Isi). Pilih kemunculan terakhir yang diikuti konten LDP nyata.
function findLDP(text) {
  const re = /(?:BAB\s+IV[.\s-]*)?LEMBAR\s+DATA\s+PEMILIHAN/gi;
  let m, last = -1;
  while ((m = re.exec(text)) !== null) {
    const window = text.substring(m.index, m.index + 6000);
    if (/Identitas\s+Pokja|Alamat\s+Pokja\s+Pemilihan|Nama\s+paket\s+pekerjaan|Lingkup\s+Pekerjaan/i.test(window)) {
      last = m.index;
    }
  }
  if (last !== -1) return last;
  // fallback: kemunculan pertama
  const first = text.search(/(?:BAB\s+IV[.\s-]*)?LEMBAR\s+DATA\s+PEMILIHAN/i);
  if (first !== -1) return first;
  // fallback: kata kunci lain
  const alt = text.search(/Lembar\s+Data|LDP/i);
  if (alt !== -1) return alt;
  // fallback terakhir: seluruh dokumen
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

  // Bersihkan teks section dari page numbers dan header dokumen
function cleanSection(s) {
  if (!s) return s;
  return s
    .replace(/^-\s*\d+\s*-$/gm, '')
    .replace(/^-\d+-$/gm, '')
    .replace(/^Dokumen\s+Pemilihan\s+Pengadaan.*$/gmi, '')
    .replace(/^Tender\s+-\s+Pascakualifikasi.*$/gmi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Bersihkan marker list (a., b., c.) yang leak ke nilai
function cleanVal(s) {
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/^[a-z]\.\s*/i, '');
  s = s.replace(/\s+[a-z]\.\s*$/i, '');
  s = s.replace(/^[:-]\s*/, '');
  s = s.replace(/\s*[:-]$/, '');
  return s.trim();
}

// ponytail: shared util — was inline here
const { terbilang } = require('../utils/terbilang');

function textToMarkdown(text) {
  return text.split('\n').map(line => {
    const t = line.trim();
    if (!t) return '';
    if (/^BAB\s+IV/i.test(t)) return '## ' + t;
    if (/^[a-z]\)\s/i.test(t)) return '- ' + t.replace(/^[a-z]\)\s*/i, '');
    if (/^[a-z]\.\s/i.test(t)) return '- ' + t.replace(/^[a-z]\.\s*/i, '');
    if (/^[A-Z \/]{4,}$/.test(t) && t.length > 8) return '### ' + t;
    return t;
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Parse tabel mentah (hasil pdf) jadi { header, rows:[ [cell,...] ] }
function parseTable(raw) {
  if (!raw) return null;
  const lines = raw.split('\n').map(l => l.replace(/\t/g, '  ').trim()).filter(Boolean);
  for (const sep of [/\s{2,}/, /\s+/]) {
    let header = null;
    const rows = [];
    let seenNum = false;
    for (const line of lines) {
      const cells = line.split(sep).map(c => c.trim()).filter(c => c.length);
      if (cells.length < 2) continue;
      const first = cells[0].replace(/[.\s]+$/, '');
      const isNum = /^\d+$/.test(first);
      if (isNum) seenNum = true;
      if (!header && !seenNum) { header = cells; continue; }
      if (!isNum) continue;
      rows.push(cells);
    }
    if (rows.length) return { header, rows };
  }
  return null;
}

// Parse tabel multi-baris (item, kapasitas, jumlah tiap baris terpisah)
function parseSectionTable(raw, type) {
  if (!raw) return null;
  const lines = raw.split('\n').map(l => l.replace(/\t/g, ' ').trim()).filter(Boolean);
  let hIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toLowerCase().replace(/\s+/g, '');
    if (/^no\.?\b/i.test(lines[i])) { hIdx = i; break; }
    if (l === 'no' || l === 'no.') { hIdx = i; break; }
    if (l === 'n' && lines[i+1] && lines[i+1].toLowerCase().replace(/\s+/g, '') === 'o') { hIdx = i + 1; break; }
  }
  if (hIdx === -1) {
    if (type === 'rkk') hIdx = -1; // body will be slice(0)
    else return null;
  }
  const body = lines.slice(hIdx + 1);
  const items = [];
  let cur = null;
  let expectedNum = 1;
  for (let i = 0; i < body.length; i++) {
    const line = body[i];
    const m = line.match(/^(\d+)(?:\.\s+|\s+|\.?$)\s*(.*)$/);
    const leadingNum = m ? parseInt(m[1], 10) : NaN;
    const rem = m ? m[2].trim() : '';
    let remForCheck = rem;
    if (!remForCheck && i + 1 < body.length) remForCheck = body[i + 1].trim();
    const isQty = m && /^(unit|buah|bh|set|org|paket)\b/i.test(remForCheck);
    const isTime = m && /^(tahun|thn|hari|jam|bulan|bln)\b/i.test(remForCheck);
    const isCap = m && /^(ton|kg|m3|m2|liter|ltr|kva|kw|hp|watt)\b/i.test(remForCheck);
    const isDataRow = m && /^\d/.test(rem);
    const isContinuation = m && /^[^a-zA-Z]/.test(rem);
    const isItem = m && !isQty && !isTime && !isCap && !isDataRow && !isContinuation && (leadingNum === expectedNum || leadingNum === expectedNum + 1);
    if (isItem) {
      if (cur) items.push(cur);
      cur = { no: leadingNum.toString(), lines: rem ? [rem] : [] };
      expectedNum = leadingNum + 1;
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  if (cur) items.push(cur);
  const validItems = items.filter(it => {
    if (!it.lines.length) return false;
    if (type === 'peralatan') {
      const block = it.lines.join(' ').toLowerCase();
      if (/memiliki kemampuan|personel|personil|manajerial/.test(block)) return false;
    }
    return true;
  });

  // RKK fallback: if no numbered items, create single row from body content
  if (type === 'rkk' && !validItems.length) {
    let content = body.map(l => l.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    content = content.replace(/^(?:\d+\.\s+)?(?:Rencana\s+Keselamatan\s+)?Konstruksi.*?di bawah ini.*?(?::|\.)\s*/i, '');
    if (content && content.length > 10) {
      return { header: ['No', 'Uraian Pekerjaan', 'Identifikasi Bahaya'], rows: [['1', content, '']] };
    }
  }

  if (!validItems.length) return null;

  const headerMap = {
    peralatan: ['No', 'Jenis Alat', 'Kapasitas', 'Jumlah'],
    personel: ['No', 'Jabatan', 'Pengalaman Kerja (tahun)', 'Sertifikat Kompetensi Kerja'],
    rkk: ['No', 'Uraian Pekerjaan', 'Identifikasi Bahaya']
  };
  const header = headerMap[type] || ['No', 'Kolom 2', 'Kolom 3', 'Kolom 4'];

  const rows = validItems.map(it => {
    const ls = it.lines;
    if (type === 'peralatan') {
      const block = ls.join(' ');
      const capMatch = block.match(/(Min\.|Max\.|±)?\s*\d[\d.,]*\s*(?:–|-)\s*\d[\d.,]*\s*(?:kg|m3|kva|hp|ton|watt)/i)
        || block.match(/(Min\.|Max\.|±)?\s*\d[\d.,]*\s*(?:kg|m3|kva|hp|ton|watt)/i);
      const jenis = capMatch ? block.substring(0, capMatch.index).trim() : (ls[0] || '');
      const cap = capMatch ? capMatch[0].trim() : '';
      const jml = (block.match(/\d+\s*(?:unit|buah|bh|set|paket)/i) || [, ''])[0] || '';
      return [it.no, jenis, cap, jml];
    }
    if (type === 'personel') {
      const block = ls.join(' ');
      const p = block.match(/^([a-zA-Z\s\/.()\d]+?)\s+\d+.*$/);
      const jab = p ? p[1].trim() : block;
      const afterJab = block.substring(jab.length).trim();
      const pengRe = /(\d+)\s*(?:\([^)]*\))?\s*(?:tahun|thn)/i;
      const pengMatch = afterJab.match(pengRe);
      const peng = pengMatch ? pengMatch[1] : '';
      // Try keyword-based sertifikat match first
      let sert = (block.split(/\[diisi/i)[0].match(/(Sertifikat|SKT|SKK|SKA|SIP)\b.*/i) || [, ''])[0] || '';
      if (!sert && pengMatch) {
        sert = afterJab.substring(pengMatch.index + pengMatch[0].length).trim().split(/\[diisi/i)[0].trim();
      }
      return [it.no, jab, peng ? peng + ' Tahun' : '', sert];
    }
    if (type === 'rkk') {
      const block = ls.join(' ').replace(/\s+/g, ' ').trim();
      const p = block.match(/^(.+?)\s+(Terjadi|Bahaya|terjadi|bahaya)\b(.*)$/i);
      const ur = p ? p[1].trim() : block;
      const idn = p ? (p[2] + ' ' + p[3]).trim() : block;
      return [it.no, ur, idn];
    }
    return [it.no, ...ls];
  });

  return { header, rows };
}

function parseLDP(text) {
  const result = {};
  const tables = {};
  const debug = { error: null, ldpLength: 0, matches: {} };

  text = text.replace(/^-\s*\d+\s*-$/gm, '').trim();

  const ldpStart = findLDP(text);
  if (ldpStart === -1) {
    debug.error = 'BAB IV LEMBAR DATA PEMILIHAN tidak ditemukan';
    result._debug = debug;
    return { result, tables, debug };
  }
  const ldpText = text.substring(ldpStart);
  debug.ldpLength = ldpText.length;

  const NEXT = '\\n\\s*[a-z]\\.\\s'; // list item berikutnya (a., b., c., d.)

  // ===== Field sederhana =====
  let v;
  v = grab(ldpText, '(?<!Identitas\\s)Pokja\\s+Pemilihan\\s*:\\s*', NEXT + '|Alamat\\s+Pokja');
  if (v) result.pokja = cleanVal(v);

  v = grab(ldpText, 'Alamat\\s+Pokja\\s+Pemilihan\\s*', NEXT + '|Website\\s+LPSE');
  if (v) result.alamat_pokja = cleanVal(v);

  v = grab(ldpText, 'Nama\\s+paket\\s+pekerjaan\\s*:\\s*', NEXT + '|Uraian\\s+Singkat|Lingkup\\s+Pekerjaan');
  if (v) result.nama_paket = cleanVal(v);

  v = grab(ldpText, 'Lokasi\\s+pekerjaan\\s*:\\s*', NEXT + '|Jangka\\s+waktu');
  if (v) result.lokasi = cleanVal(v);

  v = grab(ldpText, 'Jangka\\s+waktu\\s+pelaksanaa?n\\s+(?:pekerjaan|program)?\\s*[:\\s]+\\s*', NEXT + '|Sumber\\s+Dana');
  if (v) {
    const m = v.match(/(\d+)/);
    result.jangka_waktu = m ? m[1] : cleanVal(v);
  }

  v = grab(ldpText, 'Pagu\\s+[Aa]nggaran\\s*[:\\s]+\\s*', NEXT + '|Sumber\\s+Dana|Jenis\\s+Kontrak');
  if (v) {
    const raw = cleanVal(v);
    const num = raw.replace(/,\d{1,2}/g, '').replace(/[^\d]/g, '');
    const parsed = parseInt(num, 10);
    result.pagu_anggaran = num || raw;
    if (parsed) result.pagu_terbilang = terbilang(parsed);
  }

  // ===== KIR detection =====
  result.kir = /\bKIR\b/i.test(ldpText) ? 'ya' : 'tidak';

  // ===== Persyaratan Teknis & RKK (decoupled dari header section) =====
  let p1 = grab(ldpText, 'peralatan\\s+utama', 'personel\\s+manajerial|personil\\s+manajerial|tenaga\\s+ahli|\\n\\s*\\d+\\.\\s+(?:Bagian|Rencana|Daftar|Syarat|Memiliki)');
  let p2 = grab(ldpText, 'personel\\s+manajerial|personil\\s+manajerial|tenaga\\s+ahli', 'b\\.\\s+Untuk|rencana\\s+keselamatan|\\n\\s*\\d+\\.\\s+(?:Bagian|Rencana|Daftar|Syarat|Memiliki)');
  let p3 = grab(ldpText, 'rencana\\s+keselamatan', 'persyaratan\\s+lain|(?:BAB\\s+V)|\\n\\s*[G-Z]\\.\\s+(?:Mata Uang|Cara Pembayaran|Jaminan|Masa|Preferensi|Sanggah)|\\n\\s*\\d+\\.\\s+(?:Memiliki|Bagian|Daftar|Surat)');

  if (p1) {
    p1 = p1.replace(/\n?\d+\.\s+Memiliki\s+kemampuan\s+menyediakan\s*$/i, '').trim();
    p1 = cleanSection(p1);
    const t = parseSectionTable(p1, 'peralatan') || parseTable(p1);
    if (t) tables.peralatan = t;
    result.peralatan_text = p1.substring(0, 2500);
  }
  if (p2) {
    p2 = cleanSection(p2);
    const t = parseSectionTable(p2, 'personel') || parseTable(p2);
    if (t) tables.personel = t;
    result.personel_text = p2.substring(0, 2500);
  }
  if (p3) {
    p3 = cleanSection(p3);
    const t = parseSectionTable(p3, 'rkk') || parseTable(p3);
    if (t) tables.rkk = t;
    result.rkk_text = p3.substring(0, 2500);
  }

  // ===== Fallback =====
  const fallbacks = [
    { k: 'pokja', re: /(?:^|\n)\s*[a-z]\.\s*Pokja\s+Pemilihan\s*:\s*(.+)/i },
    { k: 'alamat_pokja', re: /(?:^|\n)\s*[a-z]\.\s*Alamat\s+Pokja\s+Pemilihan\s*(.+)/i },
    { k: 'nama_paket', re: /(?:^|\n)\s*[a-z]\.\s*Nama\s+paket\s+pekerjaan\s*:\s*(.+)/i },
    { k: 'lokasi', re: /(?:^|\n)\s*[a-z]\.\s*Lokasi\s+pekerjaan\s*:\s*(.+)/i },
    { k: 'jangka_waktu', re: /Jangka\s+waktu\s+pelaksanaa?n\s+(?:pekerjaan|program)?\s*[:>\s]\s*(.+)/i },
    { k: 'pagu_anggaran', re: /Pagu\s+[Aa]nggaran\s*[:>\s]\s*(.+)/i },
  ];
  for (const fb of fallbacks) {
    if (!result[fb.k]) {
      const m = ldpText.match(fb.re);
      if (m) {
        result[fb.k] = cleanVal(m[1]);
        if (fb.k === 'jangka_waktu') {
          const num = result.jangka_waktu.match(/(\d+)/);
          if (num) result.jangka_waktu = num[1];
        }
        if (fb.k === 'pagu_anggaran') {
          const num = result.pagu_anggaran.replace(/,\d{1,2}/g, '').replace(/[^\d]/g, '');
          const parsed = parseInt(num, 10);
          result.pagu_anggaran = num || result.pagu_anggaran;
          if (parsed) result.pagu_terbilang = terbilang(parsed);
        }
      }
    }
  }

  // ===== Ultra-broad fallback: scan entire ldpText =====
  if (!result.jangka_waktu) {
    const h = ldpText.match(/(\d+)\s*hari/i);
    if (h) result.jangka_waktu = h[1];
  }
  if (!result.pagu_anggaran) {
    const r = ldpText.match(/(?:Rp|Rp\.|IDR)\s*([\d,.]+)/i);
    if (r) {
      const n = r[1].replace(/,\d{1,2}/g, '').replace(/[^\d]/g, '');
      result.pagu_anggaran = n;
      const p = parseInt(n, 10);
      if (p) result.pagu_terbilang = terbilang(p);
    }
  }
  if (!result.pokja) {
    const m = ldpText.match(/(?:Pokja|Kelompok\s+Kerja)\s*[:\s]\s*(.+?)(?:\n[a-z]\.|$)/i);
    if (m) result.pokja = cleanVal(m[1]);
  }
  if (!result.nama_paket) {
    const m = ldpText.match(/Nama\s+paket\s+pekerjaan\s*[:\s]\s*(.+?)(?:\n[a-z]\.|$)/i);
    if (m) result.nama_paket = cleanVal(m[1]);
  }
  if (!result.lokasi) {
    const m = ldpText.match(/Lokasi\s+pekerjaan\s*[:\s]\s*(.+?)(?:\n[a-z]\.|$)/i);
    if (m) result.lokasi = cleanVal(m[1]);
  }
  if (!result.alamat_pokja) {
    const m = ldpText.match(/Alamat\s+Pokja\s+Pemilihan\s*(.+?)(?:\n[a-z]\.|$)/i);
    if (m) result.alamat_pokja = cleanVal(m[1]);
  }

  // ===== Try to extract tables from any subsection =====
  if (!tables.peralatan && !result.peralatan_text) {
    const sec = grab(ldpText, 'peralatan|perlengkapan', 'personel|personil|tenaga|rencana|persyaratan');
    if (sec) { const t = parseSectionTable(sec, 'peralatan') || parseTable(sec); if (t) tables.peralatan = t; result.peralatan_text = sec.substring(0, 2500); }
  }
  if (!tables.personel && !result.personel_text) {
    const sec = grab(ldpText, 'personel|personil|tenaga\\s+ahli', 'rencana|persyaratan|BAB\\s+V');
    if (sec) { const t = parseSectionTable(sec, 'personel') || parseTable(sec); if (t) tables.personel = t; result.personel_text = sec.substring(0, 2500); }
  }
  if (!tables.rkk && !result.rkk_text) {
    const sec = grab(ldpText, 'rencana\\s+keselamatan', 'persyaratan\\s+lain|BAB\\s+V');
    if (sec) { const t = parseSectionTable(sec, 'rkk') || parseTable(sec); if (t) tables.rkk = t; result.rkk_text = sec.substring(0, 2500); }
  }

  for (const k of Object.keys(result)) {
    if (k !== '_debug') debug.matches[k] = true;
  }
  debug.tables = Object.keys(tables);

  result._debug = debug;
  return { result, tables, debug };
}

router.post('/parse', upload.single('file'), async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'File PDF wajib diupload' });

    filePath = req.file.path;

    let text = '';
    try {
      const buf = fs.readFileSync(filePath);
      // Suppress harmless pdf.js TT warnings
      const origWrite = process.stderr.write.bind(process.stderr);
      process.stderr.write = (chunk, ...args) => {
        if (chunk && chunk.toString().includes('TT: undefined function')) return true;
        return origWrite(chunk, ...args);
      };
      const data = await pdfParse(buf);
      process.stderr.write = origWrite;
      text = data.text;
    } catch (e) {
      console.warn('[Dokpil] pdf-parse failed:', e.message);
    }

    if (!text || text.trim().length < 10) {
      return res.status(422).json({ success: false, error: 'Tidak dapat membaca isi PDF. Pastikan file bukan hasil scan/gambar.' });
    }

    // ===== AI extraction (primary) =====
    let fields = {}, tables = {}, aiSummary = '', debug = { ai: false, error: null };
    const tryAI = CLOUDFLARE_ACCOUNT && CLOUDFLARE_TOKEN;
    if (tryAI) {
      const raw = await aiExtract(text);
      if (raw) {
        try {
          let aiData = raw;
          if (typeof raw === 'string') {
            // cari { pertama, potong teks sebelum JSON
            let jsonStart = raw.indexOf('{');
            let cleaned = jsonStart >= 0 ? raw.substring(jsonStart) : raw;
            cleaned = cleaned.replace(/```(?:json)?\s*/g, '').replace(/\s*```/g, '').trim();
            // cari } terakhir
            const jsonEnd = cleaned.lastIndexOf('}');
            if (jsonEnd >= 0) cleaned = cleaned.substring(0, jsonEnd + 1);
            try { aiData = JSON.parse(cleaned); }
            catch (_) {
              cleaned = cleaned.replace(/(\s*|,)([a-zA-Z_]\w*)(\s*):/g, '$1"$2"$3:').replace(/'/g, '"');
              aiData = JSON.parse(cleaned);
            }
          }
          aiSummary = aiData.summary || '';
          // Build fields dari AI
          if (aiData.pokja && aiData.pokja !== 'null') fields.pokja = aiData.pokja;
          if (aiData.alamat_pokja && aiData.alamat_pokja !== 'null') fields.alamat_pokja = aiData.alamat_pokja;
          if (aiData.nama_paket && aiData.nama_paket !== 'null') fields.nama_paket = aiData.nama_paket;
          if (aiData.lokasi && aiData.lokasi !== 'null') fields.lokasi = aiData.lokasi;
          if (aiData.jangka_waktu && aiData.jangka_waktu !== 'null') fields.jangka_waktu = aiData.jangka_waktu.replace(/\D/g, '');
          if (aiData.pagu_anggaran && aiData.pagu_anggaran !== 'null') {
            fields.pagu_anggaran = aiData.pagu_anggaran.replace(/\D/g, '');
            const parsed = parseInt(fields.pagu_anggaran, 10);
            if (parsed) fields.pagu_terbilang = terbilang(parsed);
          }
          // Tabel: pake regex (lebih akurat), AI jangan override tabel
          const aiKeys = Object.keys(aiData).filter(k => aiData[k] && aiData[k] !== 'null' && (!Array.isArray(aiData[k]) || aiData[k].length));
          debug = { ai: true, matches: Object.fromEntries(aiKeys.map(k => [k, true])), ldpLength: text.length, tables: Object.keys(tables).filter(k => tables[k]?.rows?.length) };
        } catch (e) {
          console.warn('[Dokpil AI] Parse JSON gagal:', e.message);
        }
      }
    }

    // ===== Fallback regex untuk field/tabel yang masih kosong =====
    const parsed = parseLDP(text);
    const { _debug: dbg, ...regexFields } = parsed.result;
    for (const k of Object.keys(regexFields)) {
      if (!fields[k] && regexFields[k] !== null && regexFields[k] !== undefined && regexFields[k] !== '') {
        fields[k] = regexFields[k];
      }
    }
    for (const k of Object.keys(parsed.tables)) {
      if (!tables[k] || !tables[k].rows || !tables[k].rows.length) {
        tables[k] = parsed.tables[k];
      }
    }

    const ldpStart = findLDP(text);
    let previewText = ldpStart !== -1 ? text.substring(ldpStart) : text;
    const babVIdx = previewText.search(/\bBAB\s+V\.?\b/i);
    if (babVIdx !== -1) previewText = previewText.substring(0, babVIdx);

    res.json({
      success: true,
      data: {
        fields,
        tables,
        debug,
        ai_summary: aiSummary,
        ai_enabled: !!CLOUDFLARE_ACCOUNT,
        raw_text_preview: previewText.substring(0, 30000),
        raw_markdown: textToMarkdown(previewText).substring(0, 30000)
      }
    });

  } catch (err) {
    console.error('[Dokpil Error]', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlink(filePath, () => {});
    }
  }
});

router.post('/extract-text', upload.single('file'), async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'File PDF wajib diupload' });
    filePath = req.file.path;

    const buf = fs.readFileSync(filePath);
    const data = await pdfParse(buf);

    res.json({
      success: true,
      data: {
        text: data.text,
        numpages: data.numpages
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    if (filePath && fs.existsSync(filePath)) fs.unlink(filePath, () => {});
  }
});

module.exports = router;
