/**
 * Company Routes
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

const FIELDS = [
    'nama_perusahaan', 'singkatan', 'direktur', 'nik_direktur', 'npwp_usaha', 
    'npwp_direktur', 'kbli', 'no_hp', 'email', 'website', 'alamat', 'kota', 
    'provinsi', 'foto_logo_url', 'ttd_image_url', 'cap_image_url', 'ttd_jabatan',
    'kop_is_image', 'kop_image_url', 'kop_nama', 'kop_alamat', 'kop_kontak', 'attachments'
];

// GET all companies
router.get('/', async (req, res) => {
    try {
        const { search } = req.query;
        let query = 'SELECT * FROM companies';
        const params = [];
        if (search) {
            query += ' WHERE nama_perusahaan ILIKE $1 OR singkatan ILIKE $1 OR direktur ILIKE $1';
            params.push(`%${search}%`);
        }
        query += ' ORDER BY created_at DESC';
        const { rows } = await db.query(query, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET single company
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM companies WHERE id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ success: false, error: 'Company not found' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// CREATE company
router.post('/', async (req, res) => {
    try {
        const { nama_perusahaan } = req.body;
        if (!nama_perusahaan) return res.status(400).json({ success: false, error: 'Nama perusahaan wajib diisi' });

        const cols = FIELDS.filter(f => req.body[f] !== undefined);
        const vals = cols.map(f => {
            const val = req.body[f];
            if (f === 'attachments' && val !== null) {
                return typeof val === 'object' ? JSON.stringify(val) : val;
            }
            return val;
        });
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');

        const { rows } = await db.query(
            `INSERT INTO companies (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
            vals
        );
        res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// UPDATE company
router.put('/:id', async (req, res) => {
    try {
        const cols = FIELDS.filter(f => req.body[f] !== undefined);
        if (!cols.length) return res.status(400).json({ success: false, error: 'Tidak ada data untuk diupdate' });

        const sets = cols.map((f, i) => `${f} = $${i + 1}`).join(', ');
        const vals = cols.map(f => {
            const val = req.body[f];
            if (f === 'attachments' && val !== null) {
                return typeof val === 'object' ? JSON.stringify(val) : val;
            }
            return val;
        });
        vals.push(req.params.id);

        const { rows } = await db.query(
            `UPDATE companies SET ${sets}, updated_at = NOW() WHERE id = $${vals.length} RETURNING *`,
            vals
        );
        if (rows.length === 0) return res.status(404).json({ success: false, error: 'Company not found' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE company
router.delete('/:id', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM companies WHERE id = $1', [req.params.id]);
        if (rows[0]) {
            const c = rows[0];
            const filesToDelete = [
                c.foto_logo_url, c.ttd_image_url, c.cap_image_url, c.kop_image_url
            ];
            
            if (c.attachments) {
                try {
                    const atts = typeof c.attachments === 'string' ? JSON.parse(c.attachments) : c.attachments;
                    if (Array.isArray(atts)) {
                        atts.forEach(a => { if (a.url) filesToDelete.push(a.url); });
                    }
                } catch (e) { console.error('Failed to parse attachments for cleanup:', e.message); }
            }

            for (const f of filesToDelete) {
                if (f) await deleteSupabaseFile(f);
            }
        }

        await db.query('DELETE FROM companies WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
