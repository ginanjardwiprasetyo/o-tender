const axios = require('axios');
const { getSlug } = require('../utils/lpse-mapper');

async function testJogja() {
    const slug = 'jogjaprov';
    const year = 2026;
    const url = `https://lpse.${slug}.go.id/eproc4/lelang`;
    console.log(`Testing ${slug} at ${url}...`);
    
    try {
        // Try to reach the site
        const res = await axios.get(url, { timeout: 10000 });
        console.log(`Status: ${res.status}`);
        console.log(`Content length: ${res.data.length}`);
        
        // Try searching
        const searchUrl = `https://lpse.${slug}.go.id/eproc4/dt/lelang?draw=1&columns%5B0%5D%5Bdata%5D=0&columns%5B0%5D%5Bname%5D=&columns%5B0%5D%5Bsearchable%5D=true&columns%5B0%5D%5Borderable%5D=true&columns%5B0%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B1%5D%5Bdata%5D=1&columns%5B1%5D%5Bname%5D=&columns%5B1%5D%5Bsearchable%5D=true&columns%5B1%5D%5Borderable%5D=true&columns%5B1%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B2%5D%5Bdata%5D=2&columns%5B2%5D%5Bname%5D=&columns%5B2%5D%5Bsearchable%5D=true&columns%5B2%5D%5Borderable%)=true&columns%5B2%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B3%5D%5Bdata%5D=3&columns%5B3%5D%5Bname%5D=&columns%5B3%5D%5Bsearchable%5D=true&columns%5B3%5D%5Borderable%5D=true&columns%5B3%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B4%5D%5Bdata%5D=4&columns%5B4%5D%5Bname%5D=&columns%5B4%5D%5Bsearchable%5D=true&columns%5B4%5D%5Borderable%5D=true&columns%5B4%5D%5Bsearch%5D%5Bvalue%5D=&order%5B0%5D%5Bcolumn%5D=0&order%5B0%5D%5Bdir%5D=asc&start=0&length=10&search%5Bvalue%5D=Konstruksi&_=${Date.now()}`;
        
        console.log(`Searching with keyword 'Konstruksi'...`);
        const searchRes = await axios.get(searchUrl, { timeout: 10000 });
        console.log(`Search result:`, JSON.stringify(searchRes.data).substring(0, 500));
        
    } catch (err) {
        console.error(`Error: ${err.message}`);
        if (err.response) {
            console.error(`Status: ${err.response.status}`);
        }
    }
}

testJogja();
