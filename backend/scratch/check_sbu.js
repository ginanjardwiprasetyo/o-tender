require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../config/db');

async function run() {
    try {
        const { rows } = await db.query("SELECT raw_data FROM crawled_tenders LIMIT 1");
        if (rows.length > 0) {
            console.log('Raw Data keys:', Object.keys(rows[0].raw_data).join(', '));
            console.log('\nSample raw_data:', JSON.stringify(rows[0].raw_data, null, 2));
        }
    } catch(e) { console.error(e.message); }
    process.exit();
}
run();
