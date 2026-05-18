const puppeteer = require('puppeteer');

async function scrapeSearch(slug, year) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const url = `https://spse.inaproc.id/${slug}/lelang?kategoriId=2&tahun=${year}`;
    
    console.log('Navigating to:', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // SPSE tables often take a moment to load via AJAX
    await new Promise(r => setTimeout(r, 5000)); 

    const tenders = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('#dt-paket tbody tr'));
        return rows.map(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 2) return null;
            return {
                kode: cells[0]?.innerText.trim(),
                nama: cells[1]?.querySelector('a')?.innerText.trim(),
                instansi: cells[2]?.innerText.trim(),
                pagu: cells[5]?.innerText.trim(),
                hps: cells[6]?.innerText.trim()
            };
        }).filter(t => t && t.nama);
    });

    console.log(`Found ${tenders.length} tenders`);
    tenders.forEach(t => console.log(`- [${t.kode}] ${t.nama}`));
    
    await browser.close();
}

const slug = process.argv[2] || 'jogjaprov';
const year = process.argv[3] || '2026';
scrapeSearch(slug, year);
