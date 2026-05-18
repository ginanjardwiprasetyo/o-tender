const { scrapeTenderList } = require('../services/scraper');
async function run() {
    try {
        const data = await scrapeTenderList('jogjakota', 2026);
        console.log('Tenders found:', data.length);
        if (data.length > 0) {
            console.log(data[0]);
        }
    } catch(e) { console.error(e.message); }
    process.exit();
}
run();
