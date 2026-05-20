const axios = require('axios');
const db = require('../config/db');

async function sendWhatsAppMessage(to, message) {
    try {
        // Ambil konfigurasi dari database
        const { rows } = await db.query(
            "SELECT key, value FROM settings WHERE key IN ('wa_api_key', 'wa_target_numbers', 'wa_target_group_id')"
        );
        const settings = {};
        rows.forEach(r => {
            if (r.value && r.value.trim()) {
                settings[r.key] = r.value.trim();
            }
        });

        const dbApiKey = settings['wa_api_key'];
        const dbGroupId = settings['wa_target_group_id'];
        const dbNumbers = settings['wa_target_numbers'];

        // Tentukan API Key (Prioritaskan DB, lalu Env)
        const apiKey = dbApiKey || process.env.FONNTE_API_KEY;

        // Tentukan Target Pengiriman
        let target = null;
        if (to) {
            target = to;
        } else {
            // Prioritaskan Group ID DB, lalu nomor tujuan DB, lalu fallback Env
            target = dbGroupId || dbNumbers || process.env.WA_TARGET;
        }

        if (!apiKey || !target) {
            return { success: false, error: 'API Key atau nomor tujuan belum dikonfigurasi.' };
        }

        const data = new URLSearchParams();
        data.append('target', target);
        data.append('message', message);
        data.append('delay', '2');

        const response = await axios.post('https://api.fonnte.com/send', data.toString(), {
            headers: {
                'Authorization': apiKey,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (response.data.status) {
            console.log('[WhatsApp] Pesan berhasil dikirim ke', target);
            await db.query(
                "INSERT INTO wa_logs (target, message, status) VALUES ($1, $2, 'success')"
            , [target, message]).catch(err => console.error('[WhatsApp Log Error]', err.message));
            return { success: true };
        } else {
            console.error('[WhatsApp] Gagal mengirim pesan:', response.data.reason);
            await db.query(
                "INSERT INTO wa_logs (target, message, status, error_message) VALUES ($1, $2, 'failed', $3)"
            , [target, message, response.data.reason || 'Respons Fonnte gagal.']).catch(err => console.error('[WhatsApp Log Error]', err.message));
            return { success: false, error: response.data.reason || 'Respons Fonnte gagal.' };
        }
    } catch (error) {
        console.error('[WhatsApp] Error saat mengirim pesan:', error.message);
        try {
            await db.query(
                "INSERT INTO wa_logs (target, message, status, error_message) VALUES ($1, $2, 'failed', $3)"
            , [target || 'UNKNOWN', message, error.message]);
        } catch (dbErr) {
            console.error('[WhatsApp Log Error]', dbErr.message);
        }
        return { success: false, error: error.message };
    }
}

module.exports = { sendWhatsAppMessage };
