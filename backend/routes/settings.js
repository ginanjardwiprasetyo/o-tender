/**
 * Settings Routes — App configuration management
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/settings
router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT key, value FROM settings');
        const settings = {};
        rows.forEach(r => { settings[r.key] = r.value; });
        
        // Fallback to .env for WA settings if not in DB
        if (!settings.wa_api_key && process.env.FONNTE_API_KEY) {
            settings.wa_api_key = process.env.FONNTE_API_KEY;
        }
        if (!settings.wa_target_numbers && process.env.WA_TARGET) {
            settings.wa_target_numbers = process.env.WA_TARGET;
        }

        res.json({ success: true, data: settings });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/settings
router.put('/', async (req, res) => {
    try {
        const allowedKeys = [
            'company_name', 'company_address', 'company_npwp', 
            'wa_api_key', 'wa_target_numbers', 'wa_target_sbu', 
            'crawl_lpse_targets', 'default_lpse',
            'wa_notif_penjelasan', 'wa_notif_upload', 'wa_notif_pemenang'
        ];
        const entries = Object.entries(req.body).filter(([key]) => allowedKeys.includes(key));
        
        for (const [key, value] of entries) {
            await db.query(
                `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
                 ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
                [key, value]
            );
        }
        res.json({ success: true, message: 'Pengaturan berhasil disimpan' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/settings/wa-groups — Fetch Fonnte WhatsApp Groups dynamically
router.get('/wa-groups', async (req, res) => {
    try {
        const axios = require('axios');
        const apiKey = req.query.apiKey;
        if (!apiKey) {
            return res.status(400).json({ success: false, error: 'API Key Fonnte diperlukan' });
        }

        // Trigger sync group Fonnte
        await axios.post('https://api.fonnte.com/fetch-group', {}, {
            headers: { 'Authorization': apiKey },
            timeout: 5000
        }).catch(err => console.log('[WA Sync Groups Info] Fetch-group skipped/failed:', err.message));

        // Get groups from Fonnte
        const response = await axios.post('https://api.fonnte.com/get-whatsapp-group', {}, {
            headers: { 'Authorization': apiKey },
            timeout: 5000
        });

        if (response.data && response.data.status && Array.isArray(response.data.data)) {
            res.json({ success: true, data: response.data.data });
        } else {
            res.json({ success: true, data: [] });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/settings/test-wa
router.post('/test-wa', async (req, res) => {
    try {
        const { sendWhatsAppMessage } = require('../utils/whatsapp');
        
        // Fetch current settings from db as fallback
        const { rows } = await db.query("SELECT key, value FROM settings WHERE key IN ('wa_api_key', 'wa_target_numbers')");
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);
        
        const apiKey = req.body.wa_api_key || settings['wa_api_key'] || process.env.FONNTE_API_KEY;
        const target = req.body.wa_target_numbers || settings['wa_target_numbers'] || process.env.WA_TARGET;
        
        if (!apiKey || !target) {
            return res.status(400).json({ success: false, error: 'API Key Fonnte atau Nomor Tujuan belum dikonfigurasi!' });
        }

        // Temp override for sendWhatsAppMessage if it relies on env
        const oldApiKey = process.env.FONNTE_API_KEY;
        const oldTarget = process.env.WA_TARGET;
        process.env.FONNTE_API_KEY = apiKey;
        process.env.WA_TARGET = target;

        const result = await sendWhatsAppMessage(target, '🚀 *Uji Coba Integrasi WhatsApp o-Tender*\n\nJika Anda menerima pesan ini, konfigurasi Fonnte Anda sudah berhasil terhubung dengan sistem!');

        // Restore env
        process.env.FONNTE_API_KEY = oldApiKey;
        process.env.WA_TARGET = oldTarget;

        if (result.success) {
            res.json({ success: true, message: 'Pesan uji coba berhasil dikirim!' });
        } else {
            res.status(500).json({ success: false, error: `Gagal mengirim pesan uji coba. Detail: ${result.error}` });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
