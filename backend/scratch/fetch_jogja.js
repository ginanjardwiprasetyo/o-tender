require('dotenv').config({ path: __dirname + '/../.env' });
const axios = require('axios');

async function run() {
    try {
        const { data } = await axios.get('https://isb.lkpp.go.id/isb-2/api/satudata/TenderUmumPublik/2026/21', { timeout: 10000 });
        console.log('Total tenders in Jogja Kota API:', Array.isArray(data) ? data.length : 0);
        if (Array.isArray(data) && data.length > 0) {
            const konstruksi = data.filter(t => {
                const cat = t['Kategori Pekerjaan'] || '';
                return cat.includes('Konstruksi') || cat.includes('konstruksi');
            });
            console.log('Total Konstruksi:', konstruksi.length);
            if (konstruksi.length > 0) {
                console.log('First Konstruksi:', JSON.stringify(konstruksi[0], null, 2));
            } else {
                console.log('First tender category:', data[0]['Kategori Pekerjaan']);
            }
        }
    } catch(e) { console.error(e.message); }
    process.exit();
}
run();
