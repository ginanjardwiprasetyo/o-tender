const puppeteer = require('puppeteer');

async function scrapeSearch(slug, year) {
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    // User's specific URL
    const url = `https://spse.inaproc.id/${slug}/lelang?kategoriId=2&tahun=${year}&instansiId=&rekanan=&kontrak_status=&kontrak_tipe=`;
    
    console.log('Navigating to:', url);
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    console.log('Waiting for table...');
    try {
        await page.waitForSelector('table', { timeout: 10000 });
    } catch(e) {
        console.log('No table found');
    }

    await new Promise(r => setTimeout(r, 5000)); 

    const data = await page.evaluate(() => {
        const results = [];
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
            const rows = table.querySelectorAll('tr');
            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                if (text.includes('konstruksi') || text.includes('2026')) {
                    results.push(row.innerText.replace(/\n/g, ' | '));
                }
            });
        });
        return {
            html: document.body.innerText.substring(0, 1000),
            results: results
        };
    });

    console.log('Page Text Snapshot:', data.html);
    console.log(`Found ${data.results.length} matching rows`);
    data.results.forEach(r => console.log('ROW:', r));
    
    await browser.close();
}

const slug = process.argv[2] || 'jogjaprov';
const year = process.argv[3] || '2026';
scrapeSearch(slug, year);
