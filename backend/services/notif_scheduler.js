/**
 * Notification Scheduler Service
 * Memantau jadwal tahap tender di "Tender Saya" dan mengirimkan notifikasi WA terjadwal.
 */
const db = require('../config/db');
const { sendWhatsAppMessage } = require('../utils/whatsapp');

// Parser tanggal Indonesia yang kokoh
// LPSE dates selalu dalam WIB (UTC+7). Konversi eksplisit agar konsisten di semua server.
function parseIndonesianDate(dateStr) {
    if (!dateStr) return null;
    const months = {
        'januari': 0, 'februari': 1, 'maret': 2, 'april': 3, 'mei': 4, 'juni': 5,
        'juli': 6, 'agustus': 7, 'september': 8, 'oktober': 9, 'november': 10, 'desember': 11,
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'mei': 4, 'jun': 5,
        'jul': 6, 'agu': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'des': 11
    };
    
    // Format: DD Month YYYY HH:mm
    const m = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})\s+(\d{1,2}):(\d{2})/i);
    if (m) {
        const day = parseInt(m[1]);
        const monthName = m[2].toLowerCase();
        const year = parseInt(m[3]);
        const hour = parseInt(m[4]);
        const minute = parseInt(m[5]);
        
        const monthIndex = months[monthName];
        if (monthIndex !== undefined) {
            // Treat as WIB (UTC+7) explicitly
            return new Date(Date.UTC(year, monthIndex, day, hour - 7, minute));
        }
    }
    
    // Format: DD Month YYYY (tanpa jam)
    const m2 = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
    if (m2) {
        const day = parseInt(m2[1]);
        const monthName = m2[2].toLowerCase();
        const year = parseInt(m2[3]);
        const monthIndex = months[monthName];
        if (monthIndex !== undefined) {
            return new Date(Date.UTC(year, monthIndex, day, -7, 0));
        }
    }
    
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
}

