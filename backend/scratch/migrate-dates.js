require('dotenv').config();
const { Pool } = require('pg');
const { normalizeDate } = require('../utils/date-formatter');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrateDates() {
    console.log('Migrating existing dates to ISO format...');
    const { rows } = await pool.query("SELECT id, batas_upload FROM crawled_tenders WHERE batas_upload IS NOT NULL AND batas_upload != '-'");
    
    let count = 0;
    for (const row of rows) {
        const normalized = normalizeDate(row.batas_upload);
        if (normalized && normalized !== row.batas_upload) {
            await pool.query("UPDATE crawled_tenders SET batas_upload = $1 WHERE id = $2", [normalized, row.id]);
            count++;
        }
    }
    
    console.log(`Updated ${count} records.`);
    process.exit();
}

migrateDates();
