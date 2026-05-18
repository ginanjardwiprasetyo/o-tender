/**
 * Check Supabase connection and try to run migration
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];

function httpsGet(url, headers) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers
        };
        const req = https.request(options, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        req.end();
    });
}

async function main() {
    console.log(`Project: ${projectRef}`);
    console.log(`URL: ${SUPABASE_URL}\n`);

    // Test REST API
    const r = await httpsGet(`${SUPABASE_URL}/rest/v1/settings?select=key&limit=1`, {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
    });
    
    console.log(`REST API Status: ${r.status}`);
    console.log(`Response: ${r.body.substring(0, 300)}`);
    
    if (r.status === 200) {
        console.log('\n✅ Database sudah siap!');
    } else if (r.body.includes('schema cache') || r.body.includes('does not exist')) {
        console.log('\n❌ Tabel belum dibuat. Perlu jalankan migration.');
        console.log('\nBuka URL ini dan paste isi file backend/migrations/001_init.sql:');
        console.log(`https://supabase.com/dashboard/project/${projectRef}/sql/new`);
    } else {
        console.log('\n⚠️  Status tidak dikenal');
    }
}

main().catch(console.error);
