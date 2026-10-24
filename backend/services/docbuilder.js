/**
 * TenderBuild — Doc Builder (server-side).
 * Port setia dari DocumentsPage._buildPrintHtml (frontend), tanpa ketergantungan DOM.
 * Semua data (company, templates, personil, equipment) di-pass dari route.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE_URL = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

function esc(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** URL absolut agar bisa di-fetch Chromium server-side. */
function absUrl(u) {
    if (!u) return '';
    if (/^(https?:|data:)/i.test(u)) return u;
    const p = u.startsWith('/') ? u : '/' + u;
    return BASE_URL + p;
}

/** Template tersimpan bisa berupa dokumen HTML utuh (hasil sync GDocs) → ambil isi body saja. */
function bodyInner(html) {
    html = String(html || '');
    if (!/<html[\s>]/i.test(html)) return html;
    const m = html.match(/<body[^>]*>([\s\S]*)<\/body\s*>/i);
    return m ? m[1] : html.replace(/<\/?(html|head|body)[^>]*>/gi, '');
}

/** Normalisasi teks — pembanding anchor section GDocs ↔ teks render (huruf kecil, tanda → spasi). */
function normText(s) {
    return String(s || '')
        .replace(/&nbsp;|&#160;|&#32;/gi, ' ')
        .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"').replace(/&apos;|&#39;/gi, "'")
        .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d))
        .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

// ponytail: decode entity + offset per char (teks ≠ posisi sumber setelah &amp; dst) — cukup akurat per tag
function decodeWithOffsets(tok, base) {
    const out = [], off = [];
    let i = 0;
    while (i < tok.length) {
        if (tok[i] === '&') {
            const ent = /^&(amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-f]+);/i.exec(tok.slice(i));
            if (ent) {
                const k = ent[1];
                const ch = k[0] === '#'
                    ? String.fromCharCode(k[1] === 'x' || k[1] === 'X' ? parseInt(k.slice(1), 16) : parseInt(k.slice(1), 10))
                    : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' })[k.toLowerCase()];
                out.push(ch); off.push(base + i);
                i += ent[0].length;
                continue;
            }
        }
        out.push(tok[i]); off.push(base + i); i++;
    }
    return { out, off };
}

/** Teks normalisasi + peta char → posisi di sumber HTML (untuk memecah konten di titik section). */
function indexedText(html) {
    let text = ''; const map = [];
    const re = /<[^>]+>|&#x[0-9a-f]+;|&#\d+;|&[a-zA-Z]+;|[^<]+/gi;
    let m;
    while ((m = re.exec(html))) {
        if (m[0][0] === '<') continue;
        const { out, off } = decodeWithOffsets(m[0], m.index);
        for (let i = 0; i < out.length; i++) {
            const ch = out[i].toLowerCase();
            if (/[^a-z0-9]/.test(ch)) {
                if (text.endsWith(' ')) { if (map.length) map[map.length - 1] = Math.min(map[map.length - 1], off[i]); continue; }
                text += ' '; map.push(off[i]);
            } else { text += ch; map.push(off[i]); }
        }
    }
    const st = text.replace(/^ +| +$/g, '');
    const lead = text.length - text.replace(/^ +/, '').length;
    return { text: st, map: map.slice(lead, lead + st.length) };
}

/** Keseimbangan tag blok pada prefiks — jaminan split tak memotong di dalam wadah terbuka. */
function blockBalanced(s) {
    const cnt = {};
    const re = /<(\/?)(div|table|tbody|thead|tr|td|th|li|ul|ol|p|h[1-6]|blockquote)\b[^>]*>/g;
    let m;
    while ((m = re.exec(s))) cnt[m[2]] = (cnt[m[2]] || 0) + (m[1] ? -1 : 1);
    return Object.keys(cnt).every(k => cnt[k] === 0);
}

/**
 * Titik split konten tepat sebelum blok pembawa anchor: mundur ke akhir tag </...>
 * terakhir sebelumnya; bila tak seimbang, mundur lagi (maks 30 langkah). -1 = gagal → section dilewati.
 */
function sectionSplitPos(html, srcPos) {
    let searchFrom = srcPos;
    for (let tries = 0; tries < 30 && searchFrom > 0; tries++) {
        const c = html.lastIndexOf('</', searchFrom - 1);
        if (c < 0) return -1;
        const gt = html.indexOf('>', c);
        if (gt < 0) return -1;
        searchFrom = c;
        if (blockBalanced(html.slice(0, gt + 1))) return gt + 1;
    }
    return -1;
}

function fmtDateID(s) {    if (!s || s === '-') return '-';
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function terbilang(n) {
    n = parseInt(String(n).replace(/\D/g, ''), 10);
    if (!n || isNaN(n)) return '';
    const angka = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];
    function baca(m) {
        if (m < 10) return angka[m];
        if (m < 20) { if (m === 10) return 'sepuluh'; if (m === 11) return 'sebelas'; return angka[m - 10] + ' belas'; }
        if (m < 100) return angka[Math.floor(m / 10)] + ' puluh' + (m % 10 ? ' ' + angka[m % 10] : '');
        if (m < 1000) return (Math.floor(m / 100) === 1 ? 'seratus' : angka[Math.floor(m / 100)] + ' ratus') + (m % 100 ? ' ' + baca(m % 100) : '');
        return '';
    }
    let ret = ''; const satuan = ['', 'ribu', 'juta', 'miliar', 'triliun']; let i = 0;
    while (n > 0) {
        const part = n % 1000;
        if (part) {
            if (i === 1 && part === 1) ret = 'seribu' + (ret ? ' ' + ret : '');
            else { const s = baca(part); ret = s + (satuan[i] ? ' ' + satuan[i] : '') + (ret ? ' ' + ret : ''); }
        }
        n = Math.floor(n / 1000); i++;
    }
    return ret.trim() + ' rupiah';
}

