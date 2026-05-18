/**
 * Personnel Routes — CRUD for personnel + education + experience
 * PENTING: Route spesifik (education/:id, experience/:id) HARUS sebelum /:id
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

// ─── Sub-routes spesifik (HARUS di atas /:id) ────────────────

// DELETE /api/personnel/education/:id
router.delete('/education/:id', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT ijazah_url FROM education_history WHERE id = $1', [req.params.id]);
        if (rows[0] && rows[0].ijazah_url) {
            await deleteSupabaseFile(rows[0].ijazah_url);
        }

        const { rowCount } = await db.query('DELETE FROM education_history WHERE id = $1', [req.params.id]);
        if (!rowCount) return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
        res.json({ success: true, message: 'Riwayat pendidikan berhasil dihapus' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/personnel/experience/:id
router.put('/experience/:id', async (req, res) => {
    try {
        const { tahun, nama_kegiatan, lokasi, pengguna_jasa, perusahaan, uraian_tugas, waktu_pelaksanaan, posisi } = req.body;
        const { rows } = await db.query(
            `UPDATE experience_history SET tahun=$1, nama_kegiatan=$2, lokasi=$3, pengguna_jasa=$4,
             perusahaan=$5, uraian_tugas=$6, waktu_pelaksanaan=$7, posisi=$8 WHERE id=$9 RETURNING *`,
            [tahun, nama_kegiatan, lokasi, pengguna_jasa, perusahaan, uraian_tugas, waktu_pelaksanaan, posisi, req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/personnel/experience/:id
router.delete('/experience/:id', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT surat_referensi_url FROM experience_history WHERE id = $1', [req.params.id]);
        if (rows[0] && rows[0].surat_referensi_url) {
            await deleteSupabaseFile(rows[0].surat_referensi_url);
        }

        const { rowCount } = await db.query('DELETE FROM experience_history WHERE id = $1', [req.params.id]);
        if (!rowCount) return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
        res.json({ success: true, message: 'Pengalaman kerja berhasil dihapus' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/personnel/ska/:id
router.delete('/ska/:id', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT file_url FROM personnel_ska WHERE id = $1', [req.params.id]);
        if (rows[0] && rows[0].file_url) {
            await deleteSupabaseFile(rows[0].file_url);
        }

        const { rowCount } = await db.query('DELETE FROM personnel_ska WHERE id = $1', [req.params.id]);
        if (!rowCount) return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
        res.json({ success: true, message: 'SKA berhasil dihapus' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── Personnel CRUD ───────────────────────────────────────────

// GET /api/personnel
router.get('/', async (req, res) => {
    try {
        const { rows: personnel } = await db.query('SELECT * FROM personnel ORDER BY created_at DESC');
        if (!personnel.length) return res.json({ success: true, data: [] });

        const ids = personnel.map(p => p.id);
        const [eduRes, expRes, skaRes] = await Promise.all([
            db.query('SELECT * FROM education_history WHERE personnel_id = ANY($1)', [ids]),
            db.query('SELECT * FROM experience_history WHERE personnel_id = ANY($1)', [ids]),
            db.query('SELECT * FROM personnel_ska WHERE personnel_id = ANY($1)', [ids])
        ]);

        const data = personnel.map(p => ({
            ...p,
            education_history: eduRes.rows.filter(e => e.personnel_id === p.id),
            experience_history: expRes.rows.filter(e => e.personnel_id === p.id),
            ska: skaRes.rows.filter(s => s.personnel_id === p.id)
        }));
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/personnel/:id
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM personnel WHERE id = $1', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });

        const [eduRes, expRes, skaRes] = await Promise.all([
            db.query('SELECT * FROM education_history WHERE personnel_id = $1 ORDER BY tahun_tamat DESC', [req.params.id]),
            db.query('SELECT * FROM experience_history WHERE personnel_id = $1 ORDER BY tahun DESC', [req.params.id]),
            db.query('SELECT * FROM personnel_ska WHERE personnel_id = $1 ORDER BY berlaku_sampai DESC', [req.params.id])
        ]);

        res.json({
            success: true,
            data: { ...rows[0], education_history: eduRes.rows, experience_history: expRes.rows, ska: skaRes.rows }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/personnel
router.post('/', async (req, res) => {
    try {
        const { nama, tempat_lahir, tanggal_lahir, tingkat_pendidikan, tahun_pengalaman,
                sertifikat_keahlian, no_registrasi_ska, ijasah_ref, foto_url, jabatan, ktp_url, npwp_url, skk_url } = req.body;
        if (!nama || !nama.trim()) return res.status(400).json({ success: false, error: 'Nama wajib diisi' });

        const { rows } = await db.query(
            `INSERT INTO personnel (nama, tempat_lahir, tanggal_lahir, tingkat_pendidikan, tahun_pengalaman,
             sertifikat_keahlian, no_registrasi_ska, ijasah_ref, foto_url, jabatan, ktp_url, npwp_url, skk_url)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
            [nama, tempat_lahir || null, tanggal_lahir || null, tingkat_pendidikan || null,
             tahun_pengalaman || null, sertifikat_keahlian || null, no_registrasi_ska || null,
             ijasah_ref || null, foto_url || null, jabatan || null, ktp_url || null, npwp_url || null, skk_url || null]
        );
        res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/personnel/:id
router.put('/:id', async (req, res) => {
    try {
        const { nama, tempat_lahir, tanggal_lahir, tingkat_pendidikan, tahun_pengalaman,
                sertifikat_keahlian, no_registrasi_ska, ijasah_ref, foto_url, jabatan, ktp_url, npwp_url, skk_url } = req.body;
        const { rows } = await db.query(
            `UPDATE personnel SET nama=$1, tempat_lahir=$2, tanggal_lahir=$3, tingkat_pendidikan=$4,
             tahun_pengalaman=$5, sertifikat_keahlian=$6, no_registrasi_ska=$7, ijasah_ref=$8, foto_url=$9,
             jabatan=$10, ktp_url=$11, npwp_url=$12, skk_url=$13
             WHERE id=$14 RETURNING *`,
            [nama, tempat_lahir || null, tanggal_lahir || null, tingkat_pendidikan || null,
             tahun_pengalaman || null, sertifikat_keahlian || null, no_registrasi_ska || null,
             ijasah_ref || null, foto_url || null, jabatan || null, ktp_url || null, npwp_url || null, skk_url || null, req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/personnel/:id
router.delete('/:id', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT foto_url, ktp_url, npwp_url, skk_url FROM personnel WHERE id = $1', [req.params.id]);
        if (rows[0]) {
            const p = rows[0];
            const files = [p.foto_url, p.ktp_url, p.npwp_url, p.skk_url];
            
            // Mengambil semua URL berkas dari riwayat pendidikan, pengalaman, dan SKA
            const [edu, exp, ska] = await Promise.all([
                db.query('SELECT ijazah_url FROM education_history WHERE personnel_id = $1', [req.params.id]),
                db.query('SELECT surat_referensi_url FROM experience_history WHERE personnel_id = $1', [req.params.id]),
                db.query('SELECT file_url FROM personnel_ska WHERE personnel_id = $1', [req.params.id])
            ]);
            
            edu.rows.forEach(r => { if (r.ijazah_url) files.push(r.ijazah_url); });
            exp.rows.forEach(r => { if (r.surat_referensi_url) files.push(r.surat_referensi_url); });
            ska.rows.forEach(r => { if (r.file_url) files.push(r.file_url); });
            
            for (const f of files) {
                if (f) await deleteSupabaseFile(f);
            }
        }

        const { rowCount } = await db.query('DELETE FROM personnel WHERE id = $1', [req.params.id]);
        if (!rowCount) return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
        res.json({ success: true, message: 'Data personil berhasil dihapus' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/personnel/:id/education
router.post('/:id/education', async (req, res) => {
    try {
        const { lembaga, tempat, tahun_tamat, jenjang, jurusan, ijazah_url } = req.body;
        if (!lembaga || !lembaga.trim()) return res.status(400).json({ success: false, error: 'Nama lembaga wajib diisi' });

        const { rows } = await db.query(
            'INSERT INTO education_history (personnel_id, lembaga, tempat, tahun_tamat, jenjang, jurusan, ijazah_url) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
            [req.params.id, lembaga, tempat || null, tahun_tamat || null, jenjang || null, jurusan || null, ijazah_url || null]
        );
        res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/personnel/:id/experience
router.post('/:id/experience', async (req, res) => {
    try {
        const { tahun, nama_kegiatan, lokasi, pengguna_jasa, perusahaan, uraian_tugas, waktu_pelaksanaan, posisi, surat_referensi_url, company_id } = req.body;
        if (!nama_kegiatan || !nama_kegiatan.trim()) return res.status(400).json({ success: false, error: 'Nama kegiatan wajib diisi' });

        const { rows } = await db.query(
            `INSERT INTO experience_history (personnel_id, tahun, nama_kegiatan, lokasi, pengguna_jasa,
             perusahaan, uraian_tugas, waktu_pelaksanaan, posisi, surat_referensi_url, company_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
            [req.params.id, tahun || null, nama_kegiatan, lokasi || null, pengguna_jasa || null,
             perusahaan || null, uraian_tugas || null, waktu_pelaksanaan || null, posisi || null, surat_referensi_url || null, company_id || null]
        );
        res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/personnel/:id/ska
router.post('/:id/ska', async (req, res) => {
    try {
        const { nama_sertifikat, no_registrasi, sub_klasifikasi, berlaku_sampai, file_url } = req.body;
        if (!nama_sertifikat || !nama_sertifikat.trim()) return res.status(400).json({ success: false, error: 'Nama Sertifikat wajib diisi' });

        const { rows } = await db.query(
            `INSERT INTO personnel_ska (personnel_id, nama_sertifikat, no_registrasi, sub_klasifikasi, berlaku_sampai, file_url)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [req.params.id, nama_sertifikat, no_registrasi || null, sub_klasifikasi || null, berlaku_sampai || null, file_url || null]
        );
        res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
