const puppeteer = require('puppeteer');
const { getBaseUrl } = require('../utils/lpse-mapper');

/**
 * Launch browser with anti-detection settings
 */
async function launchBrowser() {
    return puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1366,768',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            // Ultra-low memory optimizations for 512MB RAM environment
            '--single-process',
            '--no-zygote',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-extensions',
            '--no-first-run',
            '--js-flags=--max-old-space-size=128'
        ],
    });
}

/**
 * Setup a page with anti-bot settings
 */
async function setupPage(browser) {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        window.chrome = { runtime: {} };
    });
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    return page;
}

/**
 * Helper to wait for Cloudflare challenge if detected
 */
async function handleCloudflare(page) {
    const title = await page.title();
    if (title.includes('Just a moment') || title.includes('Cloudflare')) {
        console.log('[Scraper] Detected Cloudflare challenge, waiting 15s...');
        await new Promise(r => setTimeout(r, 15000));
        return true;
    }
    return false;
}

/**
 * Scrape Tender Detail from SPSE
 *
 * Strategy: visit the list page first to establish a valid session/referrer,
 * then navigate to pengumumanlelang and jadwal with domcontentloaded.
 */
async function scrapeTender(slug, kode) {
    const base = getBaseUrl(slug);
    const listUrl       = `${base}/lelang?kategoriId=2`;
    const pengumumanUrl = `${base}/lelang/${kode}/pengumumanlelang`;
    const jadwalUrl     = `${base}/lelang/${kode}/jadwal`;

    let browser;
    try {
        browser = await launchBrowser();
        const page = await setupPage(browser);

        // Step 1: Visit list page to get session cookies
        console.log(`[Scraper] Warming session via: ${listUrl}`);
        await page.goto(listUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await handleCloudflare(page);
        await new Promise(r => setTimeout(r, 2000));

        // Step 2: Scrape pengumuman (set referer to list page)
        console.log(`[Scraper] Scraping pengumuman: ${pengumumanUrl}`);
        await page.setExtraHTTPHeaders({ 'Referer': listUrl });
        
        let attempts = 0;
        let success = false;
        while (attempts < 2 && !success) {
            try {
                await page.goto(pengumumanUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await new Promise(r => setTimeout(r, 4000));
                
                // Check if page actually loaded content (look for tables)
                const hasTable = await page.evaluate(() => document.querySelectorAll('table tr').length > 5);
                if (hasTable) {
                    success = true;
                } else {
                    console.log(`[Scraper] Attempt ${attempts + 1}: No table found, retrying...`);
                    attempts++;
                    await new Promise(r => setTimeout(r, 3000));
                }
            } catch (e) {
                console.log(`[Scraper] Attempt ${attempts + 1} failed: ${e.message}`);
                attempts++;
            }
        }

        if (!success) throw new Error("Gagal memuat halaman pengumuman (Timeout atau Terblokir)");

        const pengumumanData = await page.evaluate(() => {
            const data = {};

            // Extract all table rows as key-value pairs
            // Handle multi-cell rows (e.g. Pagu | value | HPS | value in same row)
            document.querySelectorAll('table tr').forEach(row => {
                const cells = Array.from(row.querySelectorAll('th, td'));
                if (cells.length === 0) return;

                if (cells.length === 2) {
                    const label = cells[0].innerText.trim();
                    const value = cells[1].innerText.trim();
                    if (label && value && label !== value) data[label] = value;
                } else if (cells.length >= 4) {
                    // Multi-pair row: [label1, val1, label2, val2, ...]
                    for (let i = 0; i + 1 < cells.length; i += 2) {
                        const label = cells[i].innerText.trim();
                        const value = cells[i + 1].innerText.trim();
                        if (label && value && label !== value) data[label] = value;
                    }
                } else if (cells.length === 3) {
                    // [label, val, val] or [label, label, val]
                    const label = cells[0].innerText.trim();
                    const value = cells[2].innerText.trim();
                    if (label && value && label !== value) data[label] = value;
                }
            });

            // Extract SBU specifically — it's a table row with label "SBU"
            // The table inside Syarat Kualifikasi has rows like: [izin usaha | ...] [SBU | BG004...]
            let sbu = '';
            document.querySelectorAll('table tr').forEach(row => {
                const cells = Array.from(row.querySelectorAll('td'));
                if (cells.length >= 2) {
                    const label = cells[0].innerText.trim().toLowerCase();
                    if (label === 'sbu' || label.includes('sertifikat badan usaha')) {
                        sbu = cells[cells.length - 1].innerText.trim();
                    }
                }
            });

            // Also try th-based SBU row
            if (!sbu) {
                document.querySelectorAll('table tr').forEach(row => {
                    const th = row.querySelector('th');
                    const td = row.querySelector('td');
                    if (th && td) {
                        const label = th.innerText.trim().toLowerCase();
                        if (label === 'sbu' || label.includes('sertifikat badan usaha')) {
                            sbu = td.innerText.trim();
                        }
                    }
                });
            }

            // Extract full Syarat Kualifikasi text block
            // Find the row that contains "Syarat Kualifikasi" as a label
            let qualText = '';
            document.querySelectorAll('table tr').forEach(row => {
                const firstCell = row.querySelector('th, td:first-child');
                if (firstCell && firstCell.innerText.trim() === 'Syarat Kualifikasi') {
                    const valueCell = row.querySelector('td:last-child');
                    if (valueCell) qualText = valueCell.innerText.trim();
                }
            });

            // If not found via table, try body text extraction
            if (!qualText) {
                const bodyText = document.body.innerText;
                const idx = bodyText.indexOf('Syarat Kualifikasi');
                if (idx >= 0) {
                    // Take text from after "Syarat Kualifikasi" until "Peserta Tender" or end
                    const section = bodyText.substring(idx + 'Syarat Kualifikasi'.length);
                    const endIdx = section.search(/Peserta Tender|Jumlah Peserta|©/);
                    qualText = (endIdx > 0 ? section.substring(0, endIdx) : section.substring(0, 3000)).trim();
                }
            }

            return { details: data, sbu, qualText };
        });

        // Step 3: Scrape jadwal (set referer to pengumuman page)
        console.log(`[Scraper] Scraping jadwal: ${jadwalUrl}`);
        await page.setExtraHTTPHeaders({ 'Referer': pengumumanUrl });
        await page.goto(jadwalUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await new Promise(r => setTimeout(r, 3000));

        const scheduleData = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('table tr')).slice(1); // skip header
            return rows.map(row => {
                const cols = row.querySelectorAll('td');
                if (cols.length < 4) return null;
                return {
                    no:       cols[0]?.innerText?.trim(),
                    stage:    cols[1]?.innerText?.trim(),
                    start:    cols[2]?.innerText?.trim(),
                    end:      cols[3]?.innerText?.trim(),
                    perubahan: cols[4]?.innerText?.trim() || ''
                };
            }).filter(i => i && i.stage);
        });

        // Find upload deadline
        const uploadStage = scheduleData.find(s =>
            s.stage.toLowerCase().includes('upload dokumen penawaran') ||
            s.stage.toLowerCase().includes('pemasukan penawaran') ||
            s.stage.toLowerCase().includes('upload dokumen')
        );
        const uploadDate = uploadStage ? uploadStage.end : '-';

        // Merge qualText into details
        if (pengumumanData.qualText) {
            pengumumanData.details['Syarat Kualifikasi'] = pengumumanData.qualText;
        }

        return {
            details: pengumumanData.details,
            sbu: extractSbuCodes(pengumumanData.sbu) || pengumumanData.sbu || '-',
            kbli: extractKbliCodes(pengumumanData.qualText || '') || '-',
            schedules: scheduleData,
            uploadDate,
            pengumumanUrl,
            jadwalUrl
        };

    } catch (err) {
        console.error('[Scraper] Error:', err.message);
        throw new Error(`Gagal mengambil data dari SPSE: ${err.message}`);
    } finally {
        if (browser) await browser.close();
    }
}

