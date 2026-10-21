/**
 * Document Routes — Server-side document generation (Google Docs → HTML → PDF → merge → Supabase).
 * Preview: POST /api/documents/preview  → { html }
 * Generate: POST /api/documents/generate → { id, url, pages, skipped }
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const { applyScanEffect } = require('../services/scan_effect');
const supabase = require('../config/supabase');
const { buildDocHtml } = require('../services/docbuilder');

// ─── Playwright singleton (dipakai ulang antar request) ───
let browser = null;
async function getBrowser() {
    // ponytail: browser child-process bisa mati diam-diam (restart/watch, OOM) → validasi + relaunch
    if (browser && !browser.isConnected()) {
        try { await browser.close(); } catch {}
        browser = null;
    }
    if (browser) return browser;
    const { chromium } = require('playwright');
    const args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'];
    for (const opt of [{ channel: 'chrome', headless: true }, { headless: true }]) {
        try { browser = await chromium.launch({ args, ...opt }); break; } catch {}
    }
    if (!browser) throw new Error('Gagal menjalankan browser Chromium/Chrome');
    return browser;
}

async function htmlToPdf(html, paper) {
    const b = await getBrowser();
    const page = await b.newPage();
    try {
        await page.setContent(html, { waitUntil: 'networkidle', timeout: 60000 });
        // ponytail: kertas 100% dari CSS (@page + named pages campur orientasi) — tanpa format/width JS
        return await page.pdf({ printBackground: true, preferCSSPageSize: true });
    } finally {
        await page.close();
    }
}

/** Ambil bytes lampiran: URL http(s) atau path lokal /uploads/... */
async function fetchBytes(url) {
    if (/^https?:/i.test(url)) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return Buffer.from(await res.arrayBuffer());
    }
    const m = url.split('/uploads/');
    if (m.length > 1) {
        const p = path.join(__dirname, '..', 'uploads', decodeURIComponent(m[1]));
        return fs.readFileSync(p);
    }
    throw new Error('URL lampiran tidak dikenali');
}

/** Ukur jangkar ~SIGMK{n}~ per halaman via pdfjs (koordinat PDF point, origin kiri-bawah). */
let _pdfjs = null;
async function findSigMarks(pdfBytes) {
    if (!_pdfjs) _pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await _pdfjs.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
    const marks = [];
    for (let p = 1; p <= doc.numPages; p++) {
        const tc = await (await doc.getPage(p)).getTextContent();
        for (const it of tc.items) {
            const m = /~SIGMK(\d+)~/.exec(it.str || '');
            if (m) marks.push({ n: +m[1], page: p - 1, x: it.transform[4], y: it.transform[5] });
        }
    }
    return marks;
}

/** Embed PNG/JPG (tebak dari magic bytes). */
async function embedAuto(doc, buf) {
    const b = Buffer.from(buf);
    return (b[0] === 0x89 && b[1] === 0x50) ? doc.embedPng(b) : doc.embedJpg(b);
}

