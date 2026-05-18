const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

async function run() {
    const url = 'https://spse.inaproc.id/jabarprov/lelang/10103894000/pengumumanlelang';
    try {
        const resp = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            timeout: 10000
        });
        const $ = cheerio.load(resp.data);
        let sbu = '';
        $('table tr').each((_, row) => {
            const cells = $(row).find('td');
            if (cells.length >= 2) {
                const label = $(cells[0]).text().trim().toLowerCase();
                if (label === 'sbu' || label.includes('sertifikat badan usaha')) {
                    sbu = $(cells[cells.length - 1]).text().trim();
                }
            }
        });
        console.log('SBU found:', sbu);
    } catch(e) { console.error(e.message); }
}
run();
