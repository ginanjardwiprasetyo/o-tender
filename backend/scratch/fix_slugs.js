require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../config/db');
const { getSlug } = require('../utils/lpse-mapper');

async function run() {
    try {
        const { rows } = await db.query("SELECT DISTINCT kd_lpse, nama_lpse FROM crawled_tenders");
        console.log(`Found ${rows.length} LPSEs to fix slugs for...`);
        let count = 0;
        for (const r of rows) {
            const slug = getSlug(r.kd_lpse, r.nama_lpse);
            const { rowCount } = await db.query(
                "UPDATE crawled_tenders SET slug = $1 WHERE kd_lpse = $2",
                [slug, r.kd_lpse]
            );
            count += rowCount;
        }
        console.log(`Successfully updated slug for ${count} records!`);
    } catch(e) { console.error(e.message); }
    process.exit();
}
run();
