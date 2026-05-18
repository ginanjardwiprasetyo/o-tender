require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../config/db');
async function run() {
    try {
        console.log('Testing companies...');
        const r1 = await db.query('SELECT COUNT(*) FROM companies');
        console.log('companies count:', r1.rows[0].count);
        
        console.log('Testing crawl_logs...');
        const r2 = await db.query('SELECT COUNT(*) FROM crawl_logs');
        console.log('crawl_logs count:', r2.rows[0].count);
        
        console.log('Testing crawled_tenders...');
        const r3 = await db.query('SELECT COUNT(*) FROM crawled_tenders');
        console.log('crawled_tenders count:', r3.rows[0].count);
        
        console.log('Testing letters...');
        const r4 = await db.query('SELECT COUNT(*) FROM letters');
        console.log('letters count:', r4.rows[0].count);
        
        console.log('Testing personnel_ska...');
        const r5 = await db.query('SELECT COUNT(*) FROM personnel_ska');
        console.log('personnel_ska count:', r5.rows[0].count);
        
        console.log('All tables OK!');
    } catch(e) {
        console.error('ERROR:', e.message);
    }
    process.exit();
}
run();
