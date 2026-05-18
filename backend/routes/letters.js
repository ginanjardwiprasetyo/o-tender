/**
 * Letters Routes — Management of automatic letters and numbering
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Helper: Convert number to Roman
function toRoman(num) {
    const romanMap = {
        1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI',
        7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI', 12: 'XII'
    };
    return romanMap[num] || '';
}

// GET next letter number
// /api/letters/next-number?company_id=123&kode_surat=SK&tahun=2026
router.get('/next-number', async (req, res) => {
    try {
        const { company_id, kode_surat, tahun } = req.query;
        if (!company_id || !kode_surat || !tahun) {
            return res.status(400).json({ success: false, error: 'company_id, kode_surat, and tahun are required' });
        }

        // Get max nomor_urut for the given year, company, and kode_surat
        const { rows: maxRow } = await db.query(
            'SELECT COALESCE(MAX(nomor_urut), 0) as max_urut FROM letters WHERE company_id = $1 AND kode_surat = $2 AND tahun = $3',
            [company_id, kode_surat, parseInt(tahun)]
        );
        
        const nextUrut = parseInt(maxRow[0].max_urut) + 1;
        
        // Fetch company singkatan
        const { rows: compRow } = await db.query('SELECT singkatan FROM companies WHERE id = $1', [company_id]);
        if (compRow.length === 0) {
            return res.status(404).json({ success: false, error: 'Company not found' });
        }
        
        const singkatan = compRow[0].singkatan || 'PERUSAHAAN';
        const romawiBulan = toRoman(new Date().getMonth() + 1); // Current month
        
        // Format: 005/SK/CV.GM/V/2026
        const padUrut = String(nextUrut).padStart(3, '0');
        const generatedFormat = `${padUrut}/${kode_surat}/${singkatan}/${romawiBulan}/${tahun}`;

        res.json({ 
            success: true, 
            data: { 
                nomor_urut: nextUrut, 
                bulan: new Date().getMonth() + 1,
                tahun: parseInt(tahun),
                nomor_surat: generatedFormat 
            } 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET all letters
router.get('/', async (req, res) => {
    try {
        const { company_id, search, tahun } = req.query;
        let query = `
            SELECT l.*, c.nama_perusahaan, c.singkatan 
            FROM letters l
            LEFT JOIN companies c ON l.company_id = c.id
            WHERE 1=1
        `;
        const params = [];
        let pIdx = 1;

        if (company_id) {
            query += ` AND l.company_id = $${pIdx++}`;
            params.push(company_id);
        }
        if (tahun) {
            query += ` AND l.tahun = $${pIdx++}`;
            params.push(tahun);
        }
        if (search) {
            query += ` AND (l.nomor_surat ILIKE $${pIdx} OR l.perihal ILIKE $${pIdx})`;
            params.push(`%${search}%`);
            pIdx++;
        }
        
        query += ' ORDER BY l.created_at DESC';
        const { rows } = await db.query(query, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// CREATE letter
router.post('/', async (req, res) => {
    try {
        const { company_id, nomor_urut, kode_surat, bulan, tahun, nomor_surat, perihal, tanggal, konten, template_id } = req.body;
        
        if (!company_id || !kode_surat || !nomor_surat) {
            return res.status(400).json({ success: false, error: 'company_id, kode_surat, nomor_surat required' });
        }

        const { rows } = await db.query(
            `INSERT INTO letters (company_id, nomor_urut, kode_surat, bulan, tahun, nomor_surat, perihal, tanggal, konten, template_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [company_id, nomor_urut, kode_surat, bulan, tahun, nomor_surat, perihal || '', tanggal || null, konten || '', template_id || null]
        );
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// UPDATE letter
router.put('/:id', async (req, res) => {
    try {
        const { perihal, tanggal, konten } = req.body;
        const { rows } = await db.query(
            `UPDATE letters SET 
                perihal = COALESCE($1, perihal),
                tanggal = COALESCE($2, tanggal),
                konten = COALESCE($3, konten)
             WHERE id = $4 RETURNING *`,
            [perihal, tanggal, konten, req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, error: 'Letter not found' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE letter
router.delete('/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM letters WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
