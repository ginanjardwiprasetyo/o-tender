/**
 * Equipment Routes — CRUD for construction equipment
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db');

async function deleteSupabaseFile(fileUrl) {
    if (!fileUrl) return;
    try {
        // 1. Coba hapus sebagai file Supabase
        const parts = fileUrl.split('/storage/v1/object/public/uploads/');
        if (parts.length > 1) {
            const filePath = decodeURIComponent(parts[1]);
            const supabase = require('../config/supabase');
            await supabase.storage.from('uploads').remove([filePath]);
            console.log(`[Cleanup] File successfully deleted from Supabase Storage: ${filePath}`);
            return;
        }

        // 2. Jika bukan Supabase, coba hapus sebagai file lokal localhost
        const localParts = fileUrl.split('/uploads/');
        if (localParts.length > 1) {
            const fs = require('fs');
            const path = require('path');
            const relativePath = decodeURIComponent(localParts[1]);
            const absolutePath = path.join(__dirname, '..', 'uploads', relativePath);
            if (fs.existsSync(absolutePath)) {
                fs.unlinkSync(absolutePath);
                console.log(`[Cleanup Local] File successfully deleted from localhost: ${absolutePath}`);
            }
        }
    } catch (e) {
        console.error('[Cleanup Error] Gagal menghapus file:', e.message);
    }
}

// GET /api/equipments
router.get('/', async (req, res) => {
    try {
        // ponytail: sertakan jumlah lampiran per alat (doc files + berbagi) agar ikon mata akurat
        // ponytail: + singkatan perusahaan pemilik (kolom PT)
        const { rows } = await db.query(
            `SELECT e.*, COALESCE(f.n, 0)::int AS doc_count, c.singkatan AS company_singkatan
             FROM equipments e
             LEFT JOIN (SELECT equipment_id, COUNT(*) AS n FROM equipment_doc_files GROUP BY equipment_id) f
               ON f.equipment_id = e.id
             LEFT JOIN companies c ON c.id = e.company_id
             ORDER BY e.created_at DESC`
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
        const { jenis, kapasitas, kapasitas_angka, kapasitas_satuan, jumlah, tahun_produksi, merk_type, kondisi, lokasi_sekarang, bukti_kepemilikan, file_url, company_id } = req.body;
        if (!jenis || !jenis.trim()) return res.status(400).json({ success: false, error: 'Jenis peralatan wajib diisi' });

        const { rows } = await db.query(
            `INSERT INTO equipments (jenis, kapasitas, kapasitas_angka, kapasitas_satuan, jumlah, tahun_produksi, merk_type, kondisi, lokasi_sekarang, bukti_kepemilikan, file_url, company_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
            [jenis, kapasitas || null, kapasitas_angka ?? null, kapasitas_satuan || null, jumlah || null, tahun_produksi || null, merk_type || null,
             kondisi || 'Baik', lokasi_sekarang || null, bukti_kepemilikan || null, file_url || null, company_id || null]
        );
        res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/equipments/:id — merge: hanya field yang dikirim (aman untuk edit parsial/inline)
const EQUIP_FIELDS = ['jenis', 'kapasitas', 'kapasitas_angka', 'kapasitas_satuan', 'jumlah', 'tahun_produksi', 'merk_type', 'kondisi', 'lokasi_sekarang', 'bukti_kepemilikan', 'file_url', 'company_id'];
router.put('/:id', async (req, res) => {
    try {
        const sets = [], vals = [];
        for (const k of EQUIP_FIELDS) {
            if (Object.prototype.hasOwnProperty.call(req.body, k)) {
                vals.push(req.body[k] ?? null);
                sets.push(`${k}=$${vals.length}`);
            }
        }
        if (!sets.length) return res.status(400).json({ success: false, error: 'Tidak ada field yang diupdate' });
        vals.push(req.params.id);
        const { rows } = await db.query(`UPDATE equipments SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`, vals);
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

// GET /api/equipments/files/all — bank file semua alat (untuk berbagi antar alat)
// File yg dipakai >1 alat tetap ditampilkan SATU kali: baris "induk" = yg paling
// pertama kali diupload (created_at paling awal) →baris lainnya cuma tautan/shared.
router.get('/files/all', async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT f.id, f.label, f.file_url, f.created_at,
                    e.jenis AS equipment_nama, e.company_id,
                    c.singkatan AS company_singkatan, c.nama_perusahaan,
                    (SELECT COUNT(*) FROM equipment_doc_files f2 WHERE f2.file_url = f.file_url) AS used_count,
                    (SELECT array_agg(DISTINCT e2.jenis) FROM equipment_doc_files f2
                     JOIN equipments e2 ON e2.id = f2.equipment_id
                     WHERE f2.file_url = f.file_url) AS used_by
             FROM equipment_doc_files f
             JOIN equipments e ON e.id = f.equipment_id
             LEFT JOIN companies c ON c.id = e.company_id
             WHERE f.id = (SELECT f3.id FROM equipment_doc_files f3
                           WHERE f3.file_url = f.file_url
                           ORDER BY f3.created_at ASC, f3.id ASC LIMIT 1)
             ORDER BY f.created_at DESC LIMIT 200`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── Lampiran per alat (1 alat N file; boleh berbagi file antar alat) ───
// GET /api/equipments/:id/files
router.get('/:id/files', async (req, res) => {
    try {
        // shared_from = alat lain yg pakai berkas yg sama (berbagi tanpa upload ulang)
        const { rows } = await db.query(
            `SELECT f.*, (
                 SELECT e2.jenis FROM equipment_doc_files f2
                 JOIN equipments e2 ON e2.id = f2.equipment_id
                 WHERE f2.file_url = f.file_url AND f2.equipment_id <> f.equipment_id
                 LIMIT 1
             ) AS shared_from,
             (SELECT COUNT(*) FROM equipment_doc_files f3
              WHERE f3.file_url = f.file_url AND f3.equipment_id <> f.equipment_id
             ) AS shared_count
             FROM equipment_doc_files f WHERE f.equipment_id = $1 ORDER BY f.created_at`,
            [req.params.id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/equipments/:id/files { label?, file_url?, file_id? (pakai file milik alat lain) }
router.post('/:id/files', async (req, res) => {
    try {
        const { label, file_url, file_id } = req.body;
        let src = null;
        if (file_id) {
            const r = await db.query('SELECT * FROM equipment_doc_files WHERE id = $1', [file_id]);
            if (!r.rows[0]) return res.status(404).json({ success: false, error: 'File sumber tidak ditemukan' });
            src = r.rows[0];
        }
        const url = file_url || src?.file_url;
        if (!url) return res.status(400).json({ success: false, error: 'file_url / file_id wajib diisi' });
        const { rows } = await db.query(
            `INSERT INTO equipment_doc_files (equipment_id, label, file_url) VALUES ($1, $2, $3) RETURNING *`,
            [req.params.id, label || src?.label || null, url]
        );
        res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/equipments/files/:fileId (catatan saja; berkas storage dihapus terpisah)
router.delete('/files/:fileId', async (req, res) => {
    try {
        const { rowCount } = await db.query('DELETE FROM equipment_doc_files WHERE id = $1', [req.params.fileId]);
        if (!rowCount) return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
