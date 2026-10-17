/**
 * Template Routes — Document template management
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const gdoc = require('../config/gdoc');
const { syncFolderTemplates } = require('../services/gdoc_sync');

const FIELDS = [
    'nama_template', 'kategori', 'html_content',
    'kop_logo_url', 'kop_nama', 'kop_alamat', 'kop_kontak',
    'kop_is_image', 'kop_image_url',
    'ttd_nama', 'ttd_jabatan', 'ttd_image_url', 'cap_image_url',
    'paper_size', 'margin_top', 'margin_bottom', 'margin_left', 'margin_right',
    'orientation',
    'fit_layout',
    'gdoc_id'
];

// ─── Google Docs binding (ditaruh sebelum /:id agar tak tertelan) ───
// GET /api/templates/gdrive/files?folder=<folderId> — daftar Google Docs dalam folder template
router.get('/gdrive/files', async (req, res) => {
    try {
        if (!req.query.folder) return res.status(400).json({ success: false, error: 'Parameter folder wajib diisi' });
        res.json({ success: true, data: await gdoc.listDocs(req.query.folder) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/templates/:id/sync { gdoc_id? } — tarik HTML terbaru dari Google Docs ke template ini
router.post('/:id/sync', async (req, res) => {
    try {
        const cur = await db.query('SELECT id, gdoc_id FROM templates WHERE id = $1', [req.params.id]);
        if (!cur.rows[0]) return res.status(404).json({ success: false, error: 'Template tidak ditemukan' });
        const gdocId = req.body.gdoc_id || cur.rows[0].gdoc_id;
        if (!gdocId) return res.status(400).json({ success: false, error: 'gdoc_id belum diisi (kirim di body atau simpan dulu di template)' });
        const exp = await gdoc.exportDocHtml(gdocId);
        const { rows } = await db.query(
            `UPDATE templates SET html_content = $1, gdoc_id = $2, gdoc_synced_at = NOW() WHERE id = $3 RETURNING *`,
            [exp.html, gdocId, req.params.id]
        );
        res.json({ success: true, data: rows[0], gdoc_name: exp.name, html_length: exp.html.length });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET all
router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM templates ORDER BY created_at DESC');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/templates/sync-folder { folder? } — cerminkan isi folder Drive jadi baris template
router.post('/sync-folder', async (req, res) => {
    try {
        res.json({ success: true, data: await syncFolderTemplates(req.body.folder) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET one
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM templates WHERE id = $1', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ success: false, error: 'Template tidak ditemukan' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST create
router.post('/', async (req, res) => {
    try {
        const { nama_template } = req.body;
        if (!nama_template) return res.status(400).json({ success: false, error: 'Nama template wajib diisi' });

        const cols = FIELDS.filter(f => req.body[f] !== undefined);
        const vals = cols.map(f => req.body[f]);
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');

        const { rows } = await db.query(
            `INSERT INTO templates (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
            vals
        );
        res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT update
router.put('/:id', async (req, res) => {
    try {
        const cols = FIELDS.filter(f => req.body[f] !== undefined);
        if (!cols.length) return res.status(400).json({ success: false, error: 'Tidak ada data untuk diupdate' });

        const sets = cols.map((f, i) => `${f} = $${i + 1}`).join(', ');
        const vals = cols.map(f => req.body[f]);
        vals.push(req.params.id);

        const { rows } = await db.query(
            `UPDATE templates SET ${sets} WHERE id = $${vals.length} RETURNING *`,
            vals
        );
        if (!rows[0]) return res.status(404).json({ success: false, error: 'Template tidak ditemukan' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE
router.delete('/:id', async (req, res) => {
    try {
        const { rowCount } = await db.query('DELETE FROM templates WHERE id = $1', [req.params.id]);
        if (!rowCount) return res.status(404).json({ success: false, error: 'Template tidak ditemukan' });
        res.json({ success: true, message: 'Template berhasil dihapus' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
