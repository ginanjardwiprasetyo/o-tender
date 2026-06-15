const axios = require('axios');
const cheerio = require('cheerio');

const slug = 'jogjaprov';
const kode = '10134026000';
const base = `https://spse.inaproc.id/${slug}`;
const url = `${base}/lelang/${kode}/pengumumanlelang`;

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9',
    'Referer': `${base}/lelang?kategoriId=2`,
};

(async () => {
    try {
        console.log(`Fetching ${url}...`);
        const resp = await axios.get(url, { headers, timeout: 15000 });
        console.log(`Status: ${resp.status}`);
        console.log(`Content length: ${resp.data.length}`);
        
        const $ = cheerio.load(resp.data);
        const text = $('body').text().toLowerCase();
        
        if (text.includes('akses ditolak')) {
            console.log('BLOCKED: Akses Ditolak (WAF)');
        } else if (text.includes('sedang dalam pemeliharaan')) {
            console.log('BLOCKED: Maintenance');
        } else if (resp.data.includes('502') || text.includes('502 bad gateway')) {
            console.log('ERROR: 502 Bad Gateway');
        } else {
            console.log('SUCCESS! Page loaded, finding SBU...');
            $('table tr').each((_, row) => {
                const cells = $(row).find('th, td');
                const rowText = cells.map((_, c) => $(c).text().trim()).get().join(' | ');
                if (rowText.toLowerCase().includes('sbu') || rowText.toLowerCase().includes('sertifikat')) {
                    console.log('SBU FOUND:', rowText);
                }
            });
        }
    } catch (err) {
        console.error('Error:', err.message);
        if (err.response) {
            console.log('Status:', err.response.status);
        }
    }
})();
