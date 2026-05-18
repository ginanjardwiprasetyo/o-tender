require('dotenv').config({ path: __dirname + '/../.env' });
const axios = require('axios');

async function run() {
    try {
        const { data: lpseList } = await axios.get('https://isb.lkpp.go.id/isb-2/api/satudata/MasterLPSE', { timeout: 10000 });
        const matches = lpseList.filter(l => l.nama_lpse.toLowerCase().includes('yogyakarta'));
        console.log('Matches Yogya:', matches);
    } catch(e) { console.error(e.message); }
    process.exit();
}
run();
