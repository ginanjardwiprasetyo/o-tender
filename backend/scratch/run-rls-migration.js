const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');
const db = require('../config/db');

async function run() {
    const sqlPath = path.join(__dirname, '../migrations/009_enable_rls.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Running migration 009_enable_rls...');
    await db.runMigration(sql);
    console.log('✅ Migration 009 berhasil! RLS enabled + Allow-all policies created.');
    process.exit(0);
}

run().catch(err => {
    console.error('Migration gagal:', err.message);
    process.exit(1);
});
