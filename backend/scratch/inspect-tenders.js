const axios = require('axios');

async function test() {
    const ISB_BASE = 'https://isb.lkpp.go.id/isb-2/api/satudata';
    const tahun = 2026;
    const kd_lpse = 13; 
    
    try {
        const url = `${ISB_BASE}/TenderUmumPublik/${tahun}/${kd_lpse}`;
        const response = await axios.get(url);
        const data = response.data;
        
        data.forEach((t, i) => {
            console.log(`[${i}] ${t['Kategori Pekerjaan']} | ${t['Nama Paket']}`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    }
}

test();
