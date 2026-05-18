require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../config/db');
async function run() {
    try {
        console.log('Migrating equipments...');
        await db.query("ALTER TABLE equipments ADD COLUMN IF NOT EXISTS file_url TEXT");
        
        console.log('Migrating personnel...');
        await db.query("ALTER TABLE personnel ADD COLUMN IF NOT EXISTS skk_url TEXT");
        
        console.log('Migration completed.');
    } catch(e) { console.error('Migration failed:', e.message); }
    process.exit();
}
run();
