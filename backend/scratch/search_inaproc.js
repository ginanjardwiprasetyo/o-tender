const axios = require('axios');

async function searchInaproc(q) {
    const url = `https://inaproc.id/pencarian-lpse?q=${encodeURIComponent(q)}`;
    console.log(`Searching ${url}...`);
    try {
        const res = await axios.get(url, { timeout: 15000 });
        console.log(`Result length: ${res.data.length}`);
        // Look for links that look like lpse URLs
        const regex = /https?:\/\/[a-z0-9.-]+\.go\.id/g;
        const matches = res.data.match(regex);
        console.log('Found URLs:', [...new Set(matches)]);
    } catch (e) {
        console.log('Error:', e.message);
    }
}

searchInaproc('Jawa Tengah');
searchInaproc('Jawa Barat');
