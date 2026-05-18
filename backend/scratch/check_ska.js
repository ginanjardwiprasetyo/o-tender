require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../config/db');
async function run() {
    try {
        const { rows: cols } = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'personnel_ska'");
        console.log(`Columns for personnel_ska:`, cols);
    } catch(e) { console.error(e.message); }
    process.exit();
}
run();
