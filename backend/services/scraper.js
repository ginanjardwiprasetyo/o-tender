const { getBaseUrl } = require('../utils/lpse-mapper');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const path = require('path');

const PLAYWRIGHT_SCRIPT = path.join(__dirname, 'playwright_scraper.js');

async function runPlaywrightScraper(type, url, yearStr) {
    const cmd = `node "${PLAYWRIGHT_SCRIPT}" --type ${type} --url "${url}" --year ${yearStr}`;
    const { stdout } = await execPromise(cmd, { maxBuffer: 10 * 1024 * 1024, timeout: 120000 });
    try {
        const lines = stdout.split('\n').filter(l => l.trim().startsWith('{') || l.trim().startsWith('['));
        if (lines.length > 0) {
            return JSON.parse(lines[lines.length - 1]);
        }
        return type === 'list' ? [] : null;
    } catch (e) {
        throw new Error("Failed to parse Playwright scraper output");
    }
}

async function scrapeTender(slug, kode) {
    const base = getBaseUrl(slug);
    const pengumumanUrl = `${base}/lelang/${kode}/pengumumanlelang`;
    const jadwalUrl = `${base}/lelang/${kode}/jadwal`;
    const yearStr = new Date().getFullYear().toString();

    const rawData = await runPlaywrightScraper('detail', pengumumanUrl, yearStr);

    if (!rawData || rawData.error) {
        throw new Error(rawData?.error || 'Playwright scrape returned no data');
    }

    const details = {
        ...(rawData.details || {}),
        'Nilai Pagu Paket': rawData.pagu,
        'Nilai HPS Paket': rawData.hps,
        'Nama Paket': rawData.nama_paket,
        'Instansi': rawData.instansi
    };

    return {
        details,
        sbu: rawData.sbu || '-',
        kbli: '-',
        schedules: rawData.schedules || [],
        uploadDate: rawData.batas_upload || '-',
        pengumumanUrl,
        jadwalUrl
    };
}

async function scrapeTenderList(slug, year) {
    const base = getBaseUrl(slug);
    const url = `${base}/lelang?kategoriId=2&tahun=${year}&instansiId=&rekanan=&kontrak_status=&kontrak_tipe=`;
    try {
        const data = await runPlaywrightScraper('list', url, String(year));
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.warn(`[Scraper] Playwright list failed: ${e.message}`);
        return [];
    }
}

async function scrapeMultiple(slug, kodes) {
    const results = {};
    const base = getBaseUrl(slug);
    const yearStr = new Date().getFullYear().toString();
    for (const kode of kodes) {
        const url = `${base}/lelang/${kode}/pengumumanlelang`;
        try {
            const rawData = await runPlaywrightScraper('detail', url, yearStr);

            if (!rawData || rawData.error) {
                throw new Error(rawData?.error || 'Playwright scrape returned no data');
            }

            function parseInBrowser(raw) {
                if (!raw) return 0;
                let s = String(raw).trim().replace(/^rp\.?\s*/i, '').replace(/\s+/g, ' ');
                const unitMatch = s.match(/([\d,\.]+)\s*(T|M|Jt|Rb)\b/i);
                if (unitMatch) {
                    const n = parseFloat(unitMatch[1].replace(/\./g, '').replace(',', '.'));
                    const u = unitMatch[2].toLowerCase();
                    if (u === 't') return Math.round(n * 1e12);
                    if (u === 'm') return Math.round(n * 1e9);
                    if (u === 'jt') return Math.round(n * 1e6);
                    if (u === 'rb') return Math.round(n * 1e3);
                }
                const plain = parseFloat(s.replace(/\./g, '').replace(',', '.'));
                return isNaN(plain) ? 0 : Math.round(plain);
            }

            results[kode] = {
                sbu: extractSbuCodes(rawData.sbu) || rawData.sbu || '-',
                deadline: rawData.batas_upload || rawData.deadline || '-',
                pagu: typeof rawData.pagu === 'string' ? parseInBrowser(rawData.pagu) : (rawData.pagu || 0),
                hps: typeof rawData.hps === 'string' ? parseInBrowser(rawData.hps) : (rawData.hps || 0)
            };
        } catch (err) {
            console.warn(`[Scraper] Playwright failed for ${kode}: ${err.message}`);
            results[kode] = { sbu: '-', deadline: '-', pagu: 0, hps: 0 };
        }
    }
    return results;
}

function extractSbuCodes(text) {
    if (!text) return '';
    const regex = /\b(BG|BS|PL|PB|GT|ST|KP|KK|RK|RE|EL|ME|SP|TI|MK|PR|EE|SE)[\s-]*0*(\d{1,3})\b/gi;
    const matches = [];
    let m;
    while ((m = regex.exec(text)) !== null) {
        matches.push(`${m[1].toUpperCase()}${m[2].padStart(3, '0')}`);
    }
    return matches.length > 0 ? [...new Set(matches)].join(', ') : '';
}

function extractKbliCodes(text) {
    if (!text) return '';
    const regex = /\b\d{5}\b/g;
    const matches = text.match(regex) || [];
    return [...new Set(matches)].join(', ');
}

module.exports = { scrapeTender, scrapeTenderList, scrapeMultiple, extractSbuCodes, extractKbliCodes };
