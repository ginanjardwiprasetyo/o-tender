/**
 * Schedule Routes — Tender schedule management
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/schedules
router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT ts.*, row_to_json(t.*) as tenders
            FROM tender_schedules ts
            LEFT JOIN tenders t ON t.id = ts.tender_id
            ORDER BY ts.start_date ASC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/schedules/upcoming — Jadwal dalam 7 hari ke depan
router.get('/upcoming', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT ts.*, json_build_object('nama_paket', t.nama_paket, 'instansi', t.instansi) as tenders
            FROM tender_schedules ts
            LEFT JOIN tenders t ON t.id = ts.tender_id
            WHERE ts.end_date >= NOW()
              AND ts.start_date <= NOW() + INTERVAL '7 days'
            ORDER BY ts.end_date ASC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/schedules
router.post('/', async (req, res) => {
    try {
        const { tender_id, stage_name, start_date, end_date } = req.body;
        if (!tender_id || !stage_name) {
            return res.status(400).json({ success: false, error: 'tender_id dan stage_name wajib diisi' });
        }
        const { rows } = await db.query(
            'INSERT INTO tender_schedules (tender_id, stage_name, start_date, end_date) VALUES ($1,$2,$3,$4) RETURNING *',
            [tender_id, stage_name, start_date || null, end_date || null]
        );
        res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/schedules/:id
router.delete('/:id', async (req, res) => {
    try {
        const { rowCount } = await db.query('DELETE FROM tender_schedules WHERE id = $1', [req.params.id]);
        if (!rowCount) return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
        res.json({ success: true, message: 'Jadwal berhasil dihapus' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
