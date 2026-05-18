require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../config/db');
async function run() {
    try {
        const { rows } = await db.query("SELECT kode_tender, pagu, nama_paket, raw_data FROM crawled_tenders WHERE kode_tender = '10134709000'");
        console.log(JSON.stringify(rows, null, 2));
    } catch(e) { console.error(e.message); }
    process.exit();
}
run();
