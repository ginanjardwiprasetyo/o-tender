const axios = require('axios');

async function testInaproc() {
    const slug = 'jogjaprov';
    const url = `https://spse.inaproc.id/${slug}/lelang?kategoriId=2`;
    console.log(`Testing ${url}...`);
    
    try {
        const res = await axios.get(url, { 
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            }
        });
        console.log(`Status: ${res.status}`);
        console.log(`Content length: ${res.data.length}`);
        if (res.data.includes('tbllelang')) {
            console.log('✅ Found tbllelang!');
        } else {
            console.log('❌ No tbllelang found.');
            // Check if it's a redirect or has a different table
            if (res.data.includes('dataTable')) console.log('✅ Found dataTable!');
        }
    } catch (err) {
        console.error(`Error: ${err.message}`);
    }
}

testInaproc();
