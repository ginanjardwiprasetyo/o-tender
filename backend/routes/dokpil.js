const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const pdfParse = require('pdf-parse');
const { extractLdp } = require('../services/dokpil_extract');

// Parse konten JSON dari LLM dgn defensif: buang fence, ambil blok {..} terluar,
// coba parse; bila gagal coba perbaiki key tanpa kutip. Return object atau null.
function parseAiJson(content) {
  if (!content || typeof content !== 'string') return null;
  let cleaned = content.replace(/```(?:json)?\s*/gi, '').replace(/\s*```/g, '').trim();
  const s = cleaned.indexOf('{');
  const e = cleaned.lastIndexOf('}');
  if (s >= 0 && e > s) cleaned = cleaned.substring(s, e + 1);
  const attempts = [cleaned, cleaned.replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":').replace(/'/g, '"')];
  for (const a of attempts) {
    try { const o = JSON.parse(a); if (o && typeof o === 'object' && !Array.isArray(o)) return o; } catch (_) {}
  }
  return null;
}

// Isi field/tabel yang masih KOSONG dari hasil AI (TIDAK override hasil deterministik).
// Dipakai path upload & path Drive supaya PDF dgn layout beda tetap terbantu.
function applyAiFill(fields, tables, aiDataRaw) {
  let aiSummary = '';
  if (!aiDataRaw) return aiSummary;
  try {
    const aiData = typeof aiDataRaw === 'string' ? parseAiJson(aiDataRaw) : aiDataRaw;
    if (!aiData) return aiSummary;
    aiSummary = aiData.summary || '';
    if (!fields.pokja && aiData.pokja && aiData.pokja !== 'null') fields.pokja = aiData.pokja;
    if (!fields.alamat_pokja && aiData.alamat_pokja && aiData.alamat_pokja !== 'null') fields.alamat_pokja = aiData.alamat_pokja;
    if (!fields.nama_paket && aiData.nama_paket && aiData.nama_paket !== 'null') fields.nama_paket = aiData.nama_paket;
    if (!fields.lokasi && aiData.lokasi && aiData.lokasi !== 'null') fields.lokasi = aiData.lokasi;
    if (!fields.jangka_waktu && aiData.jangka_waktu && aiData.jangka_waktu !== 'null') fields.jangka_waktu = String(aiData.jangka_waktu).replace(/\D/g, '');
    if (!fields.pagu_anggaran && aiData.pagu_anggaran && aiData.pagu_anggaran !== 'null') {
      fields.pagu_anggaran = String(aiData.pagu_anggaran).replace(/\D/g, '');
      const parsed = parseInt(fields.pagu_anggaran, 10);
      if (parsed) fields.pagu_terbilang = terbilang(parsed);
    }
    if (!fields.kir && aiData.kir) fields.kir = /ya|yes|1|true/i.test(String(aiData.kir)) ? 'ya' : 'tidak';
    // Tabel: hanya isi yang kosong — parser deterministik jangan di-override AI
    if (!tables.peralatan && Array.isArray(aiData.peralatan) && aiData.peralatan.length) {
      tables.peralatan = { header: ['No', 'Jenis Alat', 'Kapasitas', 'Jumlah'], rows: aiData.peralatan.map(r => [r.no || '', r.jenis_alat || '', r.kapasitas || '', r.jumlah || '']) };
    }
    if (!tables.personel && Array.isArray(aiData.personel) && aiData.personel.length) {
      tables.personel = { header: ['No', 'Jabatan', 'Jumlah (Orang)', 'Pengalaman Kerja (tahun)', 'Sertifikat Kompetensi Kerja'], rows: aiData.personel.map(r => [r.no || '', r.jabatan || '', r.jumlah || '', r.pengalaman || '', r.sertifikat || '']) };
    }
    if (!tables.rkk && Array.isArray(aiData.rkk) && aiData.rkk.length) {
      tables.rkk = { header: ['No', 'Uraian Pekerjaan', 'Identifikasi Bahaya'], rows: aiData.rkk.map(r => [r.no || '', r.uraian || '', r.bahaya || '']) };
    }
  } catch (e) {
    console.warn('[Dokpil AI] Parse JSON gagal:', e.message);
  }
  return aiSummary;
}

// === AI Config (OpenRouter) ===
// Default: MiniMax flash free. reasoning_effort rendah WAJIB — model reasoning
// habiskan semua token utk reasoning & balik kosong kalo effort default.
// json_schema TIDAK dipakai (MiniMax abaikan) → prompt-only + parse defensif di applyAiFill.
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'minimax/minimax-m3.1-flash:free';
const AI_REASONING_EFFORT = process.env.AI_REASONING_EFFORT || 'low';

const AI_SYSTEM_PROMPT = `Anda adalah ekstraktor JSON. Dari teks LEMBAR DATA PEMILIHAN (LDP) di bawah, keluarkan JSON TANPA teks lain, TANPA markdown, TANPA kata pengantar.

FORMAT PERSIS (gunakan key names ini, jangan diubah):
{
  "pokja": "nama pokja",
  "alamat_pokja": "alamat pokja",
  "nama_paket": "nama paket pekerjaan",
  "lokasi": "lokasi pekerjaan",
  "jangka_waktu": "150",
  "pagu_anggaran": "2909753000",
  "kir": "tidak",
  "peralatan": [{"no":"1","jenis_alat":"Dump Truck","kapasitas":"4000 - 10000 kg","jumlah":"1 unit"}],
  "personel": [{"no":"1","jabatan":"Pelaksana","jumlah":"1","pengalaman":"2 Tahun","sertifikat":"SKT Pelaksana"}],
  "rkk": [{"no":"1","uraian":"Pekerjaan atap","bahaya":"Terjadi insiden"}],
  "summary": "ringkasan 2-3 paragraf"
}

ATURAN:
- "pokja" → ambil dari "Pokja Pemilihan:" (JANGAN tambahkan kata "Pokja Pemilihan" di depan)
- "alamat_pokja" → ambil dari "Alamat Pokja Pemilihan:" (bukan "alamat" saja)
- "nama_paket" → ambil dari "Nama paket pekerjaan:" (bukan "paket_pekerjaan")
- "lokasi" → ambil dari "Lokasi pekerjaan:"
- "jangka_waktu" → ANGKA SAJA. Contoh "150" bukan "150 hari kalender"
- "pagu_anggaran" → ANGKA SAJA. Contoh "2909753000" bukan "Rp 2.909.753.000,00"
- "kir" → "ya" jika dokumen mensyaratkan KIR (Kartu Izin Usaha Jasa Konstruksi / laporan KIR), "tidak" jika tidak disebutkan
- tabel "peralatan": ekstrak SEMUA baris (No, Jenis Alat, Kapasitas, Jumlah). Cari dari subjudul "peralatan utama"
- tabel "personel": ekstrak SEMUA baris (No, Jabatan, Jumlah orang, Pengalaman thn, Sertifikat). Jangan lewatkan baris manapun. Cari dari subjudul "personel manajerial" atau tabel yg ada kolom "Jabatan" dan "Sertifikat Kompetensi"
  - "jumlah" = kolom "Jumlah (Orang)" kalo ada; kalo tidak ada kolom itu, kosongkan
  - "pengalaman" = "N Tahun" (mis. "2 Tahun"), atau "Tidak dipersyaratkan" kalo dokumen menulis begitu, atau "" kalo kosong
  - "jabatan" = HANYA nama jabatan. JANGAN gabung jumlah orang / pengalaman / sertifikat ke dalamnya
- tabel "rkk": ekstrak SEMUA baris dari "Rencana Keselamatan Konstruksi (RKK)"
- null jika tidak ada. [] jika tabel kosong.
- summary: ringkasan 2-3 paragraf Bahasa Indonesia tentang dokumen ini
- HANYA JSON. Baris pertama harus {. Tidak ada teks lain.`;

// Guard: panggil AI HANYA bila parser deterministik masih menyisakan field/tabel kosong.
// Hemat kuota & waktu (deterministik sudah primary utk field).
function needsAiFill(fields, tables) {
  const FIELD_KEYS = ['pokja', 'alamat_pokja', 'nama_paket', 'lokasi', 'jangka_waktu', 'pagu_anggaran'];
  if (FIELD_KEYS.some(k => !fields[k])) return true;
  if (!fields.kir) return true;
  for (const t of ['peralatan', 'personel', 'rkk']) {
    if (!tables[t] || !tables[t].rows || !tables[t].rows.length) return true;
  }
  return false;
}

async function aiExtract(text, model) {
  if (!OPENROUTER_KEY) return null;
  const useModel = model || AI_MODEL;
  // Anchoring ke awal seksi LDP (bukan kepala dokumen) — dokumen besar punya
  // preamble/daftar isi panjang sebelum data; table asli sering ratusan ribu char masuk.
  const ldpText = text.substring(findLDP(text));
  const messages = [
    { role: 'system', content: AI_SYSTEM_PROMPT },
    { role: 'user', content: ldpText.substring(0, 20000) }
  ];
  // Provider free MiniMax kadang balik 502 "empty response" → coba beberapa kali.
  // Bila tetap gagal, fallback ke router openrouter/free (lebih stabil).
  const attempts = [[useModel, 3], [useModel === 'openrouter/free' ? null : 'openrouter/free', 2]];
  for (const [mdl, tries] of attempts) {
    if (!mdl) continue;
    for (let i = 0; i < tries; i++) {
      const payload = { model: mdl, messages, max_tokens: 4096, temperature: 0 };
      if (AI_REASONING_EFFORT) payload.reasoning_effort = AI_REASONING_EFFORT;
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${OPENROUTER_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && !data.error) {
          const c = data.choices && data.choices[0] && data.choices[0].message;
          const content = (c && c.content) || '';
          const parsed = parseAiJson(content);
          if (parsed) return parsed; // sukses & JSON valid
          // JSON rusak → retry (jangan terima konten tak ter-parse)
          console.warn('[Dokpil AI] JSON rusak, retry', mdl, 'try', i + 1, '| head:', String(content).slice(0, 80));
        } else {
          // provider_unavailable / empty → retry
          console.warn('[Dokpil AI] retry', mdl, 'try', i + 1, data.error && data.error.code, data.error && String(data.error.message || '').slice(0, 50));
        }
      } catch (e) {
        console.warn('[Dokpil AI]', mdl, e.message);
      }
    }
  }
  return null;
}

