const axios = require('axios');

async function findJateng() {
    const url = 'https://isb.lkpp.go.id/isb-2/api/satudata/MasterLPSE';
    try {
        const response = await axios.get(url, { timeout: 30000 });
        const data = response.data;
        const results = data.filter(l => l.nama_lpse.toLowerCase().includes('jawa tengah'));
        console.log(JSON.stringify(results, null, 2));
    } catch (err) {
        console.error(err.message);
    }
}

findJateng();
