/**
 * Template Routes — Document template management
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db');

const FIELDS = [
    'nama_template', 'kategori', 'html_content',
    'kop_logo_url', 'kop_nama', 'kop_alamat', 'kop_kontak',
    'kop_is_image', 'kop_image_url',
    'ttd_nama', 'ttd_jabatan', 'ttd_image_url', 'cap_image_url',
    'paper_size', 'margin_top', 'margin_bottom', 'margin_left', 'margin_right',
    'fit_layout'
];

// GET all
router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM templates ORDER BY created_at DESC');
        res.json({ success: true, data: rows });
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
