require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../config/db');
async function run() {
    try {
        const { rows } = await db.query(`
            SELECT tablename, rowsecurity 
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);
        console.log('Table RLS status:');
        rows.forEach(r => console.log(`  ${r.tablename}: RLS=${r.rowsecurity}`));
        
        // Check policies
        const { rows: policies } = await db.query(`
            SELECT schemaname, tablename, policyname 
            FROM pg_policies 
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);
        console.log('\nPolicies:');
        policies.forEach(p => console.log(`  ${p.tablename}: ${p.policyname}`));
    } catch(e) {
        console.error(e);
    }
    process.exit();
}
run();
