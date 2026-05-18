const axios = require('axios');
const db = require('../config/db');

async function sendWhatsAppMessage(to, message) {
    try {
        let apiKey = process.env.FONNTE_API_KEY;
        let target = to || process.env.WA_TARGET;

        // Fallback to db settings if env is missing
        if (!apiKey || !target) {
            const { rows } = await db.query("SELECT key, value FROM settings WHERE key IN ('wa_api_key', 'wa_target_numbers')");
            const settings = {};
            rows.forEach(r => settings[r.key] = r.value);
            
            apiKey = apiKey || settings['wa_api_key'];
            target = target || settings['wa_target_numbers'];
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
            return { success: true };
        } else {
            console.error('[WhatsApp] Gagal mengirim pesan:', response.data.reason);
            return { success: false, error: response.data.reason || 'Respons Fonnte gagal.' };
        }
    } catch (error) {
        console.error('[WhatsApp] Error saat mengirim pesan:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = { sendWhatsAppMessage };
