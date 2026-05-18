const { scrapeTender } = require('../services/scraper');

async function testDeep() {
    const slug = 'jogjaprov';
    const kode = '10131561000';
    console.log(`Scraping detail for ${slug} ${kode}...`);
    
    try {
        const data = await scrapeTender(slug, kode);
        console.log('Success!');
        console.log('Deadline:', data.uploadDate);
        console.log('SBU:', data.sbu);
        console.log('Details (keys):', Object.keys(data.details).join(', '));
    } catch (err) {
        console.error('Error:', err.message);
    }
}

testDeep();
