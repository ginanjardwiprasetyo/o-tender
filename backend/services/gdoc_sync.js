/**
 * GDoc Sync — cerminkan isi folder Drive (GDRIVE_TEMPLATE_FOLDER) jadi baris templates.
 * Incremental: export (mahal) hanya bila file berubah sejak sync terakhir. Baris manual (gdoc_id NULL) tak tersentuh.
 */
const db = require('../config/db');
const gdoc = require('../config/gdoc');
const { normText } = require('./docbuilder');

const ptToMm = (v) => v ? Math.round(v.magnitude * 25.4 / 72 * 100) / 100 : null;

/** Struktur section GDocs → [{anchor, orient, mt, mr, mb, ml}]; anchor = teks normalisasi paragraf awal NEXT_PAGE. */
async function layoutSections(gdocId) {
    const data = await gdoc.fetchDocStructure(gdocId);
    const ds = data.documentStyle || {};
    const dw = (ds.pageSize && ds.pageSize.width && ds.pageSize.width.magnitude) || 595.28;
    const dh = (ds.pageSize && ds.pageSize.height && ds.pageSize.height.magnitude) || 841.89;
    // ponytail: orientasi efektif = dims XOR flipPageOrientation (personil: 595x842 + flip → landscape)
    const raw = dw > dh ? 'L' : 'P';
    const docOrient = ds.flipPageOrientation ? (raw === 'P' ? 'L' : 'P') : raw;
    const docM = { mt: ptToMm(ds.marginTop), mr: ptToMm(ds.marginRight), mb: ptToMm(ds.marginBottom), ml: ptToMm(ds.marginLeft) };
    const c = (data.body && data.body.content) || [];
    const secs = [];
    c.forEach((e, i) => {
        const s = e.sectionBreak && e.sectionBreak.sectionStyle;
        if (!s) return;
        // orientasi: flipPageOrientation = dibalik vs orientasi default dokumen (bukan vs section sebelumnya)
        const orient = s.flipPageOrientation ? (docOrient === 'P' ? 'L' : 'P') : docOrient;
        const m = {
            mt: ptToMm(s.marginTop) ?? docM.mt, mr: ptToMm(s.marginRight) ?? docM.mr,
            mb: ptToMm(s.marginBottom) ?? docM.mb, ml: ptToMm(s.marginLeft) ?? docM.ml,
        };
        if (i === 0) { secs.push({ anchor: null, orient, ...m }); return; }
        // ponytail: CONTINUOUS di tengah tanpa page break → ikut segmen sebelumnya
        if (s.sectionType !== 'NEXT_PAGE') return;
        let txt = '';
        for (let j = i + 1; j < c.length && !txt; j++) {
            const p = c[j].paragraph;
            if (p) txt = (p.elements || []).map(x => (x.textRun || {}).content || '').join('');
        }
        txt = normText(txt).slice(0, 80);
        if (txt) secs.push({ anchor: txt, orient, ...m });
    });
    return { orient: docOrient, sections: secs };
}

async function syncFolderTemplates(folder) {
    folder = folder || process.env.GDRIVE_TEMPLATE_FOLDER;
    if (!folder) throw new Error('Folder Drive belum dikonfigurasi (GDRIVE_TEMPLATE_FOLDER)');
    const files = await gdoc.listDocs(folder);
    const existing = await db.query('SELECT id, gdoc_id, gdoc_synced_at FROM templates WHERE gdoc_id IS NOT NULL');
    const byGdoc = Object.fromEntries(existing.rows.map(r => [r.gdoc_id, r]));
    let added = 0, updated = 0;
    for (const f of files) {
        const cur = byGdoc[f.id];
        const stale = !cur || !cur.gdoc_synced_at || new Date(f.modifiedTime) > new Date(cur.gdoc_synced_at);
        if (!stale) continue;
        const exp = await gdoc.exportDocHtml(f.id);
        let layout = null, orient = null;
        try { ({ orient, sections: layout } = await layoutSections(f.id)); }
        catch (e) { console.warn('[gdoc_sync] struktur section gagal (' + f.name + '):', e.message); }
        const orientCol = orient === 'L' ? 'landscape' : orient === 'P' ? 'portrait' : null;
        if (cur) {
            await db.query('UPDATE templates SET nama_template = $1, html_content = $2, layout_sections = $3, orientation = COALESCE($4, orientation), gdoc_synced_at = NOW() WHERE id = $5',
                [f.name, exp.html, layout ? JSON.stringify(layout) : null, orientCol, cur.id]);
            updated++;
        } else {
            await db.query(`INSERT INTO templates (nama_template, kategori, html_content, gdoc_id, layout_sections, orientation, gdoc_synced_at)
                            VALUES ($1, 'Google Docs', $2, $3, $4, COALESCE($5, 'portrait'), NOW())`, [f.name, exp.html, f.id, layout ? JSON.stringify(layout) : null, orientCol]);
            added++;
        }
    }
    const ids = files.map(f => f.id);
    const del = await db.query('DELETE FROM templates WHERE gdoc_id IS NOT NULL AND NOT (gdoc_id = ANY($1))', [ids.length ? ids : ['-']]);
    return { added, updated, removed: del.rowCount, total: files.length };
}

module.exports = { syncFolderTemplates };
