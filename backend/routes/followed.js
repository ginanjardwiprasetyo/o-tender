const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { checkWinLose } = require('../services/eval_scraper');
const { scrapeTender } = require('../services/scraper');

// GET /api/followed — List all followed tenders
router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM followed_tenders ORDER BY followed_at DESC');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/followed/stats
router.get('/stats', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT status FROM followed_tenders');
        const stats = {
            total: rows.length,
            persiapan: rows.filter(t => t.status === 'Diproses').length, // Use Diproses as default active state
            pemasukan: 0,
            evaluasi: 0,
            menang: rows.filter(t => t.status === 'Menang').length,
            kalah: rows.filter(t => t.status === 'Kalah').length,
        };
        res.json({ success: true, data: stats });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/followed/upcoming
router.get('/upcoming', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM followed_tenders WHERE status = $1', ['Diproses']);
        let upcoming = [];
        const now = new Date();
        const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        for (const tender of rows) {
            if (tender.jadwal) {
                const scheduleData = typeof tender.jadwal === 'string' ? JSON.parse(tender.jadwal) : tender.jadwal;
                for (const s of scheduleData) {
                    if (!s.end) continue;
                    const months = { 'januari':0,'februari':1,'maret':2,'april':3,'mei':4,'juni':5,'juli':6,'agustus':7,'september':8,'oktober':9,'november':10,'desember':11 };
                    const m = s.end.match(/(\d{1,2})\s+(\w+)\s+(\d{4})\s+(\d{1,2}):(\d{2})/i);
                    if (m) {
                        const mo = months[m[2].toLowerCase()];
                        if (mo !== undefined) {
                            const endDate = new Date(+m[3], mo, +m[1], +m[4], +m[5]);
                            if (endDate >= now && endDate <= next7Days) {
                                upcoming.push({
                                    stage_name: s.stage,
                                    end_date: endDate.toISOString(),
                                    tenders: {
                                        nama_paket: tender.nama_tender,
                                        instansi: tender.klpd
                                    }
                                });
                            }
                        }
                    }
                }
            }
        }
        
        upcoming.sort((a, b) => new Date(a.end_date) - new Date(b.end_date));
        
        res.json({ success: true, data: upcoming.slice(0, 10) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/followed/check/:kode — Check if a tender is followed
router.get('/check/:kode', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT id FROM followed_tenders WHERE kode_tender = $1 LIMIT 1', [req.params.kode]);
        res.json({ success: true, followed: rows.length > 0 });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const { parsePaguString } = require('../utils/parser');

// POST /api/followed/sync — Update/Sync followed tender data (usually called after live scrape)
router.post('/sync', async (req, res) => {
    try {
        const { kode_tender, deadline, nama_tender, pagu, hps, jadwal } = req.body;
        await db.query(`
            UPDATE followed_tenders 
            SET deadline = $1, nama_tender = $2, pagu = $3, hps = $4, jadwal = $6, updated_at = CURRENT_TIMESTAMP
            WHERE kode_tender = $5
        `, [deadline, nama_tender, parsePaguString(pagu), parsePaguString(hps), kode_tender, jadwal]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/followed/:id — Remove from followed
router.delete('/:id', async (req, res) => {
    try {
        const { rowCount } = await db.query('DELETE FROM followed_tenders WHERE id = $1', [req.params.id]);
        if (!rowCount) return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
        res.json({ success: true, message: 'Berhasil dihapus' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/followed/sync-status — Check win/lose status based on schedules
router.post('/sync-status', async (req, res) => {
    try {
        const { rows: tenders } = await db.query("SELECT * FROM followed_tenders WHERE status = 'Diproses'");
        const { rows: companies } = await db.query("SELECT nama_perusahaan FROM companies");
        const companyNames = companies.map(c => c.nama_perusahaan).filter(Boolean);
        
        let checked = 0;
        let updated = 0;
        const now = new Date();
        
        for (const tender of tenders) {
            // 1. If jadwal is missing, fetch it first
            if (!tender.jadwal) {
                try {
                    console.log(`[Sync] Fetching missing schedule for ${tender.kode_tender}`);
                    const data = await scrapeTender(tender.slug, tender.kode_tender);
                    if (data && data.schedules) {
                        tender.jadwal = data.schedules;
                        await db.query("UPDATE followed_tenders SET jadwal = $1 WHERE id = $2", [JSON.stringify(data.schedules), tender.id]);
                        updated++;
                    }
                } catch (e) {
                    console.error(`[Sync] Failed to fetch schedule for ${tender.kode_tender}:`, e.message);
                }
            }

            if (!tender.jadwal) continue;
            const schedules = typeof tender.jadwal === 'string' ? JSON.parse(tender.jadwal) : tender.jadwal;
            
            // Find Penetapan Pemenang
            const pemenangStage = schedules.find(s => s.stage && s.stage.toLowerCase().includes('penetapan pemenang'));
            
            // If we found the winner stage, check if it's time to check results
            if (pemenangStage && pemenangStage.end) {
                const months = { 'januari':0,'februari':1,'maret':2,'april':3,'mei':4,'juni':5,'juli':6,'agustus':7,'september':8,'oktober':9,'november':10,'desember':11 };
                const m = pemenangStage.end.match(/(\d{1,2})\s+(\w+)\s+(\d{4})\s+(\d{1,2}):(\d{2})/i);
                
                if (m) {
                    const mo = months[m[2].toLowerCase()];
                    if (mo !== undefined) {
                        // +1 hour
                        const endDate = new Date(+m[3], mo, +m[1], +m[4], +m[5]);
                        endDate.setHours(endDate.getHours() + 1);
                        
                        if (now > endDate) {
                            checked++;
                            const result = await checkWinLose(tender.slug, tender.kode_tender, companyNames);
                            if (result.success) {
                                if (result.isMenang) {
                                    await db.query("UPDATE followed_tenders SET status = 'Menang' WHERE id = $1", [tender.id]);
                                    updated++;
                                } else if (result.alasanKalah) {
                                    await db.query("UPDATE followed_tenders SET status = 'Kalah', history_alasan = $1 WHERE id = $2", [result.alasanKalah, tender.id]);
                                    updated++;
                                }
                            }
                        }
                    }
                }
            }
        }
        res.json({ success: true, message: `Checked ${checked} tenders, updated ${updated}.` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
