const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);
async function run() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto("https://spse.inaproc.id/jogjakota/lelang", {waitUntil: 'domcontentloaded'});
    await page.waitForTimeout(2000);
    
    // Check pengumuman
    await page.goto("https://spse.inaproc.id/jogjakota/lelang/6781021/pengumumanlelang", {waitUntil: 'domcontentloaded', referer: "https://spse.inaproc.id/jogjakota/lelang"});
    await page.waitForTimeout(2000);
    const textPengumuman = await page.evaluate(() => document.body.innerText);
    
    // Check jadwal
    await page.goto("https://spse.inaproc.id/jogjakota/lelang/6781021/jadwal", {waitUntil: 'domcontentloaded', referer: "https://spse.inaproc.id/jogjakota/lelang"});
    await page.waitForTimeout(2000);
    const textJadwal = await page.evaluate(() => document.body.innerText);
    
    console.log("=== PENGUMUMAN ===");
    console.log(textPengumuman.includes('Upload') || textPengumuman.includes('Batas'));
    
    console.log("=== JADWAL ===");
    const lines = textJadwal.split('\n');
    lines.forEach(l => {
        if (l.toLowerCase().includes('upload') || l.toLowerCase().includes('penawaran')) {
            console.log(l.trim());
        }
    });
    
    await browser.close();
}
run();
