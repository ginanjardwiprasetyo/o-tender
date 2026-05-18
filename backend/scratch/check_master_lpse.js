const axios = require('axios');
async function run() {
    try {
        const { data } = await axios.get('https://isb.lkpp.go.id/isb-2/api/satudata/MasterLPSE');
        console.log('Sample Master LPSE:', data[0]);
    } catch(e) { console.error(e.message); }
}
run();
