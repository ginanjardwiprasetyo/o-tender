require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../config/db');

async function run() {
    try {
        const { rows } = await db.query("SELECT * FROM crawled_tenders WHERE kd_lpse = 21");
        console.log('Tenders for Jogja Kota in DB:', rows.length);
        if (rows.length > 0) {
            console.log('Sample:', rows[0].nama_paket);
        }
    } catch(e) { console.error(e.message); }
    process.exit();
}
run();
