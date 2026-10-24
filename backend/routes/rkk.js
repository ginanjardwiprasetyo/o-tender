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

const escPreview = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** POST /api/rkk/preview — pratinjau tabel (engine sama dgn dokumen) */
router.post('/preview', async (req, res) => {
    try {
        const { tabel, html, baris, mungkin, parah, ambang } = req.body || {};
        const vars = req.body.vars || {};
        const cfg = await RKK.loadSettings(db);
        const opt = {
            jumlahBaris: Number(baris) || 1,
            defaultMungkin: Number(mungkin) || cfg.defaultMungkin,
            defaultParah: Number(parah) || cfg.defaultParah,
            ambang: ambang && Object.keys(ambang).length ? ambang : cfg.ambang,
        };
        let out = '';
        if (tabel === 'b1') out = RKK.renderB1(html || cfg.b1, vars, opt);
        else if (tabel === 'e1') out = (html || cfg.e1 || '');   // E1 template sudah konkret → verbatim
        else out = RKK.renderSimple(html || cfg[tabel] || '', vars, opt);
        // generic substitution — sama dgn docbuilder (baris 469) agar preview terisi penuh
        // 2 pass: nilai yg di-insert bisa membawa placeholder bersarang ({{posisi_k3}} di dalam {{pjD2}})
        for (let pass = 0; pass < 2; pass++) {
            Object.keys(vars).forEach(k => {
                if (typeof vars[k] === 'string' || typeof vars[k] === 'number')
                    out = out.replace(new RegExp(`\\{\\{ ?${k} ?\\}\\}`, 'g'), escPreview(vars[k]));
            });
        }
        // sisa {{var}} yang tak dikenal → titik (tanda perlu diisi)
        out = out.replace(/\{\{[^}]+\}\}/g, '.........');
        res.json({ success: true, data: { html: out } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