async function checkAndSendNotifications() {
    try {
        console.log('⏰ [Scheduler] Memeriksa jadwal notifikasi WhatsApp untuk Tender Saya...');
        
        // 1. Ambil pengaturan notifikasi dari database
        const { rows: settingsRows } = await db.query(
            "SELECT key, value FROM settings WHERE key IN ('wa_notif_penjelasan', 'wa_notif_upload', 'wa_notif_pemenang')"
        );
        const settings = {
            wa_notif_penjelasan: 'true',
            wa_notif_upload: 'true',
            wa_notif_pemenang: 'true'
        };
        settingsRows.forEach(r => settings[r.key] = r.value);
        
        // 2. Ambil semua tender yang berstatus 'Diproses'
        const { rows: tenders } = await db.query(
            "SELECT * FROM followed_tenders WHERE status = 'Diproses'"
        );
        
        if (tenders.length === 0) {
            console.log('⏰ [Scheduler] Tidak ada tender diikuti yang aktif (Diproses).');
            return;
        }
        
        const now = new Date();
        
        for (const tender of tenders) {
            if (!tender.jadwal) continue;
            
            let schedules = [];
            try {
                schedules = typeof tender.jadwal === 'string' ? JSON.parse(tender.jadwal) : tender.jadwal;
            } catch (e) {
                console.error(`⏰ [Scheduler] Gagal parse jadwal tender ${tender.kode_tender}:`, e.message);
                continue;
            }
            
            if (!Array.isArray(schedules)) continue;
            
            for (const s of schedules) {
                if (!s.stage) continue;
                const stageName = s.stage.toLowerCase();
                
                // A. PEMBERIAN PENJELASAN (ANWIJZING) - 30 Menit Sebelum Mulai
                if (settings.wa_notif_penjelasan === 'true' && 
                    !tender.notif_penjelasan_sent && 
                    (stageName.includes('pemberian penjelasan') || stageName.includes('anwijzing')) && 
                    s.start) {
                    
                    const startDate = parseIndonesianDate(s.start);
                    if (startDate) {
                        const diffMinutes = (startDate - now) / (1000 * 60);
                        
                        // Kirim notifikasi jika waktu mulai tinggal 0 s/d 35 menit lagi
                        if (diffMinutes > 0 && diffMinutes <= 35) {
                            console.log(`⏰ [Scheduler] Kirim WA Pemberian Penjelasan untuk Tender: ${tender.kode_tender}`);
                            
                            const msg = `🔔 *JADWAL TENDER: PEMBERIAN PENJELASAN (ANWIJZING)*\n\n` +
                                        `Tender yang Anda ikuti memerlukan kehadiran Anda segera! Tahap Pemberian Penjelasan akan dimulai dalam waktu 30 menit.\n\n` +
                                        `*Detail Tender:*\n` +
                                        `• Kode Tender: ${tender.kode_tender}\n` +
                                        `• Nama Tender: *${tender.nama_tender}*\n` +
                                        `• K/L/PD: ${tender.klpd || '-'}\n` +
                                        `• Jadwal Tahap: ${s.start} s/d ${s.end || '-'}\n\n` +
                                        `Silakan bersiap masuk ke portal LPSE terkait.`;
                                        
                            const res = await sendWhatsAppMessage(null, msg);
                            if (res.success) {
                                await db.query(
                                    "UPDATE followed_tenders SET notif_penjelasan_sent = true WHERE id = $1", 
                                    [tender.id]
                                );
                            }
                        }
                    }
                }
                
                // B. UPLOAD DOKUMEN PENAWARAN - 1 Hari Sebelum Batas Akhir (Deadline) di Jam 8 Pagi
                if (settings.wa_notif_upload === 'true' && 
                    !tender.notif_upload_sent && 
                    (stageName.includes('upload dokumen penawaran') || stageName.includes('upload penawaran') || stageName.includes('pemasukan penawaran')) && 
                    s.end) {
                    
                    const endDate = parseIndonesianDate(s.end);
                    if (endDate) {
                        // 1 Hari sebelum deadline
                        const oneDayBefore = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
                        oneDayBefore.setHours(8, 0, 0, 0); // Target jam 8 pagi
                        
                        if (now >= oneDayBefore && now < endDate) {
                            console.log(`⏰ [Scheduler] Kirim WA Upload Penawaran untuk Tender: ${tender.kode_tender}`);
                            
                            const msg = `⚠️ *PENGINGAT BATAS AKHIR: UPLOAD DOKUMEN PENAWARAN*\n\n` +
                                        `Batas akhir pengunggahan dokumen penawaran untuk tender berikut jatuh pada *BESOK*!\n\n` +
                                        `*Detail Tender:*\n` +
                                        `• Kode Tender: ${tender.kode_tender}\n` +
                                        `• Nama Tender: *${tender.nama_tender}*\n` +
                                        `• K/L/PD: ${tender.klpd || '-'}\n` +
                                        `• Batas Akhir: *${s.end}*\n\n` +
                                        `Pastikan dokumen penawaran Anda telah siap sempurna dan segera lakukan pengunggahan sebelum batas waktu berakhir.`;
                                        
                            const res = await sendWhatsAppMessage(null, msg);
                            if (res.success) {
                                await db.query(
                                    "UPDATE followed_tenders SET notif_upload_sent = true WHERE id = $1", 
                                    [tender.id]
                                );
                            }
                        }
                    }
                }
                
                // C. PENETAPAN PEMENANG - Sesuai Jadwal (Saat Tahap Dimulai)
                if (settings.wa_notif_pemenang === 'true' && 
                    !tender.notif_pemenang_sent && 
                    stageName.includes('penetapan pemenang') && 
                    s.start) {
                    
                    const startDate = parseIndonesianDate(s.start);
                    if (startDate && now >= startDate) {
                        console.log(`⏰ [Scheduler] Kirim WA Penetapan Pemenang untuk Tender: ${tender.kode_tender}`);
                        
                        const msg = `🏆 *JADWAL TENDER: PENETAPAN PEMENANG*\n\n` +
                                    `Tahap Penetapan Pemenang telah dimulai hari ini sesuai dengan jadwal lelang!\n\n` +
                                    `*Detail Tender:*\n` +
                                    `• Kode Tender: ${tender.kode_tender}\n` +
                                    `• Nama Tender: *${tender.nama_tender}*\n` +
                                    `• K/L/PD: ${tender.klpd || '-'}\n` +
                                    `• Jadwal Tahap: ${s.start} s/d ${s.end || '-'}\n\n` +
                                    `Sistem crawler akan segera mengevaluasi hasil pemenang (Menang/Kalah) begitu tahap ini selesai. Tetap pantau dashboard Anda!`;
                                    
                        const res = await sendWhatsAppMessage(null, msg);
                        if (res.success) {
                            await db.query(
                                "UPDATE followed_tenders SET notif_pemenang_sent = true WHERE id = $1", 
                                [tender.id]
                            );
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error('⏰ [Scheduler Error]', err.message);
    }
}

module.exports = { checkAndSendNotifications };
