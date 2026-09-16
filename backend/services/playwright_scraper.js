const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const args = process.argv.slice(2);
let type = 'list';
let url = '';
let year = '';

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--type') type = args[i + 1];
    if (args[i] === '--url') url = args[i + 1];
    if (args[i] === '--year') year = args[i + 1];
}

function parseCurrency(val) {
    if (!val) return 0;
    let s = String(val).trim().toLowerCase().replace('rp', '').replace(/\./g, '').replace(/,/g, '.').trim();
    const unitMatch = s.match(/([\d\.]+)\s*(t|m|jt|rb)\b/);
    if (unitMatch) {
        let n = parseFloat(unitMatch[1]);
        let u = unitMatch[2];
        if (u === 't') return Math.round(n * 1e12);
        if (u === 'm') return Math.round(n * 1e9);
        if (u === 'jt') return Math.round(n * 1e6);
        if (u === 'rb') return Math.round(n * 1e3);
    }
    const plainMatch = s.match(/([\d\.]+)/);
    if (plainMatch) {
        return Math.round(parseFloat(plainMatch[1])) || 0;
    }
    return 0;
}

function extractSbu(text) {
    if (!text || text === '-') return '-';
    try {
        const { resolveSbu } = require('../utils/kbli-sbu-map');
        const arr = resolveSbu(text);
        return arr.length ? arr.join(', ') : '-';
    } catch {
        const regex = /\b(BG|BS|PL|PB|GT|ST|KP|KK|RK|RE|EL|ME|SP|TI|MK|PR|EE|SE|AR|AL|AT|IT|IN|PA)[\s-]*0*(\d{1,3})\b/gi;
        const codes = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
            const code = match[1].toUpperCase() + match[2].padStart(3, '0');
            if (!codes.includes(code)) codes.push(code);
        }
        return codes.length > 0 ? codes.join(', ') : '-';
    }
}

