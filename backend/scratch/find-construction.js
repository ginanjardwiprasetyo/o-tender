const axios = require('axios');

async function test() {
    const ISB_BASE = 'https://isb.lkpp.go.id/isb-2/api/satudata';
    const tahun = 2026;
    const kd_lpse = 13; 
    
    try {
        const url = `${ISB_BASE}/TenderUmumPublik/${tahun}/${kd_lpse}`;
        const response = await axios.get(url);
        const data = response.data;
        
        console.log('Total items:', data.length);
        const cats = [...new Set(data.map(t => t['Kategori Pekerjaan']))];
        console.log('Unique categories:', cats);

        const construction = data.filter(t => {
            const k = (t['Kategori Pekerjaan'] || '').toLowerCase();
            return k.includes('konstruksi');
        });

        console.log('Construction count:', construction.length);
        if (construction.length > 0) {
            console.log('Sample Construction:', construction[0]['Nama Paket']);
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}

test();
