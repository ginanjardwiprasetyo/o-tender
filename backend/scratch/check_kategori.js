require('dotenv').config({ path: __dirname + '/../.env' });
const axios = require('axios');

async function run() {
    try {
        // Pick a few LPSEs known to have construction tenders
        const lpses = [14, 182, 5, 60]; // Jabar, Yogya, DKI, Jateng
        const year = 2026;
        const categories = {};
        
        for (const kd of lpses) {
            try {
                const { data } = await axios.get(`https://isb.lkpp.go.id/isb-2/api/satudata/TenderUmumPublik/${year}/${kd}`, { timeout: 10000 });
                if (Array.isArray(data)) {
                    data.forEach(t => {
                        const cat = t.Kategori || t.kategori || 'UNKNOWN';
                        categories[cat] = (categories[cat] || 0) + 1;
                    });
                }
            } catch(e) { console.log(`LPSE ${kd} error:`, e.message); }
        }
        
        console.log('Categories found:');
        Object.entries(categories).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  "${k}": ${v}`));
    } catch(e) {
        console.error(e);
    }
    process.exit();
}
run();
