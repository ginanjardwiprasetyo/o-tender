const axios = require('axios');
async function run() {
    try {
        const { data } = await axios.get('https://isb.lkpp.go.id/isb-2/api/satudata/TenderUmumPublik/2025/21');
        if (typeof data === 'string') {
            console.log(data);
        } else {
            console.log('Array length:', data.length);
        }
    } catch(e) { console.error(e.message); }
}
run();
