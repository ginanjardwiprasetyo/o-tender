require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../config/db');
async function run() {
    try {
        const { rows: tables } = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('Tables:', tables.map(t => t.table_name));
        
        for (const t of ['equipment', 'personnel', 'experiences']) {
            const { rows: cols } = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1", [t]);
            console.log(`Columns for ${t}:`, cols);
        }
    } catch(e) { console.error(e.message); }
    process.exit();
}
run();
