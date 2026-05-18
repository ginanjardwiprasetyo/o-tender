require('dotenv').config({ path: __dirname + '/../.env' });
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function run() {
    try {
        const sql = fs.readFileSync(path.join(__dirname, '../migrations/003_add_crawled_fields.sql'), 'utf8');
        await db.runMigration(sql);
        console.log('Migration 003 successfully applied.');
    } catch(e) { console.error('Migration failed:', e.message); }
    process.exit();
}
run();
