const axios = require('axios');

async function test() {
    const ISB_BASE = 'https://isb.lkpp.go.id/isb-2/api/satudata';
    const tahun = 2026;
    const kd_lpse = 13; 
    
    try {
        const url = `${ISB_BASE}/TenderUmumPublik/${tahun}/${kd_lpse}`;
        console.log('Fetching:', url);
        const response = await axios.get(url);
        let data = response.data;
        
        if (Array.isArray(data) && data.length > 0) {
            console.log('Keys available:', Object.keys(data[0]));
            console.log('Sample item values for category-related keys:');
            ['Kategori Pekerjaan', 'kategori_pekerjaan', 'Kategori', 'kategori'].forEach(k => {
                console.log(`- ${k}:`, data[0][k]);
            });
        } else {
            console.log('No data returned or not an array');
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}

test();
