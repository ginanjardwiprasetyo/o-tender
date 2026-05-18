require('dotenv').config({ path: __dirname + '/../.env' });
const axios = require('axios');

async function run() {
    try {
        const { data } = await axios.get('https://isb.lkpp.go.id/isb-2/api/satudata/TenderUmumPublik/2026/14', { timeout: 10000 });
        if (Array.isArray(data) && data.length > 0) {
            console.log('KEYS in first item:', Object.keys(data[0]).join(', '));
            console.log('\nFirst item sample:');
            const t = data[0];
            console.log('  Kode_Tender:', t.Kode_Tender);
            console.log('  Nama_Paket:', t.Nama_Paket);
            console.log('  Kategori:', t.Kategori);
            console.log('  Metode_Pemilihan:', t.Metode_Pemilihan);
            console.log('  Status_Tender:', t.Status_Tender);
            
            // Check all keys for category-related
            for (const [k, v] of Object.entries(t)) {
                if (typeof v === 'string' && (v.toLowerCase().includes('konstruksi') || v.toLowerCase().includes('barang') || v.toLowerCase().includes('jasa'))) {
                    console.log(`  >> Category-like field: ${k} = "${v}"`);
                }
            }
        }
    } catch(e) {
        console.error(e);
    }
    process.exit();
}
run();
