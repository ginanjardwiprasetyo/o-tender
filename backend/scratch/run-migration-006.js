
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function run() {
    try {
        const sqlPath = path.join(__dirname, '..', 'migrations', '006_template_enhancements.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('Running migration...');
        await db.runMigration(sql);
        console.log('✅ Migration successful!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

run();
