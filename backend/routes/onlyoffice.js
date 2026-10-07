/**
 * TenderBuild — OnlyOffice Integration
 * Docx <-> HTML untuk editor Word online mirip filestash (OnlyOffice DocumentServer)
 * ponytail: docx lib untuk HTML→docx, mammoth untuk docx→HTML
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const db = require('../config/db');
const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, BorderStyle, Table, TableRow, TableCell, WidthType, VerticalAlign, } = require('docx');

// ─── helpers ────────────────────────────────────────────
function onlyofficeUrl() {
  return (process.env.ONLYOFFICE_URL || 'http://localhost:8000').replace(/\/$/, '');
}

// HMAC untuk file/callback (DocumentServer tanpa session cookie)
const OO_SECRET = process.env.AUTH_SECRET || crypto.createHash('sha256').update('otender-session-v1').digest('hex');
function ooSig(id) {
  return crypto.createHmac('sha256', OO_SECRET).update('oo:' + id).digest('hex').slice(0, 32);
}
function requireOoSig(req, res) {
  if (req.query.t === ooSig(req.params.id)) return true;
  res.status(403).send('Bad token');
  return false;
}

// auto-start DocumentServer lokal bila mati (dev: localhost:8000)
let _nextTry = 0;
function sh(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { cwd: path.join(__dirname, '..', '..'), timeout: 180000 }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: String(stdout || ''), stderr: String(stderr || ''), err });
    });
  });
}
async function ensureOnlyOffice() {
  const oo = onlyofficeUrl();
  if (!/localhost|127\.0\.0\.1/.test(oo)) return true; // docker network: jangan coba start dari sini
  try {
    const r = await fetch(oo + '/healthcheck', { signal: AbortSignal.timeout(2000) });
    if (r.ok) return true;
  } catch {}
  if (Date.now() < _nextTry) return false;
  _nextTry = Date.now() + 90000; // cooldown: jangan spam docker tiap health poll
  (async () => {
    // 1) daemon? (Colima)
    if (!(await sh('docker info')).ok) {
      console.log('[OnlyOffice] Docker daemon mati → colima start...');
      const st = await sh('colima start');
      if (!st.ok) {
        console.error('[OnlyOffice] colima start gagal:', (st.stderr || st.err.message || '').slice(0, 300));
        return;
      }
    }
    // 2) compose plugin? kalau ada pakai itu
    if ((await sh('docker compose version')).ok) {
      const up = await sh('docker compose up -d onlyoffice');
      if (up.ok) return console.log('[OnlyOffice] docker compose up -d onlyoffice ✓ (tunggu ~20-30 detik)');
      console.error('[OnlyOffice] compose up gagal:', up.stderr.slice(0, 300));
    }
    // 3) fallback: docker run (tanpa plugin compose) — samakan dengan docker-compose.yml
    const jwt = String(process.env.ONLYOFFICE_JWT_SECRET || 'mysecret').replace(/'/g, "");
    const exists = (await sh('docker ps -a --filter name=^onlyoffice$ --format {{.Names}}')).stdout.includes('onlyoffice');
    const cmd = exists
      ? 'docker start onlyoffice'
      : `docker run -d --name onlyoffice --restart unless-stopped -p 8000:80 ` +
        `-e JWT_ENABLED=false -e JWT_SECRET='${jwt}' -e WOPI_ENABLED=false ` +
        `-v onlyoffice_data:/var/lib/onlyoffice -v onlyoffice_logs:/var/log/onlyoffice ` +
        `onlyoffice/documentserver:8.2`;
    const run = await sh(cmd);
    if (run.ok) console.log('[OnlyOffice] container onlyoffice dijalankan ✓ (tunggu ~20-30 detik)');
    else console.error('[OnlyOffice] docker run gagal:', (run.stderr || run.err.message || '').slice(0, 300));
  })();
  return false;
}
function appPublicUrl(req) {
  if (process.env.APP_PUBLIC_URL) return process.env.APP_PUBLIC_URL.replace(/\/$/, '');
  const host = req.get('host');
  const proto = req.protocol;
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

// clean WYSIWYG artifacts dari HTML sebelum parse ke docx
function cleanHtml(html) {
  if (!html) return '<p><br/></p>';
  return html
    .replace(/<span[^>]*class="col-resizer"[^>]*><\/span>/gi, '')
    .replace(/<span[^>]*contenteditable="false"[^>]*>[\s\S]*?<\/span>/gi, '')
    .replace(/style="[^"]*position:\s*relative[^"]*"/gi, '')
    .replace(/style="[^"]*resize:[^"]*"/gi, '')
    .replace(/<colgroup>[\s\S]*?<\/colgroup>/gi, '')
    .replace(/<col[^>]*>/gi, '')
    .replace(/<tbody>/gi, '').replace(/<\/tbody>/gi, '')
    .trim();
}

// ─── HTML → Docx conversion (docx lib) ──────────────────
function parseAlignment(style) {
  if (!style) return AlignmentType.LEFT;
  if (/text-align\s*:\s*justify/i.test(style)) return AlignmentType.JUSTIFIED;
  if (/text-align\s*:\s*center/i.test(style)) return AlignmentType.CENTER;
  if (/text-align\s*:\s*right/i.test(style)) return AlignmentType.RIGHT;
  return AlignmentType.LEFT;
}

function parseInlineRuns(html) {
  const runs = [];
  // strip block tags that can appear inside table cells
  const cleaned = html.replace(/<\/?p[^>]*>/gi, '').replace(/<\/?div[^>]*>/gi, '');
  const re = /<(strong|b|em|i|u|span)([^>]*)>([\s\S]*?)<\/\1>|([^<]+)/gi;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    if (m[4]) {
      const t = m[4];
      if (t.trim()) runs.push(new TextRun({ text: t.replace(/\s+/g, ' '), font: 'Aptos', size: 24 }));
    } else {
      const tag = (m[1] || '').toLowerCase();
      const inner = stripHtml(m[3] || '');
      if (!inner.trim()) continue;
      const bold = tag === 'strong' || tag === 'b';
      const italic = tag === 'em' || tag === 'i';
      const underline = tag === 'u' ? {} : undefined;
      const style = m[2] || '';
      const fontSize = style.match(/font-size\s*:\s*(\d+(?:\.\d+)?)\s*pt/i);
      runs.push(new TextRun({
        text: inner,
        font: 'Aptos',
        size: fontSize ? Math.round(parseFloat(fontSize[1]) * 2) : 24,
        bold, italics: italic, underline,
      }));
    }
  }
  return runs.length ? runs : [new TextRun({ text: ' ', font: 'Aptos', size: 24 })];
}

function parseTable(tableHtml) {
  const rows = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr;
  while ((tr = trRe.exec(tableHtml)) !== null) {
    const cells = [];
    const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let td;
    while ((td = tdRe.exec(tr[1])) !== null) {
      const tag = td[0].startsWith('<th') ? 'th' : 'td';
      cells.push(new TableCell({
        width: { size: 3000, type: WidthType.DXA },
        children: [new Paragraph({ children: parseInlineRuns(td[1]) })],
        verticalAlign: VerticalAlign.CENTER,
      }));
    }
    if (cells.length) rows.push(new TableRow({ children: cells }));
  }
  return rows.length ? new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }) : null;
}

function htmlToDocxChildren(html) {
  const children = [];
  // Tokenize HTML into block elements
  const blockRe = /<(h[1-6]|p|table|ul|ol|li|hr|br)([^>]*)>([\s\S]*?)<\/\1>|<(hr|br)[^>]*\/?>/gi;
  let m, pos = 0;
  while ((m = blockRe.exec(html)) !== null) {
    // text sebelum tag
    if (m.index > pos) {
      const t = html.slice(pos, m.index).trim();
      if (t) children.push(new Paragraph({ children: [new TextRun({ text: stripHtml(t), font: 'Aptos', size: 24 })] }));
    }
    pos = m.index + m[0].length;
    const tag = (m[1] || m[4] || '').toLowerCase();
    const attrs = m[2] || '';
    const inner = m[3] || '';

    if (/^h[1-6]$/.test(tag)) {
      const level = parseInt(tag[1]);
      const sizes = { 1: 32, 2: 28, 3: 26, 4: 24, 5: 22, 6: 20 };
      const align = parseAlignment(attrs);
      const underline = /text-decoration\s*:\s*underline/i.test(attrs);
      children.push(new Paragraph({
        alignment: align,
        heading: level <= 3 ? HeadingLevel[`HEADING_${level}`] : undefined,
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: stripHtml(inner), font: 'Aptos', size: sizes[level] || 24, bold: true, underline: underline ? {} : undefined })],
      }));
    } else if (tag === 'table') {
      const table = parseTable(m[0]);
      if (table) children.push(table);
      children.push(new Paragraph({ spacing: { before: 80 }, children: [] }));
    } else if (tag === 'p' || tag === 'li') {
      const align = parseAlignment(attrs);
      const runs = parseInlineRuns(inner);
      children.push(new Paragraph({ alignment: align, spacing: { after: 120 }, children: runs }));
    } else if (tag === 'hr') {
      children.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' } }, children: [] }));
    } else if (tag === 'br') {
      children.push(new Paragraph({ children: [] }));
    } else {
      const runs = parseInlineRuns(m[0]);
      children.push(new Paragraph({ children: runs }));
    }
  }
  // sisa text
  if (pos < html.length) {
    const t = html.slice(pos).trim();
    if (t) children.push(new Paragraph({ children: [new TextRun({ text: stripHtml(t), font: 'Aptos', size: 24 })] }));
  }
  return children.length ? children : [new Paragraph({ children: [new TextRun({ text: ' ', font: 'Aptos', size: 24 })] })];
}

async function htmlToDocxBuffer(html) {
  const cleaned = cleanHtml(html);
  try {
    const children = htmlToDocxChildren(cleaned);
    const doc = new Document({
      sections: [{
        properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children,
      }],
    });
    return await Packer.toBuffer(doc);
  } catch (e) {
    console.error('[htmlToDocx] error:', e.message);
    const text = stripHtml(html) || ' ';
    const doc = new Document({
      sections: [{ children: [new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text, font: 'Aptos', size: 24 })] })] }]
    });
    return await Packer.toBuffer(doc);
  }
}

// ─── Docx → HTML via mammoth ────────────────────────────
async function docxToHtml(buffer) {
  try {
    const mammoth = require('mammoth');
    const res = await mammoth.convertToHtml({ buffer });
    return res.value || '<p><br/></p>';
  } catch (e) {
    return `<p>${stripHtml(buffer.toString()) || '<br/>'}</p>`;
  }
}

// ─── GET /api/onlyoffice/config/:id ─────────────────────
router.get('/config/:id', async (req, res) => {
  try {
    ensureOnlyOffice(); // fire-and-forget
    const { id } = req.params;
    const { rows } = await db.query('SELECT * FROM templates WHERE id=$1', [id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Template tidak ditemukan' });
    const tpl = rows[0];
    const key = `${id}-${new Date(tpl.updated_at || Date.now()).getTime()}`;
    const docUrl = `${appPublicUrl(req)}/api/onlyoffice/file/${id}?key=${key}&t=${ooSig(id)}`;
    const callbackUrl = `${appPublicUrl(req)}/api/onlyoffice/callback/${id}?t=${ooSig(id)}`;
    const ooUrl = onlyofficeUrl();
    res.json({
      success: true,
      data: {
        documentServerUrl: ooUrl,
        config: {
          documentType: 'word',
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
            customization: { autosave: true, forcesave: true, chat: false, comments: false, help: false, hideRightMenu: false },
            callbackUrl,
            user: { id: 'tenderbuild', name: 'TenderBuild Editor' }
          },
          type: 'desktop',
          width: '100%',
          height: '100%'
        }
      }
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── GET /api/onlyoffice/file/:id ───────────────────────
router.get('/file/:id', async (req, res) => {
  try {
    if (!requireOoSig(req, res)) return;
    const { id } = req.params;
    const { rows } = await db.query('SELECT * FROM templates WHERE id=$1', [id]);
    if (!rows.length) return res.status(404).send('Not found');
    const tpl = rows[0];
    // always regenerate docx from current html_content (no stale cache)
    const buf = await htmlToDocxBuffer(tpl.html_content || '<p><br/></p>');
    const p = docxPathFor(id);
    fs.writeFileSync(p, buf);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `inline; filename="${tpl.nama_template || 'template'}.docx"`);
    res.send(buf);
  } catch (e) { res.status(500).send(e.message); }
});

// ─── POST /api/onlyoffice/callback/:id ──────────────────
router.post('/callback/:id', async (req, res) => {
  try {
    if (!requireOoSig(req, res)) return;
    const { id } = req.params;
    const { status, url, key } = req.body || {};
    if ((status === 2 || status === 6) && url) {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Gagal download docx dari DocumentServer: ' + resp.status);
      const buf = Buffer.from(await resp.arrayBuffer());
      fs.writeFileSync(docxPathFor(id), buf);
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

// ─── POST /api/onlyoffice/save-html/:id ─────────────────
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

// ─── GET /api/onlyoffice/health ─────────────────────────
router.get('/health', async (req, res) => {
  try {
    const oo = onlyofficeUrl();
    const r = await fetch(oo + '/healthcheck', { signal: AbortSignal.timeout(3000) }).catch(()=>null);
    const reachable = !!(r && r.ok);
    let starting = false;
    if (!reachable) starting = !(await ensureOnlyOffice());
    res.json({ success: true, documentServerUrl: oo, reachable, starting, status: r ? r.status : 'unreachable' });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

module.exports = router;
module.exports.ensureOnlyOffice = ensureOnlyOffice;
