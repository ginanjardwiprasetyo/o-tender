/**
 * Equipment Routes — CRUD for construction equipment
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db');

async function deleteSupabaseFile(fileUrl) {
    if (!fileUrl) return;
    try {
        const parts = fileUrl.split('/storage/v1/object/public/uploads/');
        if (parts.length > 1) {
            const filePath = decodeURIComponent(parts[1]);
            const supabase = require('../config/supabase');
            await supabase.storage.from('uploads').remove([filePath]);
            console.log(`[Cleanup] File successfully deleted from Supabase Storage: ${filePath}`);
        }
    } catch (e) {
        console.error('[Cleanup Error] Gagal menghapus file Supabase:', e.message);
    }
}

// GET /api/equipments
router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM equipments ORDER BY created_at DESC'
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/equipments/:id
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM equipments WHERE id = $1', [req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/equipments
router.post('/', async (req, res) => {
    try {
        const { jenis, kapasitas, jumlah, tahun_produksi, merk_type, kondisi, lokasi_sekarang, bukti_kepemilikan, file_url } = req.body;
        if (!jenis || !jenis.trim()) return res.status(400).json({ success: false, error: 'Jenis peralatan wajib diisi' });

        const { rows } = await db.query(
            `INSERT INTO equipments (jenis, kapasitas, jumlah, tahun_produksi, merk_type, kondisi, lokasi_sekarang, bukti_kepemilikan, file_url)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
            [jenis, kapasitas || null, jumlah || null, tahun_produksi || null, merk_type || null,
             kondisi || 'Baik', lokasi_sekarang || null, bukti_kepemilikan || null, file_url || null]
        );
        res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/equipments/:id
router.put('/:id', async (req, res) => {
    try {
        const { jenis, kapasitas, jumlah, tahun_produksi, merk_type, kondisi, lokasi_sekarang, bukti_kepemilikan, file_url } = req.body;
        const { rows } = await db.query(
            `UPDATE equipments SET jenis=$1, kapasitas=$2, jumlah=$3, tahun_produksi=$4,
             merk_type=$5, kondisi=$6, lokasi_sekarang=$7, bukti_kepemilikan=$8, file_url=$9
             WHERE id=$10 RETURNING *`,
            [jenis, kapasitas || null, jumlah || null, tahun_produksi || null, merk_type || null,
             kondisi || 'Baik', lokasi_sekarang || null, bukti_kepemilikan || null, file_url || null, req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/equipments/:id
router.delete('/:id', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT file_url FROM equipments WHERE id = $1', [req.params.id]);
        if (rows[0] && rows[0].file_url) {
            await deleteSupabaseFile(rows[0].file_url);
        }

        const { rowCount } = await db.query('DELETE FROM equipments WHERE id = $1', [req.params.id]);
        if (!rowCount) return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
        res.json({ success: true, message: 'Data alat berhasil dihapus' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
