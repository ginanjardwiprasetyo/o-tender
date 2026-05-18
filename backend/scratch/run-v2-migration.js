require('dotenv').config({ path: __dirname + '/../.env' });
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function run() {
    console.log('Running v2 migration...');
    const sqlPath = path.join(__dirname, '../migrations/002_v2_upgrade.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    try {
        await db.runMigration(sql);
        console.log('Migration successful!');
    } catch (e) {
        console.error('Migration failed:', e);
    }
    process.exit();
}

run();
