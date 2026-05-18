const { scrapeTender } = require('../services/scraper');
async function run() {
    try {
        const data = await scrapeTender('jogjakota', '10134709000');
        console.log('Scraped data:', JSON.stringify(data, null, 2));
    } catch(e) { console.error(e.message); }
    process.exit();
}
run();