// Daftar model GRATIS dari OpenRouter (prompt=0 & completion=0), di-cache dlm memori.
let _freeModelsCache = null;
let _freeModelsAt = 0;
async function listFreeModels() {
  if (_freeModelsCache && Date.now() - _freeModelsAt < 10 * 60 * 1000) return _freeModelsCache;
  const res = await fetch('https://openrouter.ai/api/v1/models', { headers: { 'Authorization': `Bearer ${OPENROUTER_KEY}` } });
  const data = await res.json();
  const all = (data.data || []);
  const free = all.filter(m => {
    const p = m.pricing || {};
    if (String(p.prompt) !== '0' || String(p.completion) !== '0') return false;
    // buang model non-teks (mis. Lyria = musik) — ekstraksi LDP butuh output text
    const out = (m.architecture || {}).output_modalities || [];
    return out.includes('text') && !out.includes('audio');
  }).map(m => ({ id: m.id, name: m.name || m.id, context_length: m.context_length || null }));
  // pastikan default selalu ada & di urutan pertama
  free.sort((a, b) => (a.id === AI_MODEL ? -1 : b.id === AI_MODEL ? 1 : a.name.localeCompare(b.name)));
  _freeModelsCache = free; _freeModelsAt = Date.now();
  return free;
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

    // ===== Deterministik (primary — ground truth = panel Preview BAB IV) =====
    const { fields, tables, debug } = extractLdp(text);
    let aiSummary = '';
    debug.ai = false;
    debug.ldpLength = text.length;

    // ===== AI (opsional — hanya isi field/tabel yang masih kosong, TIDAK override) =====
    if (OPENROUTER_KEY && needsAiFill(fields, tables)) {
      aiSummary = applyAiFill(fields, tables, await aiExtract(text, req.body.aiModel));
      debug.ai = !!aiSummary;
      debug.aiModel = req.body.aiModel || AI_MODEL;
    }

    // Fallback terakhir: parser regex lama bila extractor gagal total
    if (!Object.keys(fields).length && !Object.keys(tables).length) {
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
        ai_enabled: !!OPENROUTER_KEY,
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

// ===== Drive browsing =====
const db = require('../config/db');
const { listFiles, getFileMeta, downloadFile } = require('../config/gdoc');

async function getDriveFolder() {
  const { rows } = await db.query("SELECT value FROM settings WHERE key='dokpil_drive_folder'");
  return rows[0]?.value || process.env.GDRIVE_TEMPLATE_FOLDER || '';
}

// GET /api/dokpil/ai/models — daftar model GRATIS dari OpenRouter (untuk menu pemilihan AI)
router.get('/ai/models', async (req, res) => {
  try {
    const models = await listFreeModels();
    res.json({ success: true, data: { models, default: AI_MODEL } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/dokpil/drive/folder — folder aktif (setting)
router.get('/drive/folder', async (req, res) => {
  try {
    res.json({ success: true, data: { folderId: await getDriveFolder() } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/dokpil/drive/folder — simpan folder aktif
router.put('/drive/folder', async (req, res) => {
  try {
    const { folderId } = req.body;
    if (!folderId) return res.status(400).json({ success: false, error: 'folderId wajib' });
    await db.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ('dokpil_drive_folder', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [folderId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/dokpil/drive/list — daftar isi folder (folder & file PDF)
router.get('/drive/list', async (req, res) => {
  try {
    const folderId = req.query.folderId || await getDriveFolder();
    if (!folderId) return res.status(400).json({ success: false, error: 'Folder Drive belum diatur' });
    const { files, nextPageToken } = await listFiles(folderId, {
      query: "mimeType='application/vnd.google-apps.folder' or mimeType='application/pdf'",
      pageToken: req.query.pageToken,
    });
    // pisahkan folder & file
    const folders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    const pdfs = files.filter(f => f.mimeType === 'application/pdf');
    res.json({ success: true, data: { folders, pdfs, nextPageToken, folderId } });
  } catch (err) {
    console.warn('[Dokpil Drive list]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/dokpil/drive/parse — download PDF dari Drive lalu parse (jalur yang sama dgn /parse)
router.post('/drive/parse', async (req, res) => {
  let buf = null;
  try {
    const { fileId } = req.body;
    if (!fileId) return res.status(400).json({ success: false, error: 'fileId wajib' });
    const meta = await getFileMeta(fileId);
    buf = await downloadFile(fileId);

    let text = '';
    try {
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
      return res.status(422).json({ success: false, error: 'Tidak dapat membaca isi PDF. Pastikan bukan hasil scan/gambar.' });
    }

    const { fields, tables, debug } = extractLdp(text);
    debug.ldpLength = text.length;
    debug.source = 'drive';
    debug.fileName = meta.name;

    // AI fallback (sama dgn path upload) — isi field/tabel yang masih kosong utk layout beda
    let aiSummary = '';
    debug.ai = false;
    if (OPENROUTER_KEY && needsAiFill(fields, tables)) {
      aiSummary = applyAiFill(fields, tables, await aiExtract(text, req.body.aiModel));
      debug.ai = !!aiSummary;
      debug.aiModel = req.body.aiModel || AI_MODEL;
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
        ai_enabled: !!OPENROUTER_KEY,
        file_name: meta.name,
        source: 'drive',
        raw_text_preview: previewText.substring(0, 30000),
      }
    });
  } catch (err) {
    console.error('[Dokpil Drive parse]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/dokpil/save — simpan hasil ekstraksi ke tender (Tender Saya)
router.post('/save', async (req, res) => {
  try {
    const b = req.body;
    if (!b.kode_tender) return res.status(400).json({ success: false, error: 'kode_tender wajib' });
    const { rows } = await db.query(
      `INSERT INTO dokpil_data
         (kode_tender, nama_file, pokja, alamat_pokja, nama_paket, lokasi,
          jangka_waktu, pagu_anggaran, pagu_terbilang, kir, peralatan, personel, rkk, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, NOW())
       RETURNING id`,
      [
        b.kode_tender, b.nama_file || null,
        b.pokja || null, b.alamat_pokja || null, b.nama_paket || null, b.lokasi || null,
        b.jangka_waktu || null, b.pagu_anggaran || null, b.pagu_terbilang || null,
        b.kir || 'tidak',
        JSON.stringify(b.peralatan || []), JSON.stringify(b.personel || []), JSON.stringify(b.rkk || []),
      ]
    );
    res.json({ success: true, data: { id: rows[0].id } });
  } catch (err) {
    console.error('[Dokpil Save]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/dokpil/saved/:kodeTender — ambil data dokpil terakhir untuk tender
router.get('/saved/:kodeTender', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM dokpil_data WHERE kode_tender=$1 ORDER BY updated_at DESC LIMIT 1',
      [req.params.kodeTender]
    );
    res.json({ success: true, data: rows[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
