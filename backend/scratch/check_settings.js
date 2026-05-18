require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../config/db');

async function run() {
    try {
        const { rows } = await db.query("SELECT * FROM settings LIMIT 1");
        console.log(rows);
    } catch(e) { console.error(e.message); }
    process.exit();
}
run();
