require('dotenv').config({ path: '../.env' });
require('dotenv').config({ path: '.env' });
const axios = require('axios');
const db = require('../config/db');

async function listGroups() {
    try {
        // Fetch API key from DB or Env
        let apiKey = process.env.FONNTE_API_KEY;
        if (!apiKey) {
            const { rows } = await db.query("SELECT value FROM settings WHERE key = 'wa_api_key'");
            if (rows.length > 0) apiKey = rows[0].value;
        }

        if (!apiKey) {
            console.error('❌ API Key Fonnte tidak ditemukan di .env maupun database! Harap atur di halaman Pengaturan terlebih dahulu.');
            process.exit(1);
        }

        console.log('🔄 Menghubungkan ke Fonnte untuk mensinkronisasi daftar grup WhatsApp...');
        
        // Step 1: Sync groups
        await axios.post('https://api.fonnte.com/fetch-group', {}, {
            headers: { 'Authorization': apiKey }
        });
        
        console.log('⏳ Sinkronisasi selesai. Mengambil daftar grup...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // wait a bit

        // Step 2: Fetch groups
        const response = await axios.post('https://api.fonnte.com/get-whatsapp-group', {}, {
            headers: { 'Authorization': apiKey }
        });

        const groups = response.data && response.data.data;
        if (response.data && response.data.status && Array.isArray(groups)) {
            console.log('\n✅ DAFTAR GRUP WHATSAPP ANDA:');
            console.log('========================================================================');
            groups.forEach((group, index) => {
                console.log(`${index + 1}. Nama Grup : ${group.name}`);
                console.log(`   Group ID  : ${group.id}`);
                console.log('------------------------------------------------------------------------');
            });
            console.log('\n💡 TIPS: Salin "Group ID" (contoh: 120363023948572635@g.us) di atas');
            console.log('   lalu tempelkan ke kolom "Nomor Tujuan" pada halaman Pengaturan o-Tender.');
        } else {
            console.log('\n⚠️ Tidak ada grup yang ditemukan atau respons Fonnte salah:', response.data);
        }
        process.exit(0);
    } catch (e) {
        console.error('❌ Gagal mengambil daftar grup:', e.response ? e.response.data : e.message);
        process.exit(1);
    }
}

listGroups();
