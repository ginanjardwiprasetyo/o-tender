const axios = require('axios');
const db = require('../config/db');
const supabase = require('../config/supabase');

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
                "INSERT INTO wa_logs (target, message, status, api_response) VALUES ($1, $2, 'success', $3)"
            , [target, message, JSON.stringify(response.data)]).catch(err => console.error('[WhatsApp Log Error]', err.message));
            return { success: true };
        } else {
            console.error('[WhatsApp] Gagal mengirim pesan:', response.data.reason);
            await db.query(
                "INSERT INTO wa_logs (target, message, status, error_message, api_response) VALUES ($1, $2, 'failed', $3, $4)"
            , [target, message, response.data.reason || 'Respons Fonnte gagal.', JSON.stringify(response.data)]).catch(err => console.error('[WhatsApp Log Error]', err.message));
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

async function sendWhatsAppFile(buffer, filename, to, message, mimeType = 'application/pdf') {
    let target = to || 'UNKNOWN';
    try {
        const { rows } = await db.query(
            "SELECT key, value FROM settings WHERE key IN ('wa_api_key', 'wa_target_numbers', 'wa_target_group_id')"
        );
        const settings = {};
        rows.forEach(r => {
            if (r.value && r.value.trim()) settings[r.key] = r.value.trim();
        });

        const apiKey = settings['wa_api_key'] || process.env.FONNTE_API_KEY;
        let target = to || settings['wa_target_group_id'] || settings['wa_target_numbers'] || process.env.WA_TARGET;

        if (!apiKey || !target) {
            return { success: false, error: 'API Key atau tujuan belum dikonfigurasi.' };
        }

        // Upload ke Supabase → URL lewat domain sendiri (Netlify proxy /uploads/* → Supabase)
        let publicUrl = null;
        try {
            // path "dokumen/" — jangan pakai "sirup/" (di-block 404 di Netlify)
            const path = `dokumen/${Date.now()}-${filename.replace(/[^\w.\-]/g, '_')}`;
            const { error: upErr } = await supabase.storage
                .from('uploads')
                .upload(path, buffer, { contentType: mimeType, upsert: true });
            if (!upErr) {
                publicUrl = `https://tender.rekayasa-sipil.my.id/uploads/${path}`;
            }
        } catch (e) {
            console.error('[WhatsApp] Upload Supabase gagal:', e.message);
        }

        // caption + link unduh (tetap terkirim di paket text-only)
        const caption = (message || 'Dokumen RUP') + (publicUrl ? `\n\n📎 Unduh: ${publicUrl}` : '');

        // Kirim ke tiap target (boleh dipisah koma: grup, grup, nomor)
        const targets = String(target).split(',').map(t => t.trim()).filter(Boolean);
        const results = [];
        for (const t of targets) {
            const fd = new FormData();
            fd.append('target', t);
            fd.append('message', caption);
            fd.append('delay', '2');
            fd.append('filename', filename);
            // file binary — hanya jalan di paket Super/Advanced/Ultra.
            // url param Fonnte sering tolak URL S3-style, jadi link unduh cukup di caption.
            fd.append('file', new Blob([buffer], { type: mimeType }), filename);

            const response = await fetch('https://api.fonnte.com/send', {
                method: 'POST',
                headers: { 'Authorization': apiKey },
                body: fd,
            });
            const data = await response.json();

            if (data.status) {
                console.log('[WhatsApp] Kirim ke', t, filename, 'url=', !!publicUrl, data.detail || '');
                await db.query(
                    "INSERT INTO wa_logs (target, message, status, api_response) VALUES ($1, $2, 'success', $3)",
                    [t, caption + (publicUrl ? ` [file:${filename}]` : ''), JSON.stringify(data)]
                ).catch(err => console.error('[WhatsApp Log Error]', err.message));
                results.push({ target: t, success: true, publicUrl });
            } else {
                console.error('[WhatsApp] Gagal kirim file ke', t, data.reason);
                await db.query(
                    "INSERT INTO wa_logs (target, message, status, error_message, api_response) VALUES ($1, $2, 'failed', $3, $4)",
                    [t, caption, data.reason || 'Respons Fonnte gagal.', JSON.stringify(data)]
                ).catch(err => console.error('[WhatsApp Log Error]', err.message));
                results.push({ target: t, success: false, error: data.reason });
            }
        }

        const ok = results.some(r => r.success);
        return ok
            ? { success: true, results }
            : { success: false, error: results[0]?.error || 'Gagal mengirim file.', results };
    } catch (error) {
        console.error('[WhatsApp] Error kirim file:', error.message);
        try {
            await db.query(
                "INSERT INTO wa_logs (target, message, status, error_message) VALUES ($1, $2, 'failed', $3)",
                [target, filename, error.message]
            );
        } catch (dbErr) {
            console.error('[WhatsApp Log Error]', dbErr.message);
        }
        return { success: false, error: error.message };
    }
}

module.exports = { sendWhatsAppMessage, sendWhatsAppFile };
