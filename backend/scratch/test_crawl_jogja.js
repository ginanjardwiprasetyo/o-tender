require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../config/db');
const crawler = require('../services/crawler');

async function run() {
    try {
        console.log('Crawling Jogja Kota...');
        await crawler.crawlSingleLPSE(21, 'LPSE Kota Yogyakarta', 2026);
        console.log('Deep scanning missing data...');
        await crawler.deepScanMissingData(2026);
        const { rows } = await db.query("SELECT kode_tender, sbu, batas_upload FROM crawled_tenders WHERE kd_lpse = 21 LIMIT 2");
        console.log('Results:', rows);
    } catch(e) { console.error(e.message); }
    process.exit();
}
run();
