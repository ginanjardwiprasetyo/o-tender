const axios = require('axios');

async function test() {
    const ISB_BASE = 'https://isb.lkpp.go.id/isb-2/api/satudata';
    const tahun = 2026;
    const kd_lpse = 13; // Kota Yogyakarta
    
    try {
        const url = `${ISB_BASE}/TenderUmumPublik/${tahun}/${kd_lpse}`;
        console.log('Fetching:', url);
        const response = await axios.get(url);
        let data = response.data;
        
        console.log('Raw data type:', typeof data);
        if (typeof data === 'string') {
            console.log('Raw data starts with:', data.substring(0, 100));
        } else {
            console.log('Data length:', Array.isArray(data) ? data.length : 'not an array');
        }

        const filtered = (Array.isArray(data) ? data : []).filter(t => {
            const kategori = (t['Kategori Pekerjaan'] || t.kategori_pekerjaan || '').toLowerCase();
            return kategori.includes('konstruksi');
        });

        console.log('Filtered (Konstruksi) length:', filtered.length);
        if (filtered.length > 0) {
            console.log('First match:', filtered[0]);
        } else if (Array.isArray(data) && data.length > 0) {
            console.log('Available categories:', [...new Set(data.map(t => t['Kategori Pekerjaan'] || t.kategori_pekerjaan))]);
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}

test();
