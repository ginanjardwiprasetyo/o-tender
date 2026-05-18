const { scrapeTenderList } = require('../services/scraper');

async function testScrapeList() {
    const slug = 'jogjaprov';
    const year = 2026;
    console.log(`Scraping ${slug} for ${year}...`);
    
    try {
        const results = await scrapeTenderList(slug, year);
        console.log(`Found ${results.length} tenders.`);
        if (results.length > 0) {
            console.log('First 3 results:');
            console.log(JSON.stringify(results.slice(0, 3), null, 2));
        } else {
            console.log('❌ No results found.');
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

testScrapeList();