/**
 * Scrape Tender List from SPSE Search Page — uses axios+cheerio (fast, no browser)
 * Falls back to Puppeteer if axios is blocked.
 */
async function scrapeTenderList(slug, year) {
    const base = getBaseUrl(slug);
    const url = `${base}/lelang?kategoriId=2&tahun=${year}&instansiId=&rekanan=&kontrak_status=&kontrak_tipe=`;
    const yearStr = String(year);

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
        'Referer': `${base}/lelang`,
    };

    try {
        const axios = require('axios');
        const cheerio = require('cheerio');

        console.log(`[Scraper] Fast-fetch list: ${url}`);
        const resp = await axios.get(url, { headers, timeout: 20000 });
        const $ = cheerio.load(resp.data);

        const results = [];
        const table = $('#tbllelang, table.dataTable').first();
        if (!table.length) {
            console.log('[Scraper] No data table found via axios, falling back to Puppeteer');
            return scrapeTenderListPuppeteer(slug, year);
        }

        table.find('tbody tr').each((_, row) => {
            const cells = $(row).find('td');
            if (cells.length < 4) return;

            const kode = $(cells[0]).text().trim();
            const cell1 = $(cells[1]);
            const link  = cell1.find('a').first();
            const nama  = link.text().trim() || cell1.text().split('\n')[0].trim();

            // Extract kode from href
            let kodeFromHref = kode;
            const href = link.attr('href') || '';
            const hrefMatch = href.match(/\/lelang\/(\d+)\//);
            if (hrefMatch) kodeFromHref = hrefMatch[1];

            // Year filter: check "TA 2026" text in cell1
            const cell1Text = cell1.text();
            const taMatch = cell1Text.match(/TA\s+(\d{4})/i);
            if (taMatch && taMatch[1] !== yearStr) return; // skip wrong year

            const instansi = $(cells[2]).text().trim();
            const status   = $(cells[3]).text().trim().replace(/\s*\[\.+\]\s*$/, '').trim();
            const hpsRaw   = $(cells[4]).text().trim();
            let pagu = parsePaguStr(hpsRaw);

            if (kodeFromHref && nama) {
                results.push({
                    'Kode Tender':       kodeFromHref,
                    'Nama Paket':        nama,
                    'Instansi':          instansi,
                    'Pagu':              pagu,
                    'Status_Tender':     status,
                    'Kategori Pekerjaan':'Pekerjaan Konstruksi',
                    'SBU':               '-',
                    'Batas Upload':      '-',
                });
            }
        });

        if (results.length === 0) {
            console.log('[Scraper] Fast-fetch: table empty (AJAX-rendered), falling back to Puppeteer');
            return scrapeTenderListPuppeteer(slug, year);
        }

        console.log(`[Scraper] Fast-fetch found ${results.length} rows for year ${year}`);
        return results;

    } catch (err) {
        console.warn('[Scraper] Fast-fetch failed:', err.message, '— falling back to Puppeteer');
        return scrapeTenderListPuppeteer(slug, year);
    }
}

