const { scrapeTender } = require('../services/scraper');
async function run() {
    try {
        const data = await scrapeTender('jogjakota', '10129425000');
        console.log('Scraped Pagu:', data.details['Nilai Pagu Paket']);
        console.log('Scraped HPS:', data.details['Nilai HPS Paket']);
    } catch(e) { console.error(e.message); }
    process.exit();
}
run();
