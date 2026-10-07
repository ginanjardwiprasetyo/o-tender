// Dump tabel peserta dari laman hasil, tandai baris yang match dengan perusahaan kita
require('dotenv').config({ path: '.env' });
const cheerio = require('cheerio');
const axios = require('axios');
const { getBaseUrl } = require('../utils/lpse-mapper');
const { matchCompany } = require('../services/eval_scraper');
const CO = ['CV Utama Graha Mandiri', 'CV Natamarga', 'CV Garrel Multi Perkasa'];

const list = [
    ['jogjakota', '10136834000'], ['banjarnegarakab', '10150268000'], ['jogjakota', '10155949000'],
    ['jogjaprov', '10141458000'], ['gunungkidulkab', '10140152000'], ['karanganyarkab', '10140647000'],
    ['karanganyarkab', '10139745000'], ['banjarnegarakab', '10139649000'], ['jogjaprov', '10128144000'],
    ['slemankab', '10166213000'],
];

(async () => {
    for (const [slug, kode] of list) {
        const base = getBaseUrl(slug);
        try {
            const r = await axios.get(`${base}/evaluasi/${kode}/hasil`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 'Referer': `${base}/lelang` },
                timeout: 15000
            });
            const $ = cheerio.load(r.data);
            const kita = [];
            $('table tr').each((_, row) => {
                const cells = $(row).find('td');
                if (cells.length < 2) return;
                const nama = $(cells[1]).text().trim();
                if (!nama || !matchCompany(nama, CO)) return;
                const last = $(cells[cells.length - 1]).text().trim();
                kita.push(`${nama} || alasan=${last.slice(0, 70)}`);
            });
            console.log(`${kode}: ${kita.length} baris [KITA]`);
            kita.forEach(x => console.log('   ' + x));
        } catch (e) { console.log(`${kode} ERROR: ${e.message}`); }
    }
    process.exit(0);
})();
