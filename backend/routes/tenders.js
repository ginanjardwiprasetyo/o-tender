/**
 * Tender Routes — CRUD for followed tenders
 * PENTING: /stats dan /assign/:id HARUS sebelum /:id
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/tenders/stats — HARUS sebelum /:id
router.get('/stats', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT status_internal FROM tenders');
        const stats = {
            total: rows.length,
            persiapan: rows.filter(t => t.status_internal === 'Persiapan').length,
            pemasukan: rows.filter(t => t.status_internal === 'Pemasukan Dokumen').length,
            evaluasi: rows.filter(t => t.status_internal === 'Evaluasi').length,
            menang: rows.filter(t => t.status_internal === 'Menang').length,
            kalah: rows.filter(t => t.status_internal === 'Kalah').length,
        };
        res.json({ success: true, data: stats });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/tenders/assign/:id — HARUS sebelum /:id
router.delete('/assign/:id', async (req, res) => {
    try {
        const { rowCount } = await db.query(
            'DELETE FROM tender_personnel_assignments WHERE id = $1', [req.params.id]
        );
        if (!rowCount) return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
        res.json({ success: true, message: 'Penugasan dihapus' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/tenders
router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        let sql = `SELECT t.*, 
            COALESCE(json_agg(ts.*) FILTER (WHERE ts.id IS NOT NULL), '[]') as tender_schedules
            FROM tenders t
            LEFT JOIN tender_schedules ts ON ts.tender_id = t.id`;
        const params = [];
        if (status) {
            sql += ' WHERE t.status_internal = $1';
            params.push(status);
        }
        sql += ' GROUP BY t.id ORDER BY t.created_at DESC';
        const { rows } = await db.query(sql, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/tenders/:id
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM tenders WHERE id = $1', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ success: false, error: 'Tender tidak ditemukan' });

        const [schedRes, assignRes] = await Promise.all([
            db.query('SELECT * FROM tender_schedules WHERE tender_id = $1 ORDER BY start_date', [req.params.id]),
            db.query(`SELECT tpa.*, row_to_json(p.*) as personnel
                      FROM tender_personnel_assignments tpa
                      LEFT JOIN personnel p ON p.id = tpa.personnel_id
                      WHERE tpa.tender_id = $1 ORDER BY tpa.urutan`, [req.params.id])
        ]);

        res.json({
            success: true,
            data: {
                ...rows[0],
                tender_schedules: schedRes.rows,
                tender_personnel_assignments: assignRes.rows
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/tenders
router.post('/', async (req, res) => {
    try {
        const allowedFields = [
            'kode_tender', 'kd_lpse', 'nama_lpse', 'nama_paket', 'instansi', 'satker',
            'pagu', 'hps', 'kategori_pekerjaan', 'metode_pemilihan', 'metode_evaluasi',
            'status_tender', 'status_internal', 'lokasi_paket', 'anggaran',
            'jadwal_pengumuman', 'jadwal_penawaran', 'jumlah_pendaftar', 'jumlah_penawar',
            'catatan', 'is_followed'
        ];
        
        const data = {};
        allowedFields.forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });

        const fields = Object.keys(data);
        const values = Object.values(data);
        if (fields.length === 0) return res.status(400).json({ success: false, error: 'Tidak ada data valid' });

        const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
        const { rows } = await db.query(
            `INSERT INTO tenders (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`,
            values
        );
        res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/tenders/:id
router.put('/:id', async (req, res) => {
    try {
        const allowedFields = [
            'nama_paket', 'instansi', 'satker', 'pagu', 'hps', 'status_tender',
            'status_internal', 'lokasi_paket', 'anggaran', 'catatan', 'is_followed'
        ];

        const data = {};
        allowedFields.forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });

        const fields = Object.keys(data);
        const values = Object.values(data);
        if (fields.length === 0) return res.status(400).json({ success: false, error: 'Tidak ada data valid' });

        const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
        const { rows } = await db.query(
            `UPDATE tenders SET ${setClause}, updated_at = NOW() WHERE id = $${fields.length + 1} RETURNING *`,
            [...values, req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ success: false, error: 'Tender tidak ditemukan' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/tenders/:id
router.delete('/:id', async (req, res) => {
    try {
        const { rowCount } = await db.query('DELETE FROM tenders WHERE id = $1', [req.params.id]);
        if (!rowCount) return res.status(404).json({ success: false, error: 'Tender tidak ditemukan' });
        res.json({ success: true, message: 'Tender berhasil dihapus' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/tenders/:id/assign
router.post('/:id/assign', async (req, res) => {
    try {
        const { personnel_id, jabatan, urutan } = req.body;
        if (!personnel_id) return res.status(400).json({ success: false, error: 'personnel_id wajib diisi' });

        const { rows } = await db.query(
            `INSERT INTO tender_personnel_assignments (tender_id, personnel_id, jabatan, urutan)
             VALUES ($1,$2,$3,$4) RETURNING *`,
            [req.params.id, personnel_id, jabatan || null, urutan || null]
        );
        // Fetch personnel data
        const { rows: pRows } = await db.query('SELECT * FROM personnel WHERE id = $1', [personnel_id]);
        res.status(201).json({ success: true, data: { ...rows[0], personnel: pRows[0] || null } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
