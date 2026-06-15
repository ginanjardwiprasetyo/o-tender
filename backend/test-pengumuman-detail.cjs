const axios = require('axios');

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
        const resp = await axios.get(url, { headers, timeout: 15000, responseType: 'text' });
        console.log('Status:', resp.status);
        console.log('Response:', resp.data.substring(0, 1000));
    } catch (err) {
        console.log('Error:', err.message);
        if (err.response) {
            console.log('Status:', err.response.status);
            console.log('Headers:', JSON.stringify(err.response.headers, null, 2));
            console.log('Response body:', err.response.data?.substring?.(0, 2000) || 'N/A');
        }
    }
})();
