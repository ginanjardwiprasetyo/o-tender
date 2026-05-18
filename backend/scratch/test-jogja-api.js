const axios = require('axios');

async function testAPI() {
    const url = 'https://isb.lkpp.go.id/isb-2/api/satudata/TenderUmumPublik/2026/13';
    console.log(`Testing API: ${url}`);
    try {
        const resp = await axios.get(url, { timeout: 15000 });
        console.log(`Found ${resp.data.length} records.`);
        if (resp.data.length > 0) {
            console.log('Sample record keys:', Object.keys(resp.data[0]));
            console.log('Sample categories:', [...new Set(resp.data.map(t => t.kategori))]);
        }
    } catch (err) {
        console.error('API Error:', err.message);
    }
}

testAPI();