function parsePaguStr(raw) {
    if (!raw) return 0;
    raw = String(raw).trim().replace(/\s+/g, ' ');
    
    // Case 1: Has units like T, M, Jt, Rb
    // Regex matches numbers like "520,8 Jt" or "1.5 M"
    const unitMatch = raw.match(/([\d,\.]+)\s*(T|M|Jt|Rb)\b/i);
    if (unitMatch) {
        const num = parseFloat(unitMatch[1].replace(/\./g, '').replace(',', '.'));
        const unit = unitMatch[2].toLowerCase();
        if (unit === 't')  return Math.round(num * 1e12);
        if (unit === 'm')  return Math.round(num * 1e9);
        if (unit === 'jt') return Math.round(num * 1e6);
        if (unit === 'rb') return Math.round(num * 1e3);
    }

    // Case 2: Plain number with dots as thousands and comma as decimal (e.g. 520.800.000,00)
    // We remove dots, replace comma with dot
    const plain = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
    return isNaN(plain) ? 0 : Math.round(plain);
}

/**
 * Puppeteer fallback for scrapeTenderList
 */
async function scrapeTenderListPuppeteer(slug, year) {
    const base = getBaseUrl(slug);
    const url = `${base}/lelang?kategoriId=2&tahun=${year}`;
    const yearStr = String(year);
    let browser;
    try {
        browser = await launchBrowser();
        const page = await setupPage(browser);
        console.log(`[Scraper] Puppeteer list: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await handleCloudflare(page);
        
        try { 
            await Promise.race([
                page.waitForSelector('#tbllelang tbody tr', { timeout: 15000 }),
                page.waitForSelector('table.dataTable tbody tr', { timeout: 15000 })
            ]);
        } catch (e) {
            console.log('[Scraper] Puppeteer: Timeout waiting for table rows');
        }
        await new Promise(r => setTimeout(r, 3000));

        const tenders = await page.evaluate((yearStr) => {
            const results = [];
            const table = document.querySelector('#tbllelang') || document.querySelector('table.dataTable');
            if (!table) return results;
            table.querySelectorAll('tbody tr').forEach(row => {
                const cells = Array.from(row.querySelectorAll('td'));
                if (cells.length < 4) return;
                const kode = cells[0]?.innerText.trim();
                const linkEl = cells[1]?.querySelector('a');
                const nama = linkEl?.innerText.trim() || cells[1]?.innerText.split('\n')[0].trim();
                let kodeFromHref = kode;
                if (linkEl) { const m = linkEl.href.match(/\/lelang\/(\d+)\//); if (m) kodeFromHref = m[1]; }
                // Year filter — check "TA 2026" in cell text
                const cell1Text = cells[1]?.innerText || '';
                const taMatch = cell1Text.match(/TA\s+(\d{4})/i);
                if (taMatch && taMatch[1] !== yearStr) return;
                const instansi = cells[2]?.innerText.trim() || '';
                // Clean status: remove trailing "[...]"
                const status = (cells[3]?.innerText.trim() || '').replace(/\s*\[\.+\]\s*$/, '').trim();
                const hpsRaw = cells[4]?.innerText.trim() || '0';
                // Inline pagu parsing (parsePaguStr not available in browser context)
                let pagu = 0;
                const sm = hpsRaw.match(/([\d,\.]+)\s*(T|M|Jt|Rb)?/i);
                if (sm) {
                    const n = parseFloat(sm[1].replace(',', '.')), u = (sm[2]||'').toLowerCase();
                    if (u==='t') pagu=n*1e12; else if(u==='m') pagu=n*1e9; else if(u==='jt') pagu=n*1e6; else if(u==='rb') pagu=n*1e3;
                    else { const p=parseFloat(hpsRaw.replace(/\./g,'').replace(',','.')); pagu=isNaN(p)?0:p; }
                }
                
                if (kodeFromHref && nama) results.push({
                    'Kode Tender': kodeFromHref, 'Nama Paket': nama, 'Instansi': instansi,
                    'Pagu': pagu, 'Status_Tender': status, 'Kategori Pekerjaan': 'Pekerjaan Konstruksi',
                    'SBU': '-', 'Batas Upload': '-'
                });
            });
            return results;
        }, yearStr);
        return tenders;
    } catch (err) {
        console.error('[Scraper] Puppeteer list error:', err.message);
        return [];
    } finally {
        if (browser) await browser.close();
    }
}

/**
 * Scrape multiple tenders in one browser session.
 * Warms up session once, then scrapes each kode sequentially.
 * Uses reduced wait times for speed.
 */
async function scrapeMultiple(slug, kodes) {
    const base = getBaseUrl(slug);
    const listUrl = `${base}/lelang?kategoriId=2`;
    const results = {};
    let browser;

    try {
        browser = await launchBrowser();
        const page = await setupPage(browser);

        console.log(`[Scraper] Multi-scan: warming session for ${slug} (${kodes.length} kodes)`);
        await page.goto(listUrl, { waitUntil: 'networkidle2', timeout: 45000 });
        await handleCloudflare(page);
        await new Promise(r => setTimeout(r, 1000));

        for (const kode of kodes) {
            const pengumumanUrl = `${base}/lelang/${kode}/pengumumanlelang`;
            const jadwalUrl     = `${base}/lelang/${kode}/jadwal`;
            try {
                // Scrape pengumuman
                await page.setExtraHTTPHeaders({ 'Referer': listUrl });
                await page.goto(pengumumanUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                await new Promise(r => setTimeout(r, 2500));

                const pengData = await page.evaluate(() => {
                    let sbu = '';
                    let pagu = '';
                    let hps = '';
                    
                    document.querySelectorAll('table tr').forEach(row => {
                        const th = row.querySelector('th');
                        const td = row.querySelector('td');
                        const cells = Array.from(row.querySelectorAll('td'));
                        
                        // Extract label and value
                        let label = '';
                        let value = '';
                        
                        if (th && td) {
                            label = th.innerText.trim().toLowerCase();
                            value = td.innerText.trim();
                        } else if (cells.length >= 2) {
                            label = cells[0].innerText.trim().toLowerCase();
                            value = cells[cells.length - 1].innerText.trim();
                        }
                        
                        if (label.includes('sbu') || label.includes('sertifikat badan usaha')) {
                            sbu = value;
                        } else if (label.includes('nilai pagu paket')) {
                            pagu = value;
                        } else if (label.includes('nilai hps paket')) {
                            hps = value;
                        }
                    });
                    return { sbu, pagu, hps };
                });

                // Scrape jadwal
                await page.setExtraHTTPHeaders({ 'Referer': pengumumanUrl });
                await page.goto(jadwalUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                await new Promise(r => setTimeout(r, 2000));

                const jadwalData = await page.evaluate(() => {
                    const rows = Array.from(document.querySelectorAll('table tr')).slice(1);
                    const schedules = rows.map(row => {
                        const cols = row.querySelectorAll('td');
                        if (cols.length < 4) return null;
                        return { stage: cols[1]?.innerText?.trim(), end: cols[3]?.innerText?.trim() };
                    }).filter(i => i && i.stage);
                    const up = schedules.find(s =>
                        s.stage.toLowerCase().includes('upload dokumen penawaran') ||
                        s.stage.toLowerCase().includes('pemasukan penawaran')
                    );
                    return { uploadDate: up ? up.end : '-' };
                });

                const sbuCodes = extractSbuCodes(pengData.sbu);
                results[kode] = {
                    sbu:      sbuCodes || pengData.sbu || '-',
                    deadline: jadwalData.uploadDate || '-',
                    pagu:     parsePaguStr(pengData.pagu),
                    hps:      parsePaguStr(pengData.hps)
                };
                console.log(`[Scraper] ${kode}: sbu=${results[kode].sbu} pagu=${results[kode].pagu} hps=${results[kode].hps} deadline=${results[kode].deadline}`);

            } catch (err) {
                console.warn(`[Scraper] Multi-scan failed for ${kode}:`, err.message);
                results[kode] = { sbu: '-', deadline: '-' };
            }
            await new Promise(r => setTimeout(r, 300));
        }
    } catch (err) {
        console.error('[Scraper] Multi-scan error:', err.message);
    } finally {
        if (browser) await browser.close();
    }

    return results;
}

/**
 * Extract SBU subklasifikasi codes from text.
 * Codes: BG/BS/PL/PB/GT/ST/KP/KK followed by 3 digits (e.g. BG004, KK022)
 */
function extractSbuCodes(text) {
    if (!text) return '';
    const regex = /\b(BG|BS|PL|PB|GT|ST|KP|KK|RK|RE|EL|ME|SP|TI|MK|PR|EE|SE)[\s-]*0*(\d{1,3})\b/gi;
    
    // Find all matches with their index positions
    const matches = [];
    let m;
    while ((m = regex.exec(text)) !== null) {
        const prefix = m[1].toUpperCase();
        const num = m[2].padStart(3, '0');
        const code = `${prefix}${num}`;
        matches.push({
            code,
            index: m.index,
            endIndex: regex.lastIndex
        });
    }
    
    if (matches.length === 0) return '';
    
    // Check if any code is specifically associated with KBLI 2020 in the text window after it
    const sbu2020 = [];
    
    for (let i = 0; i < matches.length; i++) {
        const current = matches[i];
        const next = matches[i + 1];
        
        const start = current.endIndex;
        const end = next ? next.index : Math.min(text.length, start + 80);
        const windowText = text.substring(start, end);
        
        const is2020 = /2020/.test(windowText);
        if (is2020) {
            if (!sbu2020.includes(current.code)) {
                sbu2020.push(current.code);
            }
        }
    }
    
    // If we have any KBLI 2020 SBU codes, only return them
    if (sbu2020.length > 0) {
        return sbu2020.join(', ');
    }
    
    // Otherwise, return all unique SBU codes found
    const allUnique = [];
    matches.forEach(m => {
        if (!allUnique.includes(m.code)) {
            allUnique.push(m.code);
        }
    });
    return allUnique.join(', ');
}

/**
 * Extract KBLI codes (5-digit numbers) from text.
 */
function extractKbliCodes(text) {
    if (!text) return '';
    const regex = /\b\d{5}\b/g;
    const matches = text.match(regex) || [];
    return [...new Set(matches)].join(', ');
}

module.exports = { scrapeTender, scrapeTenderList, scrapeMultiple, extractSbuCodes, extractKbliCodes };
