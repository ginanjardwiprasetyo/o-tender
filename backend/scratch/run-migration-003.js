const db = require('../config/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    console.log('Starting migration 003_fix_int_overflow...');
    const sqlPath = path.join(__dirname, '../migrations/003_fix_int_overflow.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    try {
        const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
        for (const stmt of statements) {
            console.log(`Executing: ${stmt.substring(0, 50)}...`);
            await db.query(stmt);
        }
        console.log('✅ Migration successful: INT columns converted to BIGINT');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        process.exit();
    }
}

runMigration();
