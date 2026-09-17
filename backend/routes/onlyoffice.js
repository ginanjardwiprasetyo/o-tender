/**
 * TenderBuild — OnlyOffice Integration
 * Docx <-> HTML untuk editor Word online mirip filestash (OnlyOffice DocumentServer)
 * ponytail: minimal deps — docx + mammoth optional, fallback paragraph
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

// ─── helpers ────────────────────────────────────────────
function onlyofficeUrl() {
  return (process.env.ONLYOFFICE_URL || 'http://localhost:8000').replace(/\/$/, '');
}
function appPublicUrl(req) {
  // untuk colima/docker: DocumentServer di VM butuh host.docker.internal/host.lima.internal, bukan localhost
  if (process.env.APP_PUBLIC_URL) return process.env.APP_PUBLIC_URL.replace(/\/$/, '');
  const host = req.get('host');
  const proto = req.protocol;
  // jika host adalah localhost, DocumentServer di container tidak bisa akses localhost → pakai host.docker.internal
  if (host && host.includes('localhost')) {
    return `${proto}://host.docker.internal:3000`;
  }
  return `${proto}://${host}`;
}
function docxPathFor(id) {
  const dir = path.join(__dirname, '..', 'uploads', 'onlyoffice');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${id}.docx`);
}
function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// generate docx buffer from html_content — ponytail: docx lib, fallback minimal
async function htmlToDocxBuffer(html) {
  // coba html-to-docx jika ada, fallback ke docx lib
  try {
    // lazy require agar tidak wajib install
    const HTMLToDOCX = require('html-to-docx');
    const wrapped = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'Aptos', Calibri, sans-serif; font-size:12pt;}</style></head><body>${html || '<p><br/></p>'}</body></html>`;
    const buf = await HTMLToDOCX(wrapped, null, { table: { row: { cantSplit: true } }, footer: false, header: false });
    return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  } catch (e) {
    // fallback docx
    const { Document, Packer, Paragraph, TextRun, AlignmentType } = require('docx');
    const text = stripHtml(html) || ' ';
    const doc = new Document({
      sections: [{ children: [new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text, font: 'Aptos', size: 24 })] })] }]
    });
    return await Packer.toBuffer(doc);
  }
}

// docx -> html via mammoth (jika ada), fallback text
async function docxToHtml(buffer) {
  try {
    const mammoth = require('mammoth');
    const res = await mammoth.convertToHtml({ buffer });
    return res.value || '<p><br/></p>';
  } catch (e) {
    return `<p>${stripHtml(buffer.toString()) || '<br/>'}</p>`;
  }
}

// ─── GET /api/onlyoffice/config/:id  → DocsAPI config ──
router.get('/config/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query('SELECT * FROM templates WHERE id=$1', [id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Template tidak ditemukan' });
    const tpl = rows[0];
    const key = `${id}-${new Date(tpl.updated_at || Date.now()).getTime()}`;
    const docUrl = `${appPublicUrl(req)}/api/onlyoffice/file/${id}?key=${key}`;
    const callbackUrl = `${appPublicUrl(req)}/api/onlyoffice/callback/${id}`;
    const ooUrl = onlyofficeUrl();
    res.json({
      success: true,
      data: {
        documentServerUrl: ooUrl,
        config: {
          document: {
            fileType: 'docx',
            key,
            title: `${tpl.nama_template || 'Template'}.docx`,
            url: docUrl,
            permissions: { edit: true, download: true, print: true },
            info: { owner: 'TenderBuild' }
          },
          editorConfig: {
            mode: 'edit',
            lang: 'id',
            customization: {
              autosave: true,
              forcesave: true,
              chat: false,
              comments: false,
              help: false,
              hideRightMenu: false
            },
            callbackUrl,
            user: { id: 'tenderbuild', name: 'TenderBuild Editor' }
          },
          type: 'desktop',
          width: '100%',
          height: '100%'
        }
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── GET /api/onlyoffice/file/:id  → serve docx untuk DocumentServer ──
router.get('/file/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query('SELECT * FROM templates WHERE id=$1', [id]);
    if (!rows.length) return res.status(404).send('Not found');
    const tpl = rows[0];
    const p = docxPathFor(id);
    let buf;
    if (fs.existsSync(p)) {
      buf = fs.readFileSync(p);
    } else {
      buf = await htmlToDocxBuffer(tpl.html_content || '<p><br/></p>');
      fs.writeFileSync(p, buf);
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `inline; filename="${tpl.nama_template || 'template'}.docx"`);
    res.send(buf);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// ─── POST /api/onlyoffice/callback/:id  → OnlyOffice save ──
router.post('/callback/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, url, key } = req.body || {};
    // status 2 = ready for saving, 6 = mustsave (forcesave)
    if ((status === 2 || status === 6) && url) {
      // download docx dari DocumentServer
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Gagal download docx dari DocumentServer: ' + resp.status);
      const buf = Buffer.from(await resp.arrayBuffer());
      const p = docxPathFor(id);
      fs.writeFileSync(p, buf);
      // convert docx -> html untuk disimpan ke DB (agar cetak tetap jalan)
      const html = await docxToHtml(buf);
      await db.query('UPDATE templates SET html_content=$1, updated_at=NOW() WHERE id=$2', [html, id]);
      console.log(`[OnlyOffice] Template ${id} saved, key=${key}`);
    }
    res.json({ error: 0 });
  } catch (e) {
    console.error('[OnlyOffice callback]', e.message);
    res.json({ error: 0 });
  }
});

// ─── POST /api/onlyoffice/save-html/:id  → fallback manual save html → docx ──
router.post('/save-html/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { html } = req.body;
    if (typeof html !== 'string') return res.status(400).json({ success: false, error: 'html required' });
    const buf = await htmlToDocxBuffer(html);
    fs.writeFileSync(docxPathFor(id), buf);
    await db.query('UPDATE templates SET html_content=$1, updated_at=NOW() WHERE id=$2', [html, id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── GET /api/onlyoffice/health  → cek DocumentServer ──
router.get('/health', async (req, res) => {
  try {
    const oo = onlyofficeUrl();
    const r = await fetch(oo + '/healthcheck', { signal: AbortSignal.timeout(3000) }).catch(()=>null);
    res.json({ success: true, documentServerUrl: oo, reachable: !!(r && r.ok), status: r ? r.status : 'unreachable' });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

module.exports = router;
