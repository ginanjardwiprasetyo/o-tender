const axios = require('axios');

async function test() {
    try {
        const url = 'https://isb.lkpp.go.id/isb-2/api/satudata/TenderUmumPublik/2026/14'; // LPSE Jabar
        console.log(`Fetching ${url}`);
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'TenderBuild/1.0' }
        });
        console.log(`Got ${data.length} records. Sample:`);
        console.log(JSON.stringify(data[0], null, 2));
    } catch (e) {
        console.error('Error:', e.message);
        if (e.response) console.error(e.response.data);
    }
}
test();
