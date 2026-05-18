require('dotenv').config();
const db = require('../config/db');

async function main() {
    // Test the UPDATE query with explicit types
    // The issue: CASE WHEN $2 IS NOT NULL AND $2 != '-' 
    // batas_upload is VARCHAR, so $2 should be text - but pg can't infer type from NULL
    
    // Test 1: with explicit cast
    try {
        await db.query(`
            UPDATE crawled_tenders 
            SET sbu = $1, 
                batas_upload = CASE WHEN $2::text IS NOT NULL AND $2::text != '-' THEN $2::text ELSE batas_upload END,
                pagu = CASE WHEN $3::numeric > 0 THEN $3::numeric ELSE pagu END,
                hps = CASE WHEN $4::numeric > 0 THEN $4::numeric ELSE hps END
            WHERE kode_tender = $5
        `, ['-', null, null, null, 'TEST-001']);
        console.log('UPDATE with explicit cast and null OK');
    } catch(e) {
        console.error('UPDATE with explicit cast and null ERROR:', e.message);
    }
    
    // Test 2: with string deadline
    try {
        await db.query(`
            UPDATE crawled_tenders 
            SET sbu = $1, 
                batas_upload = CASE WHEN $2::text IS NOT NULL AND $2::text != '-' THEN $2::text ELSE batas_upload END,
                pagu = CASE WHEN $3::numeric > 0 THEN $3::numeric ELSE pagu END,
                hps = CASE WHEN $4::numeric > 0 THEN $4::numeric ELSE hps END
            WHERE kode_tender = $5
        `, ['-', '14 April 2026 10:00', 0, 0, 'TEST-001']);
        console.log('UPDATE with string deadline OK');
    } catch(e) {
        console.error('UPDATE with string deadline ERROR:', e.message);
    }
    
    // Test 3: original query with actual values from scraper
    try {
        await db.query(`
            UPDATE crawled_tenders 
            SET sbu = $1, 
                batas_upload = CASE WHEN $2 IS NOT NULL AND $2 != '-' THEN $2 ELSE batas_upload END,
                pagu = CASE WHEN $3 > 0 THEN $3 ELSE pagu END,
                hps = CASE WHEN $4 > 0 THEN $4 ELSE hps END
            WHERE kode_tender = $5
        `, ['BS004', '14 April 2026 10:00', 0, 0, 'TEST-001']);
        console.log('UPDATE with real values OK');
    } catch(e) {
        console.error('UPDATE with real values ERROR:', e.message);
    }
    
    // Test 4: original query with '-' deadline (from catch block)
    try {
        await db.query(`
            UPDATE crawled_tenders 
            SET sbu = $1, 
                batas_upload = CASE WHEN $2 IS NOT NULL AND $2 != '-' THEN $2 ELSE batas_upload END,
                pagu = CASE WHEN $3 > 0 THEN $3 ELSE pagu END,
                hps = CASE WHEN $4 > 0 THEN $4 ELSE hps END
            WHERE kode_tender = $5
        `, ['-', '-', 0, 0, 'TEST-001']);
        console.log('UPDATE with dash deadline OK');
    } catch(e) {
        console.error('UPDATE with dash deadline ERROR:', e.message);
    }
    
    process.exit(0);
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