async function scrape() {
    const browser = await chromium.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-zygote',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-extensions',
            '--disable-sync',
            '--disable-background-networking',
            '--disable-background-timer-throttling',
            '--disable-breakpad',
            '--disable-features=site-per-process',
            '--disable-features=TranslateUI',
            '--disable-default-apps',
            '--disable-component-update',
            '--js-flags=--max-old-space-size=192 --expose-gc --always-compact'
        ]
    });
    
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        if (type === 'list') {
            let interceptData = null;
            
            page.on('response', async response => {
                const resUrl = response.url();
                if (resUrl.includes('dt/lelang') || resUrl.includes('lelang/data')) {
                    try {
                        const json = await response.json();
                        if (json && json.data) {
                            interceptData = json.data;
                        }
                    } catch(e) {}
                }
            });

            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            
            // Wait for intercept or max 15 seconds
            for(let i=0; i<15; i++) {
                if (interceptData) break;
                await page.waitForTimeout(1000);
            }
            
            if (interceptData) {
                const results = [];
                for (let row of interceptData) {
                    if (row.length < 11) continue;
                    // Format JSON from datatable:
                    // 0: Kode Tender
                    // 1: Nama Paket
                    // 2: Instansi
                    // 3: Status
                    // 4: Nilai Pagu
                    // 8: Kategori
                    // 10: Nilai HPS
                    const kode = String(row[0]).trim();
                    let nama = row[1] || '';
                    nama = nama.replace(/<[^>]*>?/gm, '').trim();
                    const instansi = row[2] || '';
                    const status = row[3] || '';
                    const paguRaw = row[4] || '';
                    const hpsRaw = row[10] || paguRaw;
                    
                    results.push({
                        'Kode Tender': kode,
                        'kode_tender': kode,
                        'Nama Paket': nama,
                        'Instansi': instansi,
                        'Pagu': parseCurrency(paguRaw),
                        'HPS': parseCurrency(hpsRaw),
                        'Status_Tender': status,
                        'Kategori Pekerjaan': 'Pekerjaan Konstruksi',
                        'SBU': '-',
                        'Batas Upload': '-'
                    });
                }
                console.log(JSON.stringify(results));
                await browser.close();
                return;
            } else {
                console.log(JSON.stringify([]));
                await browser.close();
                return;
            }

        } else {
            // detail
            // Need to visit homepage first to bypass WAF block
            const urlObj = new URL(url);
            const homeUrl = urlObj.origin + '/' + urlObj.pathname.split('/')[1] + '/lelang';
            await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(()=>{});
            await page.waitForTimeout(2000);
            
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000, referer: homeUrl });
            
            const pageText = await page.innerText('body');
            if (pageText.toLowerCase().includes('akses ditolak') || pageText.toLowerCase().includes('anda tidak diizinkan membuka')) {
                console.log(JSON.stringify({ error: 'Akses Ditolak (Diblokir WAF SPSE)' }));
                await browser.close();
                return;
            }
            
            const data = await page.evaluate(() => {
                let sbu = '';
                let pagu = '';
                let hps = '';
                let nama_paket = '';
                let instansi = '';
                let batas_upload = '';
                let details = {};
                let qualText = '';
                
                const tables = document.querySelectorAll('table');
                tables.forEach(tbl => {
                    tbl.querySelectorAll('tr').forEach(row => {
                        const cells = Array.from(row.querySelectorAll('th, td'));
                        if (!cells.length) return;
                        
                        const pairs = [];
                        if (cells.length === 2) {
                            pairs.push({ label: cells[0].innerText.trim(), value: cells[1].innerText.trim() });
                        } else if (cells.length >= 4) {
                            for (let i = 0; i + 1 < cells.length; i += 2) {
                                pairs.push({ label: cells[i].innerText.trim(), value: cells[i + 1].innerText.trim() });
                            }
                        } else if (cells.length === 3) {
                            pairs.push({ label: cells[0].innerText.trim(), value: cells[2].innerText.trim() });
                        }
                        
                        pairs.forEach(({ label, value }) => {
                            if (label && value && label !== value) details[label] = value;
                            const lbl = label.toLowerCase();
                            if (lbl.includes('sbu') || lbl.includes('sertifikat badan usaha')) sbu = value;
                            else if (lbl.includes('nilai pagu') || lbl === 'pagu') pagu = value;
                            else if (lbl.includes('nilai hps') || lbl === 'hps') hps = value;
                            else if (lbl.includes('nama paket') || lbl.includes('nama tender')) nama_paket = value;
                            else if (lbl.includes('instansi') || lbl.includes('k/l/pd')) instansi = value;
                        });
                    });
                });
                
                // Extract Syarat Kualifikasi from body text
                const bodyText = document.body.innerText;
                const idx = bodyText.indexOf('Syarat Kualifikasi');
                if (idx >= 0) {
                    const section = bodyText.substring(idx + 'Syarat Kualifikasi'.length);
                    const endIdx = section.search(/Peserta Tender|Jumlah Peserta|©/);
                    qualText = (endIdx > 0 ? section.substring(0, endIdx) : section.substring(0, 3000)).trim();
                }
                if (qualText) {
                    details['Syarat Kualifikasi'] = qualText;
                }
                
                return { sbuRaw: sbu, pagu, hps, nama_paket, instansi, batas_upload, details };
            });
            
            // Now fetch Jadwal for the deadline
            const jadwalUrl = url.replace('/pengumumanlelang', '/jadwal');
            await page.goto(jadwalUrl, { waitUntil: 'domcontentloaded', timeout: 30000, referer: url }).catch(()=>{});
            
            const jadwalData = await page.evaluate(() => {
                let batas_upload = '';
                let schedules = [];
                const rows = document.querySelectorAll('tr');
                for (let r of rows) {
                    const cells = r.querySelectorAll('td');
                    if (cells.length >= 4) {
                        const no = cells[0]?.innerText?.trim();
                        if (!no || isNaN(parseInt(no))) continue;
                        const stage = cells[1]?.innerText?.trim() || '';
                        const start = cells[2]?.innerText?.trim() || '';
                        const end = cells[3]?.innerText?.trim() || '';
                        const perubahan = cells[4]?.innerText?.trim() || 'Tidak Ada';
                        schedules.push({ stage, start, end, perubahan });
                        
                        const text = stage.toLowerCase();
                        if (text.includes('upload') && text.includes('penawaran')) {
                            batas_upload = end;
                        }
                    } else {
                        // Try 2-cell layout
                        const text = r.innerText.toLowerCase();
                        if (text.includes('upload') && text.includes('penawaran') && cells.length >= 2) {
                            batas_upload = cells[1]?.innerText?.trim() || '';
                        }
                    }
                }
                // Fallback: body text pattern
                if (!batas_upload) {
                    const bodyText = document.body.innerText;
                    const m = bodyText.match(/(?:Batas\s*(?:Akhir\s+)?Upload|Upload\s+Dokumen\s+Penawaran|Pemasukan\s+Penawaran)[\s:]*([^\n]+)/i);
                    if (m) batas_upload = m[1].trim();
                }
                return { batas_upload, schedules };
            });
            
            data.batas_upload = jadwalData.batas_upload || '';
            data.schedules = jadwalData.schedules || [];
            // KBLI fallback: gabungkan sbuRaw + qualText agar "KBLI 41012" ter-mapping ke BG002
            const sbuSource = [data.sbuRaw, data.details && data.details['Syarat Kualifikasi']].filter(Boolean).join(' ');
            data.sbu = extractSbu(sbuSource || data.sbuRaw);
            data.qualText = data.details && data.details['Syarat Kualifikasi'] ? data.details['Syarat Kualifikasi'] : '';
            delete data.sbuRaw;
            
            console.log(JSON.stringify(data));
        }

    } catch (e) {
        console.log(JSON.stringify({ error: e.message }));
    } finally {
        await browser.close();
    }
}

scrape();
