require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../config/db');

async function run() {
    try {
        const { rows } = await db.query("SELECT kode_tender, pagu, nama_paket, slug FROM crawled_tenders WHERE kode_tender = '10129425000'");
        console.log(rows);
    } catch(e) { console.error(e.message); }
    process.exit();
}
run();
