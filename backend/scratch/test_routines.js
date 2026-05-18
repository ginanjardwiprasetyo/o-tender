require('dotenv').config();
const db = require('../config/db');

async function main() {
    // Check routines
    const r = await db.query("SELECT routine_name, routine_type FROM information_schema.routines WHERE routine_schema = 'public'");
    console.log('routines:', JSON.stringify(r.rows));
    
    // Check if there's a view that might cause issues
    const v = await db.query("SELECT table_name FROM information_schema.views WHERE table_schema = 'public'");
    console.log('views:', JSON.stringify(v.rows));
    
    // Check the actual error by running the exact deepScanMissingData query
    // with the exact parameters that would be used in a real crawl
    const targetKds = ['21','13','51','160','42','53','88','115','129','146','285','367','621'];
    const params = [2026];
    params.push(targetKds.map(k => parseInt(k)));
    
    console.log('\nRunning deepScan query...');
    const rows = await db.query(`
        SELECT kode_tender, slug FROM crawled_tenders 
        WHERE tahun_anggaran = $1 AND (sbu IS NULL OR sbu = '-' OR batas_upload IS NULL OR batas_upload = '-')
        AND kd_lpse = ANY($2::int[])
        ORDER BY crawled_at DESC
    `, params);
    console.log('deepScan OK, rows:', rows.rows.length);
    
    // Now test the UPDATE query that deepScanMissingData uses
    // with undefined pagu/hps (from catch block)
    console.log('\nTesting UPDATE with undefined pagu/hps...');
    const res = { sbu: '-', deadline: '-' }; // from catch block
    try {
        await db.query(`
            UPDATE crawled_tenders 
            SET sbu = $1, 
                batas_upload = CASE WHEN $2 IS NOT NULL AND $2 != '-' THEN $2 ELSE batas_upload END,
                pagu = CASE WHEN $3 > 0 THEN $3 ELSE pagu END,
                hps = CASE WHEN $4 > 0 THEN $4 ELSE hps END
            WHERE kode_tender = $5
        `, [res.sbu, res.deadline, res.pagu, res.hps, 'TEST-001']);
        console.log('UPDATE with undefined pagu/hps OK');
    } catch(e) {
        console.error('UPDATE with undefined pagu/hps ERROR:', e.message);
    }
    
    // Test with null pagu/hps
    try {
        await db.query(`
            UPDATE crawled_tenders 
            SET sbu = $1, 
                batas_upload = CASE WHEN $2 IS NOT NULL AND $2 != '-' THEN $2 ELSE batas_upload END,
                pagu = CASE WHEN $3 > 0 THEN $3 ELSE pagu END,
                hps = CASE WHEN $4 > 0 THEN $4 ELSE hps END
            WHERE kode_tender = $5
        `, ['-', '-', null, null, 'TEST-001']);
        console.log('UPDATE with null pagu/hps OK');
    } catch(e) {
        console.error('UPDATE with null pagu/hps ERROR:', e.message);
    }
    
    process.exit(0);
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