// ponytail: stamp TTD+cap di koordinat TERUKUR (bukan tebak CSS) — presisi dari mesin print yang sama
// ponytail: engine swap-ready — ganti isi fungsi ini dengan call Stirling add-stamp bila container tersedia
async function stampSignatures(mainPdf, { built, comp, ttdAdjust = {}, showCap = true, baseUrl = '' }) {
    if (!built.sigMarks?.length) return { bytes: Buffer.from(mainPdf), stamped: 0 };
    const PX = 0.75; // CSS px → PDF point (96dpi → 72pt)
    const { PDFDocument, degrees } = require('pdf-lib');
    const marks = await findSigMarks(mainPdf);
    const byN = new Map(marks.map(m => [m.n, m]));
    const doc = await PDFDocument.load(mainPdf);
    // ponytail: URL relatif (uploads/...) → absolut via baseUrl, persis yang di-fetch Chromium
    const abs = (u) => /^https?:/i.test(u || '') ? u : (baseUrl + '/' + String(u || '').replace(/^\//, ''));
    const get = async (u) => { try { return u ? await fetchBytes(abs(u)) : null; } catch { return null; } };
    const sigBuf = await get(comp?.ttd_image_url);
    const capBuf = showCap ? await get(comp?.cap_image_url) : null;
    const sigImg = sigBuf ? await embedAuto(doc, sigBuf) : null;
    const capImg = capBuf ? await embedAuto(doc, capBuf) : null;
    if (!sigImg && !capImg) return { bytes: Buffer.from(mainPdf), stamped: 0 };
    const tdx = (parseInt(ttdAdjust.ttd_dx) || 0) * PX, tdy = (parseInt(ttdAdjust.ttd_dy) || 0) * PX;
    const cdy = (parseInt(ttdAdjust.cap_dy) || 0) * PX;
    // ponytail: susunan cap-kiri-TTD — TTD geser kanan, cap di kiri-atas TTD (overlap ringan khas cap basah)
    // ponytail: V1 lift kecil (cap lebih turun) + rotate kebalikan; V2/V3 lift normal
    const SIG_SHIFT = 28 * PX, CAP_OVERLAP = 45 * PX;
    const liftOf = (v) => (v === 0 ? 12 : 28) * PX; // V1 rendah + rotate kebalikan; V2/V3 normal
    let stamped = 0;
    for (const { n, dx, v } of built.sigMarks) {
        const mk = byN.get(n);
        if (!mk) continue;
        const pg = doc.getPage(mk.page);
        const { width: pgW } = pg.getSize();
        const sigCX = mk.x + SIG_SHIFT + tdx, sigCY = mk.y + tdy;
        let sigW = 0;
        if (sigImg) { // TTD: tinggi 95px (visual lama), lebar ikut aspek, tengah di jangkar+geser
            const h = 95 * PX;
            sigW = h * (sigImg.width / sigImg.height);
            pg.drawImage(sigImg, { x: sigCX - sigW / 2, y: sigCY - h / 2, width: sigW, height: h });
        }
        if (capImg) { // Cap: kiri-atas TTD; V1 rotate kebalikan (+3°), lainnya -3°; clamp tepi halaman
            const w = (built.capSize || 110) * PX, h = w * (capImg.height / capImg.width);
            let cx = sigCX - (sigW / 2 + w / 2) + CAP_OVERLAP + dx * PX;
            cx = Math.max(cx, w / 2 + 4);
            pg.drawImage(capImg, {
                x: cx - w / 2, y: sigCY + liftOf(v) + cdy - h / 2,
                width: w, height: h, rotate: degrees(v === 0 ? 3 : -3), opacity: 0.92,
            });
        }
        stamped++;
    }
    return { bytes: await doc.save(), stamped };
}

/** Gabung PDF utama + lampiran (PDF digabung, JPG/PNG jadi halaman penuh). URL sama digabung sekali (2 alat 1 lampiran). */
async function mergeAttachments(mainPdf, attachments = []) {
    const { PDFDocument } = require('pdf-lib');
    const out = await PDFDocument.load(mainPdf);
    const skipped = [];
    const seen = new Set();
    for (const att of attachments) {
        const key = String(att.url || '').split('?')[0];
        if (seen.has(key)) { skipped.push(`${att.name || att.url} (sudah digabung — 1 file untuk 2 alat)`); continue; }
        seen.add(key);
        try {
            const buf = await fetchBytes(att.url);
            if (/\.pdf($|\?)/i.test(att.url)) {
                const src = await PDFDocument.load(buf, { ignoreEncryption: true });
                const pages = await out.copyPages(src, src.getPageIndices());
                pages.forEach(p => out.addPage(p));
            } else if (/\.(jpe?g|png)($|\?)/i.test(att.url)) {
                const img = /\.png($|\?)/i.test(att.url) ? await out.embedPng(buf) : await out.embedJpg(buf);
                const pg = out.addPage([img.width, img.height]);
                pg.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
            } else {
                skipped.push(`${att.name || att.url} (tipe tak didukung, hanya PDF/JPG/PNG)`);
            }
        } catch (e) {
            skipped.push(`${att.name || att.url} (${e.message})`);
        }
    }
    return { bytes: await out.save(), pages: out.getPageCount(), skipped };
}

async function uploadResult(bytes, req) {
    const fileName = `generated/${Date.now()}-${Math.round(Math.random() * 1E9)}.pdf`;
    const { error } = await supabase.storage.from('uploads').upload(fileName, Buffer.from(bytes), {
        contentType: 'application/pdf', upsert: true,
    });
    if (error) { // fallback disk lokal (pola sama seperti uploads.js)
        const target = path.join(__dirname, '..', 'uploads', fileName);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, Buffer.from(bytes));
        return { url: `${req.protocol}://${req.get('host')}/uploads/${fileName}`, path: fileName };
    }
    return { url: `https://tender.rekayasa-sipil.my.id/uploads/${fileName}`, path: fileName };
}

async function loadContext(body) {
    const { company_id, template_ids = [], signer_id = null, signer2_id = null, signer3_id = null,
        personil_ids = [], equipment_ids = [] } = body;
    if (!company_id) throw new Error('company_id wajib diisi');
    // ponytail: templates_inline (preview template belum tersimpan) atau template_ids dari DB
    let tpl;
    if (body.templates_inline?.length) {
        tpl = body.templates_inline.map((t, i) => ({ id: `inline-${i}`, ...t }));
    } else {
        if (!template_ids.length) throw new Error('template_ids wajib diisi (min 1)');
        const { rows } = await db.query('SELECT * FROM templates WHERE id = ANY($1)', [template_ids]);
        tpl = template_ids.map(id => rows.find(t => t.id === id)).filter(Boolean);
    }
    const getSigner = (sid, over) => sid ? db.query('SELECT * FROM personnel WHERE id = $1', [sid]).then(r => ({ ...(r.rows[0] || {}), ...(over || {}) })) : null;
    const [comp, signer, signer2, signer3, personil, equip] = await Promise.all([
        db.query('SELECT * FROM companies WHERE id = $1', [company_id]).then(r => r.rows[0]),
        getSigner(signer_id), getSigner(signer2_id, body.signer2_data), getSigner(signer3_id, body.signer3_data),
        personil_ids.length ? db.query('SELECT * FROM personnel WHERE id = ANY($1)', [personil_ids]).then(r => r.rows) : [],
        equipment_ids.length ? db.query('SELECT * FROM equipments WHERE id = ANY($1)', [equipment_ids]).then(r => r.rows) : [],
    ]);
    if (!comp) throw new Error('Perusahaan tidak ditemukan');
    if (!tpl.length) throw new Error('Template tidak ditemukan');
    return { comp, tpl, signer, signer2, signer3, personil, equip };
}

// POST /api/documents/preview — kembalikan HTML final (untuk preview + drag TTD/cap)
router.post('/preview', async (req, res) => {
    try {
        const ctx = await loadContext(req.body);
        const { html } = buildDocHtml({
            templates: ctx.tpl, company: ctx.comp, signer: ctx.signer,
            signer2: ctx.signer2, signer3: ctx.signer3, show: req.body.show || {},
            personil: ctx.personil, equip: ctx.equip,
            vars: req.body.vars || {}, capOpts: req.body.cap_opts || {},
            ttdAdjust: req.body.ttd_adjust || {},
            withCapTtd: req.body.with_cap_ttd !== false,
            attachments: req.body.attachments || [],
        });
        res.json({ success: true, html });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/documents/generate — HTML → PDF → merge lampiran → upload → catat DB
router.post('/generate', async (req, res) => {
    try {
        const ctx = await loadContext(req.body);
        // ponytail: 04 surat digabung template "04 form kualifikasi_<singkatan>" perusahaan terpilih; tidak ada → skip
        if (!req.body.templates_inline?.length && ctx.tpl.length === 1
            && /^04 surat$/i.test((ctx.tpl[0].nama_template || '').trim())) {
            const sing = (ctx.comp.singkatan || '').trim().toLowerCase();
            if (sing) {
                const { rows } = await db.query(
                    'SELECT * FROM templates WHERE lower(trim(nama_template)) = $1 AND id <> $2',
                    [`04 form kualifikasi_${sing}`, ctx.tpl[0].id]);
                if (rows[0]) ctx.tpl.push(rows[0]);
            }
        }
        const ttdAdjust = req.body.ttd_adjust || {};
        const built = buildDocHtml({
            templates: ctx.tpl, company: ctx.comp, signer: ctx.signer,
            signer2: ctx.signer2, signer3: ctx.signer3, show: req.body.show || {},
            personil: ctx.personil, equip: ctx.equip,
            vars: req.body.vars || {}, capOpts: req.body.cap_opts || {},
            ttdAdjust,
            withCapTtd: req.body.with_cap_ttd !== false,
            attachments: req.body.attachments || [],
            stampMode: true, // TTD/cap jadi jangkar ukur → di-stamp presisi di bawah
        });
        const mainPdf = await htmlToPdf(built.html, built.paper);
        const stamped = await stampSignatures(mainPdf, {
            built, comp: ctx.comp, ttdAdjust,
            showCap: req.body.with_cap_ttd !== false && (req.body.show || {}).cap !== false,
            baseUrl: `${req.protocol}://${req.get('host')}`,
        });
        const merged = await mergeAttachments(stamped.bytes, req.body.attachments || []);
        // Efek scan (opsional) — berlaku utk SEMUA dokumen di batch ini
        let finalBytes = merged.bytes, finalPages = merged.pages;
        let scanApplied = false;
        if (req.body.scan_effect) {
            try {
                const sc = await applyScanEffect(merged.bytes, req.body.scan_opts || {});
                finalBytes = sc.bytes; finalPages = sc.pages; scanApplied = true;
            } catch (e) {
                console.warn('[Scan Effect] gagal, PDF tetap normal:', e.message);
            }
        }
        const up = await uploadResult(finalBytes, req);
        const { rows } = await db.query(
            `INSERT INTO tender_documents
             (tender_id, template_id, personnel_snapshot, equipment_snapshot, generated_html, file_url, storage_path, page_count, variables)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
            [req.body.tender_id || null, ctx.tpl[0].id,
             JSON.stringify(ctx.personil), JSON.stringify(ctx.equip),
             built.html, up.url, up.path, finalPages, JSON.stringify({ ...(req.body.variables || req.body.vars || {}), cap_variants: built.capVariants, has_ttd: !!((req.body.show?.direktur || req.body.show?.pelaksana || req.body.show?.k3) && req.body.show?.cap), scan_effect: scanApplied })]
        );
        res.json({ success: true, data: { id: rows[0].id, url: up.url, pages: finalPages, skipped: merged.skipped, cap_variants: built.capVariants, scan_effect: scanApplied } });
    } catch (err) {
        console.error('[Generate Error]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/documents/records — riwayat dokumen PDF yang pernah digenerate
router.get('/records', async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT d.id, d.tender_id, d.template_id, d.file_url, d.page_count, d.created_at, d.variables,
                    t.nama_template, f.nama_tender, f.kode_tender,
                    c.nama_perusahaan, c.kbli,
                    ct.sbu AS tender_sbu
             FROM tender_documents d
             LEFT JOIN templates t ON t.id = d.template_id
             LEFT JOIN followed_tenders f ON f.id::text = d.tender_id::text OR f.kode_tender::text = d.tender_id::text
             LEFT JOIN companies c ON c.id::text = (d.variables->>'company_id')
             LEFT JOIN crawled_tenders ct ON ct.kode_tender::text = COALESCE(d.variables->'tender'->>'kode', f.kode_tender::text)
             ORDER BY d.created_at DESC LIMIT 100`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/documents/batch/:batchId/zip — semua PDF satu generate jadi 1 zip
router.get('/batch/:batchId/zip', async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT d.file_url, t.nama_template FROM tender_documents d
             LEFT JOIN templates t ON t.id = d.template_id
             WHERE d.variables->>'batch_id' = $1 ORDER BY d.created_at`, [req.params.batchId]);
        if (!rows.length) return res.status(404).json({ success: false, error: 'Batch tidak ditemukan' });
        const JSZip = require('jszip');
        const zip = new JSZip();
        const used = new Set();
        for (const r of rows) {
            const buf = await fetchBytes(r.file_url);
            let name = `${(r.nama_template || 'dokumen').replace(/[^\w\- ]+/g, '').trim() || 'dokumen'}.pdf`;
            let n = 2; while (used.has(name)) name = name.replace(/\.pdf$/, `-${n++}.pdf`);
            used.add(name);
            zip.file(name, buf);
        }
        const out = await zip.generateAsync({ type: 'nodebuffer' });
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="dokumen-${req.params.batchId.slice(0, 8)}.zip"`);
        res.send(out);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/documents/records/:id — hapus catatan (berkas dihapus terpisah via /api/uploads)
router.delete('/records/:id', async (req, res) => {
    try {
        const { rowCount } = await db.query('DELETE FROM tender_documents WHERE id = $1', [req.params.id]);
        if (!rowCount) return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
