/**
 * GDoc Sync — cerminkan isi folder Drive (GDRIVE_TEMPLATE_FOLDER) jadi baris templates.
 * Incremental: export (mahal) hanya bila file berubah sejak sync terakhir. Baris manual (gdoc_id NULL) tak tersentuh.
 */
const db = require('../config/db');
const gdoc = require('../config/gdoc');

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
        if (cur) {
            await db.query('UPDATE templates SET nama_template = $1, html_content = $2, gdoc_synced_at = NOW() WHERE id = $3',
                [f.name, exp.html, cur.id]);
            updated++;
        } else {
            await db.query(`INSERT INTO templates (nama_template, kategori, html_content, gdoc_id, gdoc_synced_at)
                            VALUES ($1, 'Google Docs', $2, $3, NOW())`, [f.name, exp.html, f.id]);
            added++;
        }
    }
    const ids = files.map(f => f.id);
    const del = await db.query('DELETE FROM templates WHERE gdoc_id IS NOT NULL AND NOT (gdoc_id = ANY($1))', [ids.length ? ids : ['-']]);
    return { added, updated, removed: del.rowCount, total: files.length };
}

module.exports = { syncFolderTemplates };
