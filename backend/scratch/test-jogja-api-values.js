const axios = require('axios');

async function testAPI() {
    const url = 'https://isb.lkpp.go.id/isb-2/api/satudata/TenderUmumPublik/2026/13';
    try {
        const resp = await axios.get(url, { timeout: 15000 });
        console.log(`Found ${resp.data.length} records.`);
        resp.data.forEach(t => {
            console.log(`- ${t['Nama Paket']} | Cat: ${t['Kategori Pekerjaan']}`);
        });
    } catch (err) {
        console.error('API Error:', err.message);
    }
}

testAPI();
