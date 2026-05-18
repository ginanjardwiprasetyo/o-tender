require('dotenv').config({ path: __dirname + '/../.env' });
const crawler = require('../services/crawler');
const db = require('../config/db');

async function run() {
    try {
        console.log('Testing crawlSingleLPSE for LPSE 14 (Jawa Barat)...');
        await crawler.crawlSingleLPSE(14, 'Provinsi Jawa Barat', 2026);
        
        console.log('Crawler Status:', crawler.status);
        
        const { rows } = await db.query('SELECT COUNT(*) FROM crawled_tenders WHERE kd_lpse = 14');
        console.log('Tenders saved in DB for LPSE 14:', rows[0].count);
        
    } catch(e) {
        console.error(e);
    }
    process.exit();
}
run();
