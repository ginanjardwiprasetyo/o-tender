require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../config/db');

async function run() {
    try {
        const { rows } = await db.query("SELECT raw_data FROM crawled_tenders WHERE kode_tender = '10129425000'");
        console.log(JSON.stringify(rows[0].raw_data, null, 2));
    } catch(e) { console.error(e.message); }
    process.exit();
}
run();
