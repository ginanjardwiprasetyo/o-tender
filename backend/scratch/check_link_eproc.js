require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../config/db');

async function run() {
    try {
        const { rows } = await db.query("SELECT raw_data FROM crawled_tenders LIMIT 1");
        if (rows.length > 0) {
            console.log('raw_data keys:', Object.keys(rows[0].raw_data));
            console.log('link_eproc exists?', !!rows[0].raw_data.link_eproc);
            console.log('URL or link?', Object.keys(rows[0].raw_data).filter(k => k.toLowerCase().includes('link') || k.toLowerCase().includes('url')));
        }
    } catch(e) { console.error(e.message); }
    process.exit();
}
run();
