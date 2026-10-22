/**
 * RKK Routes — konfigurasi & pratinjau tabel RKK
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const RKK = require('../services/rkk');

/** GET /api/rkk/config — default format tabel + daftar variabel */
router.get('/config', async (req, res) => {
    try {
        const cfg = await RKK.loadSettings(db);
        res.json({
            success: true,
            data: {
                defaults: RKK.DEFAULTS,
                vars: RKK.VARS,
                ambang: cfg.ambang,
                defaultMungkin: cfg.defaultMungkin,
                defaultParah: cfg.defaultParah,
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/** POST /api/rkk/preview — pratinjau tabel (engine sama dgn dokumen) */
router.post('/preview', async (req, res) => {
    try {
        const { tabel, html, baris, mungkin, parah, ambang } = req.body || {};
        const cfg = await RKK.loadSettings(db);
        const opt = {
            jumlahBaris: Number(baris) || 1,
            defaultMungkin: Number(mungkin) || cfg.defaultMungkin,
            defaultParah: Number(parah) || cfg.defaultParah,
            ambang: ambang && Object.keys(ambang).length ? ambang : cfg.ambang,
        };
        // contoh: 1 baris dengan F=3 A=4 → nilai risiko & tingkat terlihat
        const sample = { mungkin_b1: 3, parah_b1: 4, bisa_b1: 3, parah_b1x: 4 };
        let out = '';
        if (tabel === 'b1') out = RKK.renderB1(html || cfg.b1, { ...sample, ...(req.body.vars || {}) }, opt);
        else out = RKK.renderSimple(html || cfg[tabel] || '', req.body.vars || {}, opt);
        res.json({ success: true, data: { html: out } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
