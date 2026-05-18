require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../config/db');
async function run() {
    try {
        for (const t of ['equipments', 'experience_history']) {
            const { rows: cols } = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1", [t]);
            console.log(`Columns for ${t}:`, cols);
        }
    } catch(e) { console.error(e.message); }
    process.exit();
}
run();