/**
 * @param {object} o
 * @param {object[]} o.templates  (urut sesuai template_ids; kolom paper_size, orientation, margin, html_content)
 * @param {object} o.company
 * @param {object|null} o.signer  (personil penandatangan / ttd_personil)
 * @param {object|null} o.signer2 (pelaksana → nama/posisi/alamat/ttd_pelaksana)
 * @param {object|null} o.signer3 (petugas K3 → nama/posisi/alamat/ttd_k3)
 * @param {object} o.show         { direktur, pelaksana, k3, cap } — tampil/tidaknya tiap unsur (default nyala)
 * @param {object} o.capOpts      { size, pos: kiri|tengah|kanan|kanan-dikit }
 * @param {object[]} o.personil   (terpilih → tabel_personil & struktur_organisasi)
 * @param {object[]} o.equip      (terpilih → tabel_peralatan)
 * @param {object} o.vars         (nomor_surat, perihal, lampiran, tanggal, ...dinamis)
 * @param {object} o.ttdAdjust    { cap_dx, cap_dy, cap_rotate, cap_size, ttd_dx, ttd_dy, ttd_rotate } — dari drag preview
 * @param {boolean} o.withCapTtd
 * @param {{name,url}[]} o.attachments
 */
function buildDocHtml(o) {
    const { templates, company: comp, signer: pers, signer2: pelaksana = null, signer3: k3 = null,
        show = {}, personil = [], equip = [],
        vars = {}, capOpts = {}, ttdAdjust = {}, withCapTtd = true, attachments = [], stampMode = false,
        rkk = null } = o;
    // withCapTtd lawas = master switch; show.* = saklar per unsur (default nyala)
    const showDirektur = withCapTtd && show.direktur !== false;
    const showPelaksana = withCapTtd && show.pelaksana !== false;
    const showK3 = withCapTtd && show.k3 !== false;
    const showCap = withCapTtd && show.cap !== false;
    const mainTpl = templates[0] || null;
    // ponytail: kertas per-template (campur portrait/landscape) via named pages Chromium
    const paperOf = (t) => {
        const bw = t?.paper_size === 'F4' ? 215 : 210, bh = t?.paper_size === 'F4' ? 330 : 297;
        let w = bw, h = bh;
        if (t?.orientation === 'landscape') { w = bh; h = bw; }
        return { w, h, bw, bh, key: `pg_${t?.paper_size === 'F4' ? 'F4' : 'A4'}${t?.orientation === 'landscape' ? 'L' : 'P'}` };
    };
    const mainPaper = paperOf(mainTpl);
    const kota = comp?.kota || '';
    const tglFormat = vars.tanggal ? fmtDateID(vars.tanggal) : '';
    const tglSurat = kota ? `${kota}, ${tglFormat}` : tglFormat;
    const headerSurat = `<table style="width:100%; max-width:550px; margin-bottom:20px; border-collapse:collapse; font-size:inherit; font-family:inherit;"><tr><td style="width:90px; vertical-align:top; padding:2px 0;">Nomor</td><td style="width:12px; vertical-align:top; padding:2px 0;">:</td><td style="padding:2px 0;">${esc(vars.nomor_surat)}</td></tr><tr><td style="vertical-align:top; padding:2px 0;">Lampiran</td><td style="vertical-align:top; padding:2px 0;">:</td><td style="padding:2px 0;">${esc(vars.lampiran || '-')}</td></tr><tr><td style="vertical-align:top; padding:2px 0;">Perihal</td><td style="vertical-align:top; padding:2px 0;">:</td><td style="padding:2px 0;"><strong>${esc(vars.perihal)}</strong></td></tr></table>`;

    // ── Cap & TTD (+adjust drag/rotasi dari preview) ──
    // ponytail: ukuran cap ikut master #company (tanpa batas 130)
    const capSz = ttdAdjust.cap_size || parseInt(capOpts?.size) || parseInt(comp?.cap_size) || 110;
    const capPos = capOpts?.pos || comp?.cap_pos || 'kiri';
    const cdx = parseInt(ttdAdjust.cap_dx) || 0, cdy = parseInt(ttdAdjust.cap_dy) || 0;
    const crot = parseFloat(ttdAdjust.cap_rotate) || 0;
    // kanan-dikit = kanan digeser ke dalam agar cap "nimpa" area TTD
    // ponytail: default = cap master penuh menimpa TTD; posisi eksplisit/rotasi → legacy
    const prettyDefault = !crot && !capOpts?.pos;
    const capXLegacy = capPos === 'tengah'
        ? `left:calc(50% + ${cdx}px); transform:translateX(-50%) rotate(${crot}deg);`
        : capPos === 'kanan-dikit'
            ? `right:calc(25px + ${-cdx}px); transform:rotate(${crot}deg);`
            : capPos === 'kanan'
                ? `right:calc(-15px + ${-cdx}px); transform:rotate(${crot}deg);`
                : `left:calc(-15px + ${cdx}px); transform:rotate(${crot}deg);`;
    // ponytail: bangun blok direktur per kemunculan — dx ekstra untuk varian selang-seling
    const capVariantsUsed = [];
    // ponytail: stampMode — jangkar ukur untuk stamp koordinat (ganti tebak CSS); [{ n, dx }]
    const sigMarks = [];
    let sigMarkSeq = 0;
    const buildTtdDirektur = (dx, v = -1) => {
        if (stampMode && prettyDefault && showDirektur) {
            const n = sigMarkSeq++;
            sigMarks.push({ n, dx, v });
            // ponytail: box 110px = area TTD +2 baris; SEJAJAR box TTD pelaksana/K3 (nama sejajar, selisih 0)
            return `<div id="srv-ttd" style="text-align:center; position:relative; display:block; z-index:5; break-inside:avoid; break-after:avoid; margin:10px 0 8px 0; padding:0; ${ttdShift}"><div style="height:110px; display:flex; align-items:center; justify-content:center; overflow:hidden;"><span style="font-size:1px; line-height:1; color:#ffffff;">~SIGMK${n}~</span></div></div>`;
        }
        const cap = showCap && comp?.cap_image_url
            ? (prettyDefault
                ? `<img id="srv-cap" src="${absUrl(comp.cap_image_url)}" style="position:absolute; left:calc(50% - 165px + ${dx}px); top:calc(-100px + ${cdy}px); max-width:${capSz}px; max-height:240px; transform:rotate(-3deg); opacity:0.92; z-index:2;">`
                : `<img id="srv-cap" src="${absUrl(comp.cap_image_url)}" style="position:absolute; ${capXLegacy} top:calc(40px + ${cdy}px); max-width:${capSz}px; opacity:0.9; z-index:2;">`)
            : '';
        if (!showDirektur) return withCapTtd ? '<div style="height:100px;"></div>' : '';
        // ponytail: area TTD ramping — margin atas-bawah kecil
        return prettyDefault
            ? `<div id="srv-ttd" style="text-align:center; position:relative; display:block; z-index:5; break-inside:avoid; break-after:avoid; margin:10px 0 8px 0; padding:0; ${ttdShift}">${cap}${imgTtdDir}</div>`
            : `<div id="srv-ttd" style="text-align:center; position:relative; display:block; margin:10px 0 -48px 0; z-index:5; break-inside:avoid; break-after:avoid; ${ttdShift}">${cap}${imgTtdDir}</div>`;
    };
    // ponytail: kotak gambar TTD 110px + rata bawah — direktur/pelaksana/K3 sejajar
    const sigBox = (inner) => `<div style="height:110px; display:flex; align-items:flex-end; justify-content:center;">${inner}</div>`;
    // ponytail: TTD direktur lebih besar dari pelaksana — box 110px, gambar 95px
    const sigBoxDir = (inner) => `<div style="height:110px; display:flex; align-items:flex-end; justify-content:center;">${inner}</div>`;
    const imgTtdDir = comp?.ttd_image_url ? sigBoxDir(`<img src="${absUrl(comp.ttd_image_url)}" style="max-height:95px; position:relative; z-index:1;">`) : sigBoxDir('<br><br><br>');
    const tdx = parseInt(ttdAdjust.ttd_dx) || 0, tdy = parseInt(ttdAdjust.ttd_dy) || 0;
    const trot = parseFloat(ttdAdjust.ttd_rotate) || 0;
    const ttdShift = (tdx || tdy || trot) ? `left:${tdx}px; top:${tdy}px; transform:rotate(${trot}deg);` : '';
    const ttdJabatan = comp?.ttd_jabatan || 'Direktur';
    // ponytail: TTD/cap mati tapi master nyala → spasi kosong 100px untuk TTD basah manual
    const ttdSpacer = '<div style="height:100px;"></div>';
    const ttdDirektur = buildTtdDirektur(cdx);
    let ttdPersonil = '';
    if (pers && showPelaksana) {
        const imgTtdPers = pers.ttd_image_url ? sigBox(`<img src="${absUrl(pers.ttd_image_url)}" style="max-height:65px;">`) : sigBox('<br><br><br>');
        const tglLine = tglSurat ? `<div style="margin-bottom:6px;">${esc(tglSurat)}</div>` : '';
        ttdPersonil = `<div id="srv-personil" style="text-align:center; display:block; margin:14px 0 26px 0; break-inside:avoid;">${tglLine}<div style="margin-bottom:8px;"><strong>Hormat saya,</strong></div>${imgTtdPers}<div style="margin-top:8px; font-weight:bold; text-decoration:underline;">${esc(pers.nama)}</div><div>${esc(pers.jabatan || 'Pelaksana')}</div></div>`;
    }
    // ponytail: vertical-align:top agar kolom direktur & pelaksana sejajar dari atas (tinggi sebelah = ok)
    const ttdGabungan = showDirektur ? `<table style="width:100%; margin-top:35px; border-collapse:collapse;"><tr><td style="width:50%; text-align:center; vertical-align:top;"><div style="margin-bottom:8px;">Mengetahui,</div>${ttdDirektur}</td><td style="width:50%; text-align:center; vertical-align:top;">${ttdPersonil}</td></tr></table>` : ttdPersonil;
    // ── Pelaksana & K3 (04 surat: nama/posisi/alamat/ttd masing-masing; alamat kosong → "-") ──
    // ponytail: blok TTD = gambar TTD saja (teks nama/jabatan sudah di narasi via marker)
    // ponytail: blok pelaksana/k3 — margin ramping selaras direktur
    const signerBlock = (s, on, bid) => {
        if (!s) return '';
        if (!on) return withCapTtd ? ttdSpacer : '';
        const img = s.ttd_image_url ? sigBox(`<img src="${absUrl(s.ttd_image_url)}" style="max-height:65px;">`) : sigBox('<br><br><br>');
        // ponytail: margin-bottom 0 = nama sejajar blok direktur
        return `<div${bid ? ` id="${bid}"` : ''} style="text-align:center; position:relative; display:block; margin:10px 0 0 0; padding:0; z-index:5; break-inside:avoid; break-after:avoid;">${img}</div>`;
    };
    const blokPelaksana = signerBlock(pelaksana, showPelaksana, 'srv-pelaksana');
    const blokK3 = signerBlock(k3, showK3, 'srv-k3');

    // ── tabel dinamis ──
    const tabelPeralatan = equip.length ? `
        <table style="width:100%; border-collapse:collapse; font-size:10pt;">
            <thead><tr style="background:#f2f2f2;">
                <th style="border:1px solid #000; padding:4px;">No</th>
                <th style="border:1px solid #000; padding:4px;">Jenis Peralatan</th>
                <th style="border:1px solid #000; padding:4px;">Kapasitas</th>
                <th style="border:1px solid #000; padding:4px;">Jumlah</th>
                <th style="border:1px solid #000; padding:4px;">Tahun Produksi</th>
                <th style="border:1px solid #000; padding:4px;">Merk/Type</th>
                <th style="border:1px solid #000; padding:4px;">Kondisi</th>
                <th style="border:1px solid #000; padding:4px;">Lokasi Sekarang</th>
                <th style="border:1px solid #000; padding:4px;">Bukti Kepemilikan</th>
            </tr></thead>
            <tbody>
            ${equip.map((e, i) => {
                const kap = (e.kapasitas_angka ?? null) !== null || e.kapasitas_satuan
                    ? `${e.kapasitas_angka ?? ''}${e.kapasitas_angka != null && e.kapasitas_satuan ? ' ' : ''}${e.kapasitas_satuan || ''}`.trim() || '-'
                    : (e.kapasitas || '-');
                return `<tr>
                <td style="border:1px solid #000; padding:4px; text-align:center;">${i + 1}</td>
                <td style="border:1px solid #000; padding:4px;">${esc(e.jenis)}</td>
                <td style="border:1px solid #000; padding:4px;">${esc(kap)}</td>
                <td style="border:1px solid #000; padding:4px; text-align:center;">${esc(String(e.jumlah ?? '-'))}</td>
                <td style="border:1px solid #000; padding:4px; text-align:center;">${esc(String(e.tahun_produksi ?? '-'))}</td>
                <td style="border:1px solid #000; padding:4px;">${esc(e.merk_type || '-')}</td>
                <td style="border:1px solid #000; padding:4px;">${esc(e.kondisi || '-')}</td>
                <td style="border:1px solid #000; padding:4px;">${esc(e.lokasi_sekarang || '-')}</td>
                <td style="border:1px solid #000; padding:4px;">${esc(e.bukti_kepemilikan || '-')}</td>
            </tr>`; }).join('')}
            </tbody>
        </table>` : '<p style="color:#999; font-style:italic; text-align:center; border:1px dashed #ccc; padding:12px;">Tidak ada peralatan terpilih.</p>';

    const tabelPersonil = personil.length ? `
        <table style="width:100%; border-collapse:collapse; font-size:10pt;">
            <thead><tr style="background:#f2f2f2;">
                <th style="border:1px solid #000; padding:4px;">No</th>
                <th style="border:1px solid #000; padding:4px;">Nama</th>
                <th style="border:1px solid #000; padding:4px;">Tingkat Pendidikan</th>
                <th style="border:1px solid #000; padding:4px;">Jabatan</th>
                <th style="border:1px solid #000; padding:4px;">Pengalaman (th)</th>
                <th style="border:1px solid #000; padding:4px;">Sertifikat Keahlian</th>
            </tr></thead>
            <tbody>
            ${personil.map((p, i) => `<tr>
                <td style="border:1px solid #000; padding:4px; text-align:center;">${i + 1}</td>
                <td style="border:1px solid #000; padding:4px;">${esc(p.nama)}</td>
                <td style="border:1px solid #000; padding:4px;">${esc(p.tingkat_pendidikan || '-')}</td>
                <td style="border:1px solid #000; padding:4px;">${esc(p.jabatan || '-')}</td>
                <td style="border:1px solid #000; padding:4px; text-align:center;">${esc(String(p.tahun_pengalaman ?? 0))}</td>
                <td style="border:1px solid #000; padding:4px;">${esc(p.sertifikat_keahlian || '-')}</td>
            </tr>`).join('')}
            </tbody>
        </table>` : '<p style="color:#999; font-style:italic; text-align:center; border:1px dashed #ccc; padding:12px;">Tidak ada personil terpilih.</p>';

    const strukturOrganisasi = personil.length ? `
        <div style="text-align:center; margin:20px 0;">
            <div style="display:inline-block; border:1px solid #000; padding:8px 20px; font-weight:bold;">
                ${esc(comp?.direktur || '')}<br><span style="font-weight:normal;">Direktur</span>
            </div>
            <div style="width:1px; height:20px; background:#000; margin:0 auto;"></div>
            <div style="display:flex; justify-content:center; gap:24px; margin-top:8px; flex-wrap:wrap;">
            ${personil.map(p => `
                <div style="border:1px solid #000; padding:8px 14px; font-weight:bold; min-width:120px;">
                    ${esc(p.nama)}<br><span style="font-weight:normal; font-size:0.9em;">${esc(p.jabatan || '-')}</span>
                </div>`).join('')}
            </div>
        </div>` : '<p style="color:#999; font-style:italic; text-align:center; border:1px dashed #ccc; padding:12px;">Bagan struktur organisasi akan tampil setelah personil terpilih.</p>';

    // ── kop ──
    const kopLine = /^#[0-9a-fA-F]{3,8}$/.test(comp?.kop_garis_warna || '') ? comp.kop_garis_warna : '#000000';
    let kopHtml = '';
    if (comp) {
        if (comp.kop_is_image && comp.kop_image_url) kopHtml = `<img src="${absUrl(comp.kop_image_url)}" style="width:100%; max-height:100px; object-fit:contain; margin-bottom:2px; border-bottom:3px double ${kopLine}; padding-bottom:2px;">`;
        else kopHtml = `<div style="text-align:center; margin-bottom:2px; border-bottom:3px double ${kopLine}; padding-bottom:2px;"><h2 style="margin:0; font-size:22px; font-weight:bold; text-transform:uppercase; letter-spacing:1px;">${esc(comp.kop_nama || comp.nama_perusahaan)}</h2><p style="margin:4px 0 2px 0; font-size:11pt;">${esc(comp.kop_alamat || comp.alamat || '')}</p><p style="margin:0; font-size:10pt; color:#333;">${esc(comp.kop_kontak || '')}</p></div>`;
    }
    const garisBawah = `<div style="border-bottom:3px solid ${kopLine}; margin:0;"></div>`; // garis tunggal ikut warna garis kop #company
    const fontName = String(comp?.font_surat || 'Times New Roman').replace(/[^A-Za-z0-9 '\-.,]/g, '');
    // ponytail: sans tetap sans (server pun tak punya Aptos/Calibri); serif tetap serif
    const serif = /times|georgia|garamond|bookman|palatino|serif|roman/i.test(fontName);
    const fontStack = serif ? `'${fontName}', Georgia, 'Times New Roman', Times, serif`
        : `'${fontName}', Calibri, 'Segoe UI', Helvetica, Arial, sans-serif`;
    // ponytail: <style> export GDocs ikut dirender — format penomoran list (I., a., 1) hidup di counter CSS <head>,
    // tanpa ini marker list jatuh ke native <ol> dan beda dgn Docs
    const gdocsCss = templates.map(t => String(t.html_content || '').match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).flat().join('\n');
    // ponytail: @page per-section (orientasi/margin GDocs) diisi dari dynCss — head ditutup SETELAH loop
    const isRkk03 = templates.some(t => /03 ?rkk/i.test(t.nama_template || ''));
    const rkkExtraCss = isRkk03 ? ' table { max-width: 100% !important; table-layout: auto !important; } td, th { word-break: break-word !important; overflow-wrap: anywhere !important; } .rkk-pgfooter { position: fixed; bottom: 6mm; left: 0; right: 0; text-align: center; font-size: 9pt; color: #555; } .rkk-pgfooter::after { content: "Halaman " counter(page) " dari " counter(pages); }' : '';
    const headOpen = `<!DOCTYPE html><html><head><title>${esc(vars.nomor_surat)}</title>${gdocsCss}<style>@import url('https://db.onlinewebfonts.com/c/7dd5f4bf5d38875ca1822a830b6e6fe4?family=Aptos');@page { size: ${mainPaper.w}mm ${mainPaper.h}mm; margin: 15mm 25mm 25mm 30mm; }@page pg_A4P { size: 210mm 297mm; margin: 15mm 25mm 25mm 30mm; }@page pg_A4L { size: 297mm 210mm; margin: 15mm 25mm 25mm 30mm; }@page pg_F4P { size: 215mm 330mm; margin: 15mm 25mm 25mm 30mm; }@page pg_F4L { size: 330mm 215mm; margin: 15mm 25mm 25mm 30mm; }.doc-page.pg_A4P { page: pg_A4P; }.doc-page.pg_A4L { page: pg_A4L; }.doc-page.pg_F4P { page: pg_F4P; }.doc-page.pg_F4L { page: pg_F4L; } body { font-family: ${fontStack}; font-size: 12pt; line-height: 1.5; color: black; margin: 0; padding: 0; }         /* ponytail: garansi — seluruh isi lembar ikut font #company */ .doc-page, .doc-page * { font-family: ${fontStack} !important; } .page-break { page-break-after: always; } .doc-page { position: relative; box-sizing: border-box; } .doc-page > *:nth-child(2) { margin-top: 0; } @media print { .doc-page { padding: 0 !important; min-height: auto !important; } } .attachment-page { display: flex; align-items: center; justify-content: center; height: 100vh; padding: 20mm; } .attachment-img { max-width: 100%; max-height: 100%; object-fit: contain; } table { border-collapse: collapse; } table:has(div[id^="srv-"]) { break-inside: avoid; break-before: avoid; } * { box-sizing: border-box; }${rkkExtraCss}`;
    const dynCss = [];
    let bodyHtml = '';
    templates.forEach((t, idx) => {
        let content = bodyInner(t.html_content || '');
        // ponytail: page-break Docs (<hr display:none>) → div break nyata agar PDF terpotong seperti Docs
        const BRK = '<div style="page-break-before:always;"></div>';
        content = content.replace(/<hr[^>]*page-break-before[^>]*>/gi, BRK);
        // ponytail: export GDocs → <ol start="N"> sering TANPA class .start → aturan counter-reset CSS tak aktif
        // (marker salah: "A." padahal "G."). Inline counter-reset per <ol> (lst-ctn-<class> = N-1) —
        // menang atas aturan .start dan bebas tabrakan selector antar-ol yang sekelas.
        content = content.replace(/<ol\b[^>]*>/gi, (tag) => {
            const st = /\bstart="(\d+)"/i.exec(tag);
            const cls = /\bclass="([^"]*)"/i.exec(tag);
            if (!st || !cls) return tag;
            const first = cls[1].trim().split(/\s+/)[0];
            if (!/^lst-/i.test(first)) return tag;
            const counter = 'lst-ctn-' + first.replace(/^lst-/i, '');
            const N = Math.max(0, (parseInt(st[1], 10) || 1) - 1);
            const inject = `counter-reset:${counter} ${N};`;
            if (/style="/i.test(tag)) return tag.replace(/style="([^"]*)"/i, (m, s) => `style="${s.replace(/;\s*$/, '')};${inject}"`);
            return tag.replace(/\s*>$/, ` style="${inject}">`);
        });
        // ponytail: garis kop dihapus bila {{garis_bawah_surat}} ada (hindari garis ganda)
        const kopUse = /\{\{garis_bawah_surat\}\}/.test(t.html_content || '') ? kopHtml.replace(/border-bottom:[^;]+;/g, '') : kopHtml;
        // ponytail: {{no_enter}} = hapus seluruh baris/blok yang memuatnya (enter di Docs tak bisa dihapus)
        content = content.replace(/<(p|div|li|h[1-6]|tr)\b[^>]*>(?:[^<]|<(?!\/\1\b)[^>]*>)*?\{\{\s*no_enter\s*\}\}[\s\S]*?<\/\1\s*>/gi, '\uFFFE');
        // ponytail: telan paragraf kosong tepat sesudahnya (spasi sisa khas Docs) agar benar-benar rapat
        let prevNoEnter;
        do {
            prevNoEnter = content;
            content = content.replace(/\uFFFE\s*<p\b[^>]*>(?:\s|<br\s*\/?>|<span\b[^>]*>(?:\s|&(nbsp|#160);)*<\/span>|&(nbsp|#160);)*<\/p>/gi, '\uFFFE');
        } while (content !== prevNoEnter);
        content = content.split('\uFFFE').join('');
        // ponytail: justify ditulis INLINE per <p> — center/right eksplisit dihormati, kiri/polos → justify
        content = content.replace(/<p\b([^>]*)>/gi, (m, a) => {
            if (/text-align\s*:\s*(center|right)/i.test(a)) return m;
            let b = a.replace(/text-align\s*:(\s*[^;"<>&]|&(quot|apos|amp|lt|gt);)+;?/gi, '');
            b = /style\s*=\s*"/i.test(b) ? b.replace(/style\s*=\s*"/i, 'style="text-align:justify; ') : b + ' style="text-align:justify;"';
            return '<p' + b + '>';
        });
        if (!withCapTtd) content = content.replace(/\{\{\s*kota_perusahaan\s*\}\}\s*,\s*\{\{\s*(?:tanggal_surat|tanggal)\s*\}\}[\s\S]*$/i, '');
        content = content            .replace(/\{\{header_surat\}\}/g, headerSurat)
            // ponytail: {{kop_surat}} berulang (copy-paste per seksi) → hanya pertama jadi kop, sisanya dibuang
            .replace(/\{\{kop_surat\}\}/, kopUse)
            .replace(/\{\{kop_surat\}\}/g, '')
            .replace(/\{\{garis_bawah_surat\}\}/g, garisBawah)
            .replace(/\{\{perusahaan\}\}/g, esc(comp?.nama_perusahaan || ''))
            .replace(/\{\{tanggal_surat\}\}/g, withCapTtd ? tglSurat : '')
            .replace(/\{\{kota_perusahaan\}\}/g, withCapTtd ? esc(kota) : '')
            .replace(/\{\{nama_perusahaan\}\}/g, esc(comp?.nama_perusahaan || ''))
            .replace(/\{\{singkatan\}\}/g, esc(comp?.singkatan || comp?.nama_perusahaan || ''))
            .replace(/\{\{direktur\}\}/g, esc(comp?.direktur || ''))
            .replace(/\{\{alamat\}\}/g, esc(comp?.alamat || ''))
            .replace(/\{\{npwp\}\}/g, esc(comp?.npwp_usaha || ''))
            .replace(/\{\{nama_personil\}\}/g, esc(pers?.nama || ''))
            .replace(/\{\{jabatan_personil\}\}/g, esc(pers?.jabatan || 'Pelaksana'))
            .replace(/\{\{nama_pelaksana\}\}/g, esc(pelaksana?.nama || ''))
            .replace(/\{\{posisi_pelaksana\}\}/g, esc(pelaksana?.jabatan || ''))
            .replace(/\{\{alamat_pelaksana\}\}/g, esc(pelaksana?.alamat || '-'))
            .replace(/\{\{nama_k3\}\}/g, esc(k3?.nama || ''))
            .replace(/\{\{posisi_k3\}\}/g, esc(k3?.jabatan || ''))
            .replace(/\{\{alamat_k3\}\}/g, esc(k3?.alamat || '-'))
            .replace(/\{\{ttd_pelaksana\}\}/g, blokPelaksana)
            .replace(/\{\{ttd_k3\}\}/g, blokK3)
            // ponytail: tiap {{ttd_direktur}} dapat varian selang-seling V1/V2/V3 (+45/+30/+40px)
            .replace(/\{\{ttd_direktur\}\}/g, () => {
                const v = capVariantsUsed.length % 3;
                capVariantsUsed.push(v + 1);
                return buildTtdDirektur(cdx + [45, 30, 40][v], v);
            })
            .replace(/\{\{ttd_personil\}\}/g, ttdPersonil)
            .replace(/\{\{ttd_gabungan\}\}/g, ttdGabungan)
            .replace(/\{\{tabel_peralatan\}\}/g, tabelPeralatan)
            .replace(/\{\{tabel_alat\}\}/g, tabelPeralatan) // alias GDocs: 01 alat
            .replace(/\{\{tabel_personil\}\}/g, tabelPersonil)
            .replace(/\{\{struktur_organisasi\}\}/g, strukturOrganisasi);

        // ponytail: tabel RKK (B1/B2/D2) — format & ambang dari pengaturan halaman RKK
        // ponytail: nilai isian RKK (halaman RKK) = default; nilai form dokumen tetap menang
        const varsAll = (rkk && rkk.vals) ? { ...rkk.vals, ...vars } : (vars || {});
        if (vars && vars.rkk_e1rows) varsAll._e1rows = vars.rkk_e1rows;
        // auto-fill variabel RKK dari data personil (pelaksana/K3) kalau belum diisi manual
        if (varsAll['pendidikan_pelaksana_terakhir'] == null) varsAll['pendidikan_pelaksana_terakhir'] = pelaksana?.tingkat_pendidikan || '-';
        if (varsAll['pengalaman_pelaksana'] == null) varsAll['pengalaman_pelaksana'] = (pelaksana?.tahun_pengalaman != null ? pelaksana.tahun_pengalaman + ' tahun' : '-');
        if (varsAll['keahlian_pelaksana'] == null) varsAll['keahlian_pelaksana'] = pelaksana?.sertifikat_keahlian || '-';
        if (varsAll['pendidikan_k3_terakhir'] == null) varsAll['pendidikan_k3_terakhir'] = k3?.tingkat_pendidikan || '-';
        if (varsAll['pengalaman_k3'] == null) varsAll['pengalaman_k3'] = (k3?.tahun_pengalaman != null ? k3.tahun_pengalaman + ' tahun' : '-');
        if (varsAll['keahlian_k3'] == null) varsAll['keahlian_k3'] = k3?.sertifikat_keahlian || '-';
        // alias umum template 03 RKK
        if (varsAll['nama_pekerjaan'] == null) varsAll['nama_pekerjaan'] = vars['nama_paket'] || vars['perihal'] || '';
        if (varsAll['tanggal_surat_tanpaTempat'] == null) varsAll['tanggal_surat_tanpaTempat'] = tglFormat;
        // ...
        if (rkk) {
            const { renderTables } = require('./rkk');
            // edited table HTML dari wizard (contenteditable preview) menang atas settings
            const cfg = { ...rkk };
            if (varsAll.rkk_tabel_b1) cfg.b1 = varsAll.rkk_tabel_b1;
            if (varsAll.rkk_tabel_b2) cfg.b2 = varsAll.rkk_tabel_b2;
            if (varsAll.rkk_tabel_d2) cfg.d2 = varsAll.rkk_tabel_d2;
            if (varsAll.rkk_tabel_e1) cfg.e1 = varsAll.rkk_tabel_e1;
            const tRkk = renderTables(cfg, varsAll);
            content = content
                .replace(/\{\{rkk_b1\}\}/g, tRkk.b1)
                .replace(/\{\{rkk_b2\}\}/g, tRkk.b2)
                .replace(/\{\{rkk_d2\}\}/g, tRkk.d2)
                .replace(/\{\{rkk_e1\}\}/g, tRkk.e1 || '')
                // alias template 03 RKK: nama placeholder tabel_* pakai makna sama
                .replace(/\{\{tabel_b1\}\}/g, tRkk.b1)
                .replace(/\{\{tabel_b2\}\}/g, tRkk.b2)
                .replace(/\{\{tabel_d2\}\}/g, tRkk.d2)
                .replace(/\{\{tabel_e1\}\}/g, tRkk.e1 || '');
        }
        const paguNum = vars['nilai_pagu'] || vars['pagu'] || vars['pagu_anggaran'];
        // ponytail: angka murni → "Rp. 480.000.000"; terbilang selalu dalam kurung
        const rupiahFmt = (v) => /^\d+$/.test(String(v ?? '').trim()) ? 'Rp. ' + Number(String(v).trim()).toLocaleString('id-ID') : null;
        ['pagu', 'nilai_pagu', 'pagu_anggaran', 'nilai_hps', 'nilai_penawaran'].forEach(k => {
            const f = vars[k] && rupiahFmt(vars[k]);
            if (f) content = content.replace(new RegExp(`\\{\\{ ?${k} ?\\}\\}`, 'g'), esc(f));
        });
        if (!vars['terbilang'] && paguNum) { const tb = terbilang(paguNum); if (tb) content = content.replace(/\{\{terbilang\}\}/g, esc('(' + tb + ')')); }
        // ponytail: alias 04 surat → nilai eksplisit user menang (loop generik di bawah), fallback ke surat utama
        if (!vars['nomor_surat_penawaran'] && vars['nomor_surat']) content = content.replace(/\{\{nomor_surat_penawaran\}\}/g, esc(vars['nomor_surat']));
        if (!vars['perihal_penawaran'] && vars['perihal']) content = content.replace(/\{\{perihal_penawaran\}\}/g, esc(vars['perihal']));
        if (!vars['nilai_pagu_terbilang'] && paguNum) { const tb = terbilang(paguNum); if (tb) content = content.replace(/\{\{nilai_pagu_terbilang\}\}/g, esc('(' + tb + ')')); }
        if (!vars['pagu_terbilang'] && paguNum) { const tb = terbilang(paguNum); if (tb) content = content.replace(/\{\{pagu_terbilang\}\}/g, esc('(' + tb + ')')); }
        Object.keys(varsAll).forEach(k => { content = content.replace(new RegExp(`\\{\\{ ?${k} ?\\}\\}`, 'g'), esc(varsAll[k])); });
        content = content.replace(/\{\{terbilang[^}]*\}\}/g, '.........');
        content = content.replace(/\{\{[^}]+\}\}/g, '.........');
        // ponytail: font Docs dilucuti → mutlak ikut font_surat #company (mekanisme !important terbukti tak mempan)
        content = content.replace(/font-family\s*:(\s*[^;"<>&]|&(quot|apos|amp|lt|gt);)+;?/gi, '');
        // ponytail: <p> kosong tepat sebelum blok TTD dibuang (1 baris mati per <p>) → TTD naik rapat ke isi
        // ponytail: HANYA gaya 04 surat (ada ttd_pelaksana/ttd_k3); dokumen direktur-saja (01 alat/02 personil)
        //           menyimpan paragraf kosong sebagai ruang tanda tangan basah + ruang cap
        // ponytail: marker GDocs di dalam <p><span> → div TTD bersarang di tag terbuka; izinkan di lookahead
        if (/\{\{\s*(?:ttd_pelaksana|ttd_k3)\s*\}\}/i.test(t.html_content || '')) {
            content = content.replace(/(<p\b[^>]*>(?:\s|<br\s*\/?>|<span\b[^>]*>(?:\s|&(nbsp|#160|#32);)*<\/span>|&(nbsp|#160|#32);)*<\/p>\s*)+(?=(?:<(?:p|span|div)\b[^>]*>\s*)*<div id="srv-(?:ttd|pelaksana|k3|personil)")/gi, '');
        }
        // ponytail: satukan blok TTD + maks 2 paragraf BERISI sesudahnya (nama/jabatan) agar tak yatim;
        // paragraf kosong & penutup dilewati gratis; berhenti sebelum tag pembuka struktural (break/kop/tabel/gambar)
        // ponytail: replacer tak bisa menghapus ekor → split eksplisit di bawah
        content = (() => {
            const re = /<div id="srv-(?:ttd|pelaksana|k3)"[\s\S]*?<\/div>/gi;
            let out = '', last = 0, mt;
            const tail = /^(?:\s+|<\/[a-zA-Z][^>]*>|<(p|h[1-6])\b[^>]*>([\s\S]*?)<\/(?:p|h[1-6])>)/i;
            const isEmptyP = (tag, inner) => !inner.replace(/<[^>]*>/g, '').replace(/&(nbsp|#160|#32);/g, '').trim()
                && /^(?:\s|<br\s*\/?>|<span\b[^>]*>(?:\s|&(nbsp|#160|#32);)*<\/span>|&(nbsp|#160|#32);)*$/.test(inner);
            while ((mt = re.exec(content))) {
                out += content.slice(last, mt.index);
                let pos = mt.index + mt[0].length, taken = 0;
                while (taken < 2) {
                    const mm = tail.exec(content.slice(pos));
                    if (!mm) break;
                    if (mm[1]) {
                        const txt = mm[2].replace(/<[^>]*>/g, '').replace(/&(nbsp|#160|#32);/g, '').trim();
                        if (txt) taken++;
                    }
                    pos += mm[0].length;
                    if (pos - (mt.index + mt[0].length) > 3000) break;
                }
                // ponytail: tarik mundur maks 2 paragraf BERISI (tgl/kota penutup) agar ikut satu kesatuan
                let back = mt.index;
                let backTaken = 0;
                const head = /(<(p|h[1-6])\b[^>]*>([\s\S]*?)<\/(?:p|h[1-6])>|\s+|<\/[a-zA-Z][^>]*>)$/i;
                while (backTaken < 2) {
                    const mm = head.exec(content.slice(0, back));
                    if (!mm || !mm[1]) break;
                    if (!mm[1].trim()) { back -= mm[1].length; continue; }
                    if (mm[1][0] !== '<') break;
                    if (/^<(p|h[1-6])\b/i.test(mm[1])) {
                        const txt = mm[1].replace(/<[^>]*>/g, '').replace(/&(nbsp|#160|#32);/g, '').trim();
                        if (!txt) { back -= mm[1].length; continue; }
                        backTaken++;
                    }
                    back -= mm[1].length;
                    if (mt.index - back > 2000) break;
                }
                if (taken) {
                    // ponytail: paragraf kosong di dalam wrap dibuang (ruang bandel) — sisakan isi + nama
                    const inner = content.slice(mt.index + mt[0].length, pos).replace(/<(p|h[1-6])\b[^>]*>(?:\s|<br\s*\/?>|<span\b[^>]*>(?:\s|&(nbsp|#160|#32);)*<\/span>|&(nbsp|#160|#32);)*<\/(?:p|h[1-6])>/gi, '');
                    out = out.slice(0, out.length - (mt.index - back)) + `<div style="break-inside:avoid;">${content.slice(back, mt.index)}${mt[0]}${inner}</div>`;
                }
                else out += mt[0];
                last = pos;
                re.lastIndex = pos;
            }
            return out + content.slice(last);
        })();
        const kopAuto = /\{\{kop_surat\}\}/.test(t.html_content || '') ? '' : kopUse;
        // (gugusan paragraf tengah dinonaktifkan — bikin halaman kaku & kosong separuh; cukup wrap TTD)
        const segParts = content.split(BRK);
        content = segParts.map((sg, i) => {
            const hasText = /[^<>\s]/.test(sg.replace(/<[^>]*>|&(nbsp|#160|#32);/g, ''));
            return (i > 0 ? BRK : '') + (i > 0 && hasText ? kopUse : '') + sg;
        }).join('');
        const pp = paperOf(t);
        const tmt = t.margin_top ?? 25, tmb = t.margin_bottom ?? 25, tml = t.margin_left ?? 30, tmr = t.margin_right ?? 25;
        // ponytail: min-height dihapus agar halaman tidak mengembang jadi kosong di SKP/lembar pendek
        // ponytail: page-break antar template INLINE di doc-page — div kosong terpisah di natural page
        // boundary menghasilkan 1 halaman kosong; break di top-of-page di-collapse Chromium tanpa blank
        const brk = idx > 0 ? 'page-break-before:always; ' : '';
        // ponytail: layout_sections (struktur section GDocs) → konten dipecah jadi segmen per section —
        // orientasi/margin persis Docs (@page bernama per segmen); tanpa data → satu doc-page seperti biasa
        // ponytail: segmen tunggal (1 section) sengaja TIDAK dipakai — surat/alat/personil pakai hardcode yang sudah terverifikasi
        const secs = Array.isArray(t.layout_sections) && t.layout_sections.length > 1 ? t.layout_sections : null;
        if (secs) {
            const { text, map } = indexedText(content);
            const bounds = [];
            let from = 0;
            for (let k = 1; k < secs.length; k++) {
                const a = secs[k].anchor || '';
                const p = a ? text.indexOf(a, from) : -1;
                if (p < 0) { console.warn('[docbuilder] anchor section tak ditemukan:', t.nama_template, JSON.stringify(a).slice(0, 60)); continue; }
                from = p + a.length;
                const cut = sectionSplitPos(content, map[p]);
                if (cut < 0) { console.warn('[docbuilder] split section tak seimbang, section dilewati:', t.nama_template, JSON.stringify(a).slice(0, 60)); continue; }
                bounds.push({ cut, sec: k });
            }
            let start = 0, si = 0, segSec = 0;
            const emitSeg = (end) => {
                if (end <= start) return;
                const st = secs[segSec] || secs[0];
                const page = `x${idx}s${si}`;
                dynCss.push(`@page ${page}{size:${st.orient === 'L' ? `${pp.bh}mm ${pp.bw}mm` : `${pp.bw}mm ${pp.bh}mm`};margin:${st.mt}mm ${st.mr}mm ${st.mb}mm ${st.ml}mm;} .doc-page.${page}{page:${page};}`);
                const bk = si > 0 ? 'page-break-before:always; ' : '';
                bodyHtml += `<div class="doc-page ${page}" style="${bk}padding: ${tmt}mm ${tmr}mm ${tmb}mm ${tml}mm;">${si === 0 ? kopAuto : ''}${content.slice(start, end)}</div>`;
                si++;
            };
            bounds.forEach(b => { emitSeg(b.cut); start = b.cut; segSec = b.sec; });
            emitSeg(content.length);
        } else {
            bodyHtml += `<div class="doc-page ${pp.key}" style="${brk}padding: ${tmt}mm ${tmr}mm ${tmb}mm ${tml}mm;">${kopAuto}${content}</div>`;
        }
    });
    const imgAtts = attachments.filter(att => att.url && att.url.match(/\.(jpeg|jpg|gif|png|webp)$/i));
    imgAtts.forEach((att, idx) => {
        bodyHtml += `<div class="attachment-page"><img src="${absUrl(att.url)}" class="attachment-img"></div>`;
        if (idx < imgAtts.length - 1) bodyHtml += '<div class="page-break"></div>';
    });
    const fullHtml = headOpen + dynCss.join('') + '</style></head><body>' + bodyHtml + (isRkk03 ? '<div class="rkk-pgfooter"></div>' : '') + '</body></html>';
    return { html: fullHtml, paper: { pwmm: mainPaper.w, phmm: mainPaper.h, landscape: mainTpl?.orientation === 'landscape' }, capVariants: capVariantsUsed, sigMarks, capSize: capSz };
}

module.exports = { buildDocHtml, esc, absUrl, terbilang, normText };
