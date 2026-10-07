/**
 * TenderBuild — Crawler Service
 * Crawls LKPP INAPROC API and stores data in Supabase
 */
const axios = require('axios');
const https = require('https');
const crypto = require('crypto');
// Allow legacy TLS (TLS 1.0/1.1 and weak ciphers) for outdated LPSE sites like sukoharjokab
axios.defaults.httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
    ciphers: 'DEFAULT:@SECLEVEL=0'
});
const db = require('../config/db');
const { getSlug, getBaseUrl, getLPSEList } = require('../utils/lpse-mapper');
const { exec } = require('child_process');
const util = require('util');
const os = require('os');
const path = require('path');
const execPromise = util.promisify(exec);
const { normalizeDate } = require('../utils/date-formatter');
const cheerio = require('cheerio');
const { extractSbuCodes, resolveSbu, resolveSbuString } = require('../utils/kbli-sbu-map');

function isDeadlineFuture(dateStr) {
    if (!dateStr || dateStr === '-') return false;
    const normalized = normalizeDate(dateStr);
    if (!normalized) return false;
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return false;
    return d.getTime() > Date.now();
}

function extractAanwizingDate(schedules) {
    if (!schedules || !Array.isArray(schedules)) return null;
    const keywords = ['pemberian penjelasan', 'anwijzing', 'aanwijzing'];
    for (const s of schedules) {
        const name = (s.stage || '').toLowerCase();
        if (keywords.some(k => name.includes(k))) {
            return s.start || s.end || null;
        }
    }
    return null;
}

async function tryFreeMemory() {
    if (typeof global.gc === 'function') {
        global.gc();
        await new Promise(r => setTimeout(r, 500));
        global.gc();
    }
}

// Ringkasan jalur list per LPSE — ditulis ke crawl_logs.error bila 0 tender,
// supaya alasan kegagalan dari GitHub Actions kelihatan tanpa buka log Actions.
const listDiag = [];

async function runScraper(type, url, yearStr) {
    // Try to free memory first
    await tryFreeMemory();

    // Jalur list HTTP dulu (tanpa browser) — cuma butuh cookie + token CSRF.
    // Playwright tetap cadangan bila kena challenge Cloudflare/WAF.
    if (type === 'list') {
        const slug = new URL(url).pathname.split('/')[1];
        const jalur = [];
        jalur.push(['HTTP', () => httpListScraper(url)]);
        if (process.env.FLARESOLVERR_URL) jalur.push(['FLARE', () => flareListScraper(url)]);
        for (const [nama, fn] of jalur) {
            try {
                const rows = await fn();
                if (rows && rows.length) {
                    listDiag.push(`${slug}:${nama}:${rows.length}`);
                    console.log(`[Crawler] List via ${nama} OK: ${rows.length} baris (${slug})`);
                    return rows;
                }
                listDiag.push(`${slug}:${nama}:${rows === null ? 'blocked' : 'kosong'}`);
            } catch (e) {
                listDiag.push(`${slug}:${nama}:${e.response ? 'HTTP' + e.response.status : (e.code || e.message).slice(0, 40)}`);
            }
        }
        console.warn(`[Crawler] List HTTP/Flare gagal (${listDiag[listDiag.length - 1]}) → fallback Playwright`);
    }

    const slug = type === 'list' ? new URL(url).pathname.split('/')[1] : '';
    const freeMemMb = Math.round(os.freemem() / 1024 / 1024);
    if (freeMemMb < 70) {
        const warnMsg = `Memory too low (${freeMemMb}MB free), skipping Playwright ${type}`;
        console.warn(`[Crawler] ${warnMsg}`);
        if (type === 'list') listDiag.push(`${slug}:PW:skip-lowmem-${freeMemMb}MB`);
        return type === 'list' ? [] : null;
    }
    const cmd = `node --max-old-space-size=192 --expose-gc ${path.join(__dirname, 'playwright_scraper.js')} --type ${type} --url "${url}" --year ${yearStr}`;
    const { stdout, stderr } = await execPromise(cmd, { maxBuffer: 10 * 1024 * 1024, timeout: 120000 });
    // Diagnostik scraper (NO_DATA dsb) ditulis ke stderr — tampilkan agar kelihatan di log Actions
    String(stderr || '').split('\n').filter(l => l.trim()).forEach(l => console.log(`[scraper:${type}] ${l}`));
    try {
        const lines = stdout.split('\n').filter(l => l.trim().startsWith('{') || l.trim().startsWith('['));
        if (lines.length > 0) {
            const parsed = JSON.parse(lines[lines.length - 1]);
            if (type === 'list') listDiag.push(`${slug}:PW:${Array.isArray(parsed) ? parsed.length : 'bad'}`);
            return parsed;
        }
        if (type === 'list') listDiag.push(`${slug}:PW:empty-output`);
        return type === 'list' ? [] : null;
    } catch(e) {
        if (type === 'list') listDiag.push(`${slug}:PW:parse-error`);
        throw new Error("Failed to parse scraper output");
    }
}

const parseCurrency = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const str = String(val).trim();
    if (/^-?[0-9]+(\.[0-9]+)?$/.test(str)) {
        return Math.round(parseFloat(str));
    }
    // Satuan format list SPSE: "11,3 M" (miliar), "750 jt", "1,5 T"
    const unit = str.match(/([\d.,]+)\s*(jt|rb|m|t)\b/i);
    if (unit) {
        const n = parseFloat(unit[1].replace(/\./g, '').replace(',', '.'));
        const f = { t: 1e12, m: 1e9, jt: 1e6, rb: 1e3 }[unit[2].toLowerCase()];
        if (!isNaN(n) && f) return Math.round(n * f);
    }
    let clean = str.replace(/Rp/gi, '').replace(/\./g, '').replace(/\s/g, '');
    clean = clean.split(',')[0];
    return parseInt(clean, 10) || 0;
};

function extractSbu(text) {
    if (!text || text === '-') return '-';
    const arr = resolveSbu(text);
    return arr.length ? arr.join(', ') : '-';
}
// keep legacy name for callers that used extractSbuCodes in this file
function extractSbuCodesLocal(text) {
    const arr = extractSbuCodes(text);
    return arr.length ? arr.join(', ') : '-';
}

// Header rambut browser — dipakai semua jalur HTTP (list + detail).
const HTTP_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Sec-Ch-Ua': '"Google Chrome";v="125", "Chromium";v="125"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"macOS"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
};

/**
 * Salin baris DataTables apa adanya (16 kolom, termasuk pagu di index 4)
 * karena HTML tabel yang dirender hanya punya 5 kolom tampak.
 * Eksekusi setelah halaman load oleh ScrapingAnt (param js_snippet, base64).
 */
const ANT_LIST_SNIPPET = Buffer.from(`
(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    let out = [];
    for (let i = 0; i < 20; i++) {
        try {
            const t = window.jQuery('table.dataTable').DataTable();
            out = t.rows().data().toArray();
        } catch (e) { out = ['ERR:' + e.message]; break; }
        if (out.length) break;
        await wait(500);
    }
    const pre = document.createElement('pre');
    pre.id = '__ant';
    pre.textContent = JSON.stringify(out);
    document.body.appendChild(pre);
})();
`).toString('base64');

// ============================================================
// FlareSolverr — Proxy solver Cloudflare (Docker container)
// ============================================================
async function flareSolverrGet(url) {
    const flareUrl = process.env.FLARESOLVERR_URL || 'http://localhost:8191/v1';
    const res = await axios.post(flareUrl, {
        cmd: 'request.get',
        url: url,
        maxTimeout: 60000
    }, { timeout: 70000 });

    if (res.data && res.data.status === 'ok' && res.data.solution) {
        return res.data.solution;
    }
    throw new Error(res.data ? res.data.message : 'FlareSolverr request failed');
}

async function flareListScraper(listUrl) {
    const solution = await flareSolverrGet(listUrl);
    if (!solution || !solution.response) return null;
    const html = solution.response;
    if (looksBlocked(html)) return null;

    const $ = cheerio.load(html);
    const out = [];
    $('table.dataTable tbody tr').each((i, tr) => {
        const c = $(tr).find('td').map((j, td) => $(td).text().replace(/\s+/g, ' ').trim()).get();
        if (c.length >= 5 && /^[\d]+$/.test(c[0])) {
            out.push({
                'Kode Tender': c[0], 'kode_tender': c[0], 'Nama Paket': c[1] || '',
                'Instansi': c[2] || '', 'Pagu': 0, 'HPS': parseCurrency(c[4]),
                'Status_Tender': c[3] || '', 'Kategori Pekerjaan': 'Pekerjaan Konstruksi',
                'SBU': '-', 'Batas Upload': '-',
            });
        }
    });

    if (!out.length) {
        const u = new URL(listUrl);
        const slug = u.pathname.split('/').filter(Boolean)[0];
        let token = (String(html).match(/authenticity[Tt]oken["'\s:=]+([a-f0-9]{32,})/) || [])[1] || '';
        const cookieStr = (solution.cookies || []).map(c => `${c.name}=${c.value}`).join('; ');

        if (token && cookieStr) {
            const q = new URLSearchParams();
            for (const k of ['kategoriId', 'rekanan', 'tahun', 'instansiId']) {
                q.set(k, u.searchParams.get(k) || '');
            }
            const postUrl = `${u.origin}/${slug}/dt/lelang?${q.toString()}`;
            const body = new URLSearchParams({
                draw: '1', start: '0', length: '25',
                'search[value]': '', 'search[regex]': 'false',
                'order[0][column]': '5', 'order[0][dir]': 'desc',
                authenticityToken: token,
            });
            for (let i = 0; i < 6; i++) {
                body.set(`columns[${i}][data]`, String(i));
                body.set(`columns[${i}][name]`, '');
                body.set(`columns[${i}][searchable]`, 'true');
                body.set(`columns[${i}][orderable]`, 'true');
                body.set(`columns[${i}][search][value]`, '');
                body.set(`columns[${i}][search][regex]`, 'false');
            }
            try {
                const r2 = await axios.post(postUrl, body, {
                    timeout: 20000,
                    headers: {
                        ...HTTP_HEADERS,
                        'User-Agent': solution.userAgent || HTTP_HEADERS['User-Agent'],
                        Cookie: cookieStr,
                        Referer: listUrl,
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                    }
                });
                const rows = r2.data && r2.data.data;
                if (Array.isArray(rows) && rows.length) return mapListRows(rows);
            } catch {}
        }
    }

    return out.length ? out : null;
}

function looksBlocked(html) {
    const txt = String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    return /just a moment|verifikasi singkat|akses ditolak|anda tidak diizinkan/i.test(txt);
}
/** Array 16 kolom (format dt/lelang) → bentuk hasil yang dipakai crawler. */
function mapListRows(rows) {
    const results = [];
    for (const row of rows) {
        if (!Array.isArray(row) || row.length < 11) continue;
        const kode = String(row[0]).trim();
        const nama = String(row[1] || '').replace(/<[^>]*>?/gm, '').trim();
        results.push({
            'Kode Tender': kode,
            'kode_tender': kode,
            'Nama Paket': nama,
            'Instansi': row[2] || '',
            'Pagu': parseCurrency(row[4]),
            'HPS': parseCurrency(row[10] || row[4]),
            'Status_Tender': row[3] || '',
            'Kategori Pekerjaan': 'Pekerjaan Konstruksi',
            'SBU': '-',
            'Batas Upload': '-',
        });
    }
    return results;
}

async function httpListScraper(listUrl) {
    const u = new URL(listUrl);
    const slug = u.pathname.split('/').filter(Boolean)[0];

    const resp = await axios.get(listUrl, { timeout: 20000, headers: HTTP_HEADERS, maxRedirects: 5 });
    const html = resp.data;
    const cookie = (resp.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');

    const pageText = String(html).replace(/<[^>]*>/g, ' ');
    if (/just a moment|cf-browser-verification|akses ditolak|anda tidak diizinkan/i.test(pageText)) {
        return null; // challenge Cloudflare / WAF
    }

    let token = (String(html).match(/authenticity[Tt]oken["'\s:=]+([a-f0-9]{32,})/) || [])[1] || '';
    if (!token) {
        const m = cookie.match(/___AT=([a-f0-9]+)/);
        if (m) token = m[1];
    }
    if (!token) return null;

    // URL POST & query persis seperti yang dikirim browser (4 param tetap).
    const q = new URLSearchParams();
    for (const k of ['kategoriId', 'rekanan', 'tahun', 'instansiId']) {
        q.set(k, u.searchParams.get(k) || '');
    }
    const postUrl = `${u.origin}/${slug}/dt/lelang?${q.toString()}`;

    const body = new URLSearchParams({
        draw: '1', start: '0', length: '25',
        'search[value]': '', 'search[regex]': 'false',
        'order[0][column]': '5', 'order[0][dir]': 'desc',
        authenticityToken: token,
    });
    for (let i = 0; i < 6; i++) {
        body.set(`columns[${i}][data]`, String(i));
        body.set(`columns[${i}][name]`, '');
        body.set(`columns[${i}][searchable]`, 'true');
        body.set(`columns[${i}][orderable]`, 'true');
        body.set(`columns[${i}][search][value]`, '');
        body.set(`columns[${i}][search][regex]`, 'false');
    }

    const r2 = await axios.post(postUrl, body, {
        timeout: 20000,
        headers: {
            ...HTTP_HEADERS,
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            Cookie: cookie,
            Referer: listUrl,
        },
    });

    const rows = r2.data && r2.data.data;
    if (!Array.isArray(rows)) return null;
    return mapListRows(rows);
}

async function httpDetailScraper(pengumumanUrl) {
    const urlObj = new URL(pengumumanUrl);
    const homeUrl = urlObj.origin + '/' + urlObj.pathname.split('/')[1] + '/lelang';

    const headers = HTTP_HEADERS;

    let cookies = {};

    function extractCookies(setCookieHeaders) {
        if (!setCookieHeaders) return;
        const arr = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
        for (const c of arr) {
            const pair = c.split(';')[0].trim();
            const eq = pair.indexOf('=');
            if (eq > 0) {
                cookies[pair.substring(0, eq).trim()] = pair.substring(eq + 1).trim();
            }
        }
    }

    function cookieHeader() {
        return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    }

    const useFlare = !!process.env.FLARESOLVERR_URL;
    async function getPage(url, referer) {
        let html = null;
        try {
            const r = await axios.get(url, {
                timeout: 20000,
                headers: { ...headers, Cookie: cookieHeader(), Referer: referer },
                maxRedirects: 5,
            });
            extractCookies(r.headers['set-cookie']);
            html = r.data;
        } catch (e) {
            console.warn(`[Crawler] HTTP getPage gagal (${url}):`, e.message);
        }

        if (html && !looksBlocked(html)) {
            return html;
        }

        if (useFlare) {
            try {
                const solution = await flareSolverrGet(url);
                if (solution && solution.response) {
                    solution.cookies.forEach(c => { cookies[c.name] = c.value; });
                    html = solution.response;
                }
            } catch (e) {
                console.warn(`[Crawler] FlareSolverr detail gagal (${url}):`, e.message);
            }
        }
        
        if (html && looksBlocked(html)) return null;
        return html;
    }

    // Visit homepage first to get session cookies
    try {
        const homeResp = await axios.get(homeUrl, { timeout: 10000, headers, maxRedirects: 5 });
        extractCookies(homeResp.headers['set-cookie']);
    } catch {}
    await new Promise(r => setTimeout(r, 500));

    // Fetch pengumuman page
    const html = await getPage(pengumumanUrl, homeUrl);
    if (!html) return null;
    const $ = cheerio.load(html);

    // Check for WAF block
    const bodyText = $('body').text().toLowerCase();
    if (bodyText.includes('akses ditolak') || bodyText.includes('anda tidak diizinkan membuka') || looksBlocked(html)) {
        return null;
    }

    // Extract table data
    let sbu = '-';
    let pagu = '';
    let hps = '';
    let nama_paket = '';
    let instansi = '';
    const details = {};

    $('table tr').each((i, row) => {
        const cells = $(row).find('th, td');
        const texts = cells.map((j, c) => $(c).text().trim()).get();
        for (let j = 0; j < texts.length; j++) {
            const label = texts[j].toLowerCase();
            const value = j + 1 < texts.length ? texts[j + 1] : '';
            if (!value) continue;
            // simpan pasangan label→value (kunci berawal huruf besar) utk halaman detail frontend
            if (texts[j].length <= 60 && value !== texts[j]) details[texts[j]] = value;
            if (label.includes('sbu') || label.includes('sertifikat badan usaha')) sbu = extractSbu(value);
            else if (label.includes('nilai pagu') || label === 'pagu') pagu = value;
            else if (label.includes('nilai hps') || label === 'hps') hps = value;
            else if (label.includes('nama paket') || label.includes('nama tender')) nama_paket = value;
            else if (label.includes('instansi') || label.includes('k/l/pd')) instansi = value;
        }
    });

    // Extract Syarat Kualifikasi for SBU (include KBLI→SBU fallback)
    const fullText = $('body').text();
    const kualifIdx = fullText.indexOf('Syarat Kualifikasi');
    let qualSection = '';
    if (kualifIdx >= 0) {
        qualSection = fullText.substring(kualifIdx + 'Syarat Kualifikasi'.length, kualifIdx + 4000).trim();
        // merge SBU dari tabel + qualSection + fullText via KBLI mapping ("KBLI 41012" -> BG002)
        const combined = [sbu !== '-' ? sbu : '', qualSection, fullText.substring(0, 8000)].join(' ');
        const resolved = resolveSbu(combined);
        if (resolved.length) sbu = resolved.join(', ');
        else if (sbu === '-') sbu = extractSbu(qualSection);
    } else if (sbu === '-') {
        // tidak ada header Syarat Kualifikasi, tetap coba KBLI di body
        const resolved = resolveSbu(fullText.substring(0, 8000));
        if (resolved.length) sbu = resolved.join(', ');
    }
    if (qualSection) details['Syarat Kualifikasi'] = qualSection;

    // Fetch jadwal page for schedule info (batas upload & aanwijzing)
    const jadwalUrl = pengumumanUrl.replace('/pengumumanlelang', '/jadwal');
    let batas_upload = '';
    let schedules = [];
    let jadwalHtml = '';
    try {
        jadwalHtml = await getPage(jadwalUrl, pengumumanUrl);
        if (jadwalHtml) {
        const $$ = cheerio.load(jadwalHtml);
        $$('table tr').each((i, row) => {
            const cells = $$(row).find('td');
            if (cells.length >= 4) {
                const stage = $$(cells[1]).text().trim();
                const start = $$(cells[2]).text().trim();
                const end = $$(cells[3]).text().trim();
                const perubahan = cells[4] ? $$(cells[4]).text().trim() : '';
                const stageLower = stage.toLowerCase();
                if (stageLower.includes('upload') && stageLower.includes('penawaran')) {
                    batas_upload = end || start;
                }
                schedules.push({ stage, start, end, perubahan });
            } else if (cells.length >= 2) {
                const label = $$(cells[0]).text().trim();
                const value = $$(cells[1]).text().trim();
                const combined = (label + ' ' + value).toLowerCase();
                if (combined.includes('upload') && combined.includes('penawaran')) {
                    batas_upload = value;
                }
                schedules.push({ stage: label, start: value, end: value, perubahan: '' });
            }
        });
        if (!batas_upload) {
            const jBody = $$('body').text();
            const m = jBody.match(/(?:Batas\s*(?:Akhir\s+)?Upload|Upload\s+Dokumen\s+Penawaran|Pemasukan\s+Penawaran)[\s:]*([^\n]+)/i);
            if (m) batas_upload = m[1].trim();
        }
        }
    } catch (e) {}

    let aanwijzing_date = extractAanwizingDate(schedules);
    if (!aanwijzing_date && schedules.length === 0) {
        const jBody = typeof jadwalHtml === 'string' ? jadwalHtml : '';
        const m = jBody.match(/(?:Pemberian\s+Penjelasan|Anwijzing|Aanwijzing)[\s\S]{0,50}?(\d{1,2}\s+\w+\s+\d{4}\s+\d{1,2}:\d{2})/i);
        if (m) aanwijzing_date = m[1].trim();
    }

    return { sbu, pagu, hps, nama_paket, instansi, batas_upload, aanwijzing_date, schedules, details };
}

class CrawlerService {
    constructor() {
        this.status = {
            state: 'idle',
            startedAt: null,
            finishedAt: null,
            totalLpse: 0,
            processedLpse: 0,
            totalTenders: 0,
            totalKonstruksi: 0,
            error: null,
            logId: null,
            logs: []
        };
        // List of allowed Kategori for Konstruksi
        this.kategoriKonstruksi = ['Pekerjaan Konstruksi'];
        this.shouldStop = false;
    }

    log(msg) {
        const time = new Date().toLocaleTimeString('id-ID');
        const entry = `[${time}] ${msg}`;
        console.log(`[Crawler] ${entry}`);
        this.status.logs.unshift(entry);
        if (this.status.logs.length > 50) this.status.logs.pop();
    }

    async getStatus() {
        // Clean up stale 'running' logs (from crashed runs) — if current state is idle
        // but a log is still 'running', mark it as 'error'.
        // Instance online (DISABLE_CRAWLER) tidak membersihkan: baris 'running' milik GitHub Actions yang sedang crawl.
        if (this.status.state !== 'running' && process.env.DISABLE_CRAWLER !== 'true') {
            try {
                await db.query(
                    `UPDATE crawl_logs SET finished_at = NOW(), status = 'error', error = 'Proses terhenti (server restart)' WHERE status = 'running'`
                );
            } catch {}
        }

        const { rows: history } = await db.query(
            'SELECT * FROM crawl_logs ORDER BY started_at DESC LIMIT 5'
        );
        return {
            current: this.status,
            history
        };
    }

    stop() {
        if (this.status.state === 'running') {
            this.shouldStop = true;
            this.log('Menerima perintah stop, mohon tunggu hingga proses saat ini selesai...');
        }
    }

    async crawlAllLPSE(year = new Date().getFullYear()) {
        if (this.status.state === 'running') {
            throw new Error('Crawl is already running');
        }

        this.status = {
            state: 'running',
            startedAt: new Date(),
            finishedAt: null,
            totalLpse: 0,
            processedLpse: 0,
            totalTenders: 0,
            totalKonstruksi: 0,
            error: null,
            logId: null,
            logs: []
        };
        this.shouldStop = false;
        listDiag.length = 0;
        this.log('Memulai proses crawl seluruh LPSE...');

        try {
            // 1. Init Log
            const { rows: logRows } = await db.query(
                `INSERT INTO crawl_logs (total_lpse, total_tenders, total_konstruksi, status)
                 VALUES (0, 0, 0, 'running') RETURNING id`
            );
            this.status.logId = logRows[0].id;

            // 2. Fetch Master LPSE
            this.log('Mengambil daftar Master LPSE dari LKPP ISB...');
            const rawLpse = await getLPSEList();
            
            // Read targets from settings
            const { rows: settings } = await db.query("SELECT key, value FROM settings WHERE key IN ('crawl_lpse_targets', 'wa_target_sbu', 'wa_target_max_hps')");
            let targets = [];
            this.status.waTargetSbu = [];
            this.status.waTargetMaxHps = 0;
            this.status.newTendersMap = {};
            
            for (const row of settings) {
                if (row.key === 'crawl_lpse_targets' && row.value) {
                    try { targets = JSON.parse(row.value); } catch {}
                }
                if (row.key === 'wa_target_sbu' && row.value) {
                    this.status.waTargetSbu = row.value.split(',').map(s => s.toUpperCase().replace(/[^A-Z0-9]/g, '')).filter(s => s);
                }
                if (row.key === 'wa_target_max_hps' && row.value) {
                    this.status.waTargetMaxHps = parseInt(row.value) || 0;
                }
            }
            
            let lpseList = rawLpse;
            if (targets && targets.length > 0) {
                const targetKds = targets.map(t => String(t.kd_lpse));
                lpseList = rawLpse.filter(l => targetKds.includes(String(l.kd_lpse)));
            }
            // Free the full LPSE list from memory
            if (lpseList !== rawLpse) rawLpse.length = 0;
            
            this.status.totalLpse = lpseList.length;
            this.log(`Ditemukan ${lpseList.length} LPSE target. Mulai batch crawl tahun ${year}...`);

            // 3. Process sequentially to prevent OOM (Out Of Memory) on 512MB RAM free tier
            for (const lpse of lpseList) {
                if (this.shouldStop) {
                    this.log('Proses crawl dihentikan oleh user.');
                    break;
                }
                try {
                    await this.crawlSingleLPSE(lpse.kd_lpse, lpse.nama_lpse, year);
                } catch (err) {
                    console.error(`[Crawler] Failed LPSE ${lpse.kd_lpse}:`, err.message);
                } finally {
                    this.status.processedLpse++;
                }
                // Force GC between LPSE crawls
                await tryFreeMemory();
                await new Promise(r => setTimeout(r, 2000));
            }

            // 4. Run deep scan for missing SBU & deadlines
            this.log('Menjalankan Deep Scan untuk melengkapi data SBU & Batas Upload...');
            await tryFreeMemory();
            const targetKds = (targets && targets.length > 0) ? targets.map(t => String(t.kd_lpse)) : null;
            await this.deepScanMissingData(year, targetKds);

            // 5. Finish
            this.status.state = 'idle';
            this.status.finishedAt = new Date();
            this.log(`Crawl selesai! Total Tender: ${this.status.totalTenders}, Konstruksi: ${this.status.totalKonstruksi}`);

            await db.query(
                `UPDATE crawl_logs SET finished_at = NOW(), total_lpse = $1, total_tenders = $2, total_konstruksi = $3, status = 'success', error = $5 WHERE id = $4`,
                [this.status.totalLpse, this.status.totalTenders, this.status.totalKonstruksi, this.status.logId,
                 this.status.totalTenders ? null : listDiag.slice(0, 12).join(' | ').slice(0, 900) || null]
            );

        } catch (error) {
            this.status.state = 'idle';
            this.status.finishedAt = new Date();
            this.status.error = error.message;
            console.error(`[Crawler] Fatal Error:`, error.message);

            if (this.status.logId) {
                await db.query(
                    `UPDATE crawl_logs SET finished_at = NOW(), status = 'error', error = $1 WHERE id = $2`,
                    [error.message, this.status.logId]
                );
            }
        }
    }

    async fetchFromAPI(year, kd_lpse) {
        // ponytail: ISB decommissioned 31 Dec 2025, always 403. Skip straight to scraper.
        return [];
    }

    async crawlSingleLPSE(kd_lpse, nama_lpse, year) {
        const kdLpseInt = parseInt(kd_lpse);
        try {
            const slug = getSlug(String(kd_lpse), nama_lpse);
            this.log(`Memproses ${nama_lpse} (${slug})...`);
            
            // 1. Fetch from API
            let apiTenders = await this.fetchFromAPI(year, kd_lpse);
            
            // 2. Queue Task to Chrome Extension
            const baseUrl = getBaseUrl(slug);
            const listUrl = `${baseUrl}/lelang?kategoriId=2&tahun=${year}&instansiId=&rekanan=&kontrak_status=&kontrak_tipe=`;

            let scrapedTenders = [];
            try {
                this.log(`Menjalankan Playwright scraper list untuk ${slug}...`);
                scrapedTenders = await runScraper('list', listUrl, String(year));
            } catch (err) {
                this.log(`Scrape list timeout/error untuk ${slug}: ${err.message}`);
            }
            
            // 3. Merge results by Kode Tender
            const combined = new Map();
            
            // Add API results
            apiTenders.forEach(t => {
                const kode = String(t['Kode Tender'] || t.kode_tender || '');
                if (kode) combined.set(kode, t);
            });
            
            // Merge with Scraped results (scraped often has more up-to-date status)
            scrapedTenders.forEach(t => {
                const kode = String(t['Kode Tender'] || t.kode_tender || '');
                if (kode) {
                    if (combined.has(kode)) {
                        const apiTender = combined.get(kode);
                        
                        // Parse pagu and hps from both sources to ensure we don't save 0 or lose data
                        const apiPagu = parseCurrency(apiTender.Pagu || apiTender.pagu);
                        const apiHps = parseCurrency(apiTender.HPS || apiTender.hps);
                        
                        const scrapedPagu = parseCurrency(t.Pagu || t.pagu);
                        const scrapedHps = parseCurrency(t.HPS || t.hps);
                        
                        // LKPP API has actual separate Pagu and HPS. Scraped only has HPS (which was stored in Pagu and HPS).
                        // Prefer API values if they are > 0, otherwise use scraped.
                        const finalPagu = apiPagu > 0 ? apiPagu : scrapedPagu;
                        const finalHps = apiHps > 0 ? apiHps : scrapedHps;

                        combined.set(kode, {
                            ...apiTender,
                            ...t,
                            // Ensure Pagu and HPS are correctly resolved
                            'Pagu': finalPagu,
                            'HPS': finalHps,
                            // Retain specific API objects/arrays
                            'lokasi_paket': apiTender.lokasi_paket || t.lokasi_paket,
                            'Instansi dan Satker': apiTender['Instansi dan Satker'] || t['Instansi dan Satker']
                        });
                    } else {
                        combined.set(kode, t);
                    }
                }
            });

            const tenders = Array.from(combined.values());

            if (tenders.length === 0) {
                this.log(`${slug}: Tidak ada paket ditemukan.`);
                return 0;
            }

            this.status.totalTenders += tenders.length;
            console.log(`[Crawler] Found ${tenders.length} total packages for ${nama_lpse} (API: ${apiTenders.length}, Scraped: ${scrapedTenders.length})`);
            
            for (const t of tenders) {
                // 1. Year filter (safety check)
                const taText = String(t['Tahun Anggaran'] || t.tahun_anggaran || t.raw_data?.tahun_anggaran || '');
                const cell1Text = String(t['Nama Paket'] || t.nama_paket || '');
                const hasWrongYear = (taText && taText !== String(year)) || 
                                   (cell1Text.includes('TA ') && !cell1Text.includes(`TA ${year}`));
                if (hasWrongYear && !cell1Text.includes(`TA ${year}`)) continue;

                // 2. Category Filter (Konstruksi only, exclude Konsultansi/Perencanaan/Pengawasan)
                const cat = (
                    t['Kategori Pekerjaan'] || t['kategori_pekerjaan'] ||
                    t.kategori || t['Kategori'] || ''
                ).toLowerCase();
                
                const isKonstruksi = cat.includes('konstruksi');
                const isKonsultansi = cat.includes('konsultansi') || 
                                    cat.includes('perencanaan') || 
                                    cat.includes('pengawasan') ||
                                    cat.includes('manajemen konstruksi');
                
                if (!isKonstruksi || isKonsultansi) continue;

                this.status.totalKonstruksi++;

                // Normalize fields
                const instansi = t.Instansi || t.instansi ||
                    (Array.isArray(t['Instansi dan Satker']) ? t['Instansi dan Satker'][0]?.nama_instansi : null) ||
                    nama_lpse;

                // Batas upload: from jadwal_penawaran or direct field
                const jp = t['jadwal_penawaran'] || t.jadwal_penawaran;
                const batasUploadRaw = t['Batas Upload'] || t.batas_upload ||
                    (jp && typeof jp === 'object' ? jp.tanggal_akhir || jp.berakhir : null) ||
                    null;
                const batasUpload = normalizeDate(batasUploadRaw);

                const paguVal = parseCurrency(t.Pagu || t.pagu);
                const hpsVal  = parseCurrency(t.HPS  || t.hps);

                // Sanitize raw_data for JSONB — remove circular refs, ensure serializable
                let rawData = null;
                try { rawData = JSON.parse(JSON.stringify(t)); } catch { rawData = null; }

                const tenderKodeStr = String(t['Kode Tender'] || t.kode_tender || '');
                const { rows: existing } = await db.query('SELECT kode_tender FROM crawled_tenders WHERE kode_tender = $1 AND kd_lpse = $2', [tenderKodeStr, kdLpseInt]);
                const isNew = existing.length === 0;

                await db.query(`
                    INSERT INTO crawled_tenders (
                        kode_tender, kd_lpse, nama_lpse, nama_paket, instansi, 
                        pagu, hps, kategori, metode_pemilihan, status_tender, 
                        lokasi, tahun_anggaran, slug, raw_data, sbu, batas_upload
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                    ON CONFLICT (kode_tender, kd_lpse) 
                    DO UPDATE SET 
                        nama_paket       = EXCLUDED.nama_paket,
                        instansi         = EXCLUDED.instansi,
                        pagu             = EXCLUDED.pagu,
                        hps              = EXCLUDED.hps,
                        status_tender    = EXCLUDED.status_tender,
                        kategori         = EXCLUDED.kategori,
                        metode_pemilihan = EXCLUDED.metode_pemilihan,
                        lokasi           = EXCLUDED.lokasi,
                        slug             = EXCLUDED.slug,
                        raw_data         = EXCLUDED.raw_data,
                        sbu = CASE 
                            WHEN crawled_tenders.sbu IS NULL OR crawled_tenders.sbu = '-' 
                            THEN EXCLUDED.sbu 
                            ELSE crawled_tenders.sbu 
                        END,
                        batas_upload = CASE 
                            WHEN EXCLUDED.batas_upload IS NOT NULL AND EXCLUDED.batas_upload != '-' 
                            THEN EXCLUDED.batas_upload 
                            ELSE crawled_tenders.batas_upload 
                        END,
                        crawled_at = NOW()
                `, [
                    String(t['Kode Tender'] || t.kode_tender || ''),
                    kdLpseInt,
                    nama_lpse,
                    t['Nama Paket'] || t.nama_paket || '',
                    instansi,
                    paguVal,
                    hpsVal,
                    'Pekerjaan Konstruksi',
                    t['Metode Pemilihan'] || t.metode_pemilihan || '-',
                    t['Status_Tender'] || t['Status Tender'] || t.status_tender || '-',
                    t.lokasi_paket ? JSON.stringify(t.lokasi_paket) : null,
                    parseInt(year),
                    slug,
                    rawData,
                    t.SBU || null,
                    batasUpload
                ]);

                if (isNew) {
                    const tenderSbu = t.SBU || '-';
                    if (tenderSbu !== '-') {
                        const sbus = tenderSbu.split(',').map(s => s.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                        const matchesTarget = this.status.waTargetSbu.length === 0 || sbus.some(s => this.status.waTargetSbu.includes(s));
                        const maxHps = this.status.waTargetMaxHps || 0;
                        const matchesHps = maxHps === 0 || hpsVal <= maxHps;
                        if (matchesTarget && matchesHps) {
                            const deadlineOk = isDeadlineFuture(batasUpload);
                            if (!deadlineOk) {
                                this.log(`Skip notif ${tenderKodeStr}: batas upload sudah lewat (${batasUpload || '-'})`);
                            } else {
                                const { sendWhatsAppMessage } = require('../utils/whatsapp');
                                const formatRp = (v) => new Intl.NumberFormat('id-ID').format(v || 0);
                                const aanwizingDate = extractAanwizingDate(t.Jadwal || t.schedules || null) || '-';
                                const msg = `*Tender Konstruksi Baru Terdeteksi* 🚀\n\n*Nama Paket:* ${t['Nama Paket'] || t.nama_paket || ''}\n*SBU:* ${tenderSbu}\n*Instansi:* ${instansi}\n*Pagu:* Rp ${formatRp(paguVal)}\n*HPS:* Rp ${formatRp(hpsVal)}\n*Tgl Upload:* ${batasUpload || '-'}\n*Aanwijzing:* ${aanwizingDate}\n*LPSE:* ${nama_lpse}\n\n⚠️ *Catatan:* Masih diperlukan cek alat, personil, dll secara manual di dokpil.`;
                                sendWhatsAppMessage(null, msg).catch(() => {});
                            }
                        }
                    } else {
                        this.status.newTendersMap = this.status.newTendersMap || {};
                        this.status.newTendersMap[tenderKodeStr] = {
                            nama_paket: t['Nama Paket'] || t.nama_paket || '',
                            instansi: instansi,
                            pagu: paguVal,
                            hps: hpsVal,
                            nama_lpse: nama_lpse
                        };
                    }
                }
            }
            // Free large arrays from memory
            apiTenders = null;
            scrapedTenders = null;
            combined.clear();
            tenders.length = 0;
            return tenders.length;
        } catch (err) {
            console.error(`[Crawler] Failed for ${kd_lpse}:`, err.message);
            return 0;
        }
    }

    async deepScanMissingData(year, targetKds = null) {
        // Find all tenders from this year that are missing SBU or batas_upload
        let query = `
            SELECT kode_tender, slug, batas_upload FROM crawled_tenders 
            WHERE tahun_anggaran = $1 AND (sbu IS NULL OR sbu = '-' OR batas_upload IS NULL OR batas_upload = '-')
        `;
        const params = [year];
        
        if (targetKds && targetKds.length > 0) {
            // Use individual IN parameters instead of ANY(array) to avoid
            // pg driver type casting issues with Supabase transaction pooler
            const placeholders = targetKds.map((_, i) => `$${i + 2}`).join(',');
            query += ` AND kd_lpse IN (${placeholders})`;
            targetKds.forEach(k => params.push(parseInt(k)));
        }
        
        query += ` ORDER BY crawled_at DESC`;

        const { rows } = await db.query(query, params);

        if (rows.length === 0) {
            this.log('Semua data tender sudah lengkap. Deep Scan dilewati.');
            return;
        }

        // Skip tenders whose deadline is already past — no need to complete them
        const filteredRows = rows.filter(r => {
            if (!r.batas_upload || r.batas_upload === '-') return true;
            return isDeadlineFuture(r.batas_upload);
        });
        const skipped = rows.length - filteredRows.length;
        if (skipped > 0) {
            this.log(`Melewati ${skipped} tender: batas upload sudah lewat.`);
        }

        if (filteredRows.length === 0) {
            this.log('Tidak ada tender dengan batas upload masih aktif. Deep Scan dilewati.');
            return;
        }

        this.log(`Ditemukan ${filteredRows.length} tender tanpa SBU/Deadline yang masih aktif. Melengkapi data dari halaman detail...`);

        // Group by slug to batch requests
        const bySlug = {};
        for (const r of filteredRows) {
            if (!r.slug) continue;
            if (!bySlug[r.slug]) bySlug[r.slug] = [];
            bySlug[r.slug].push(r.kode_tender);
        }

        const MAX_RETRIES = 2;
        let processed = 0;
        const totalSlugs = Object.keys(bySlug).length;

        for (const [slug, kodes] of Object.entries(bySlug)) {
            if (this.shouldStop) {
                this.log('Deep Scan dihentikan oleh user.');
                break;
            }
            processed++;
            this.log(`[${processed}/${totalSlugs}] Melengkapi ${kodes.length} paket di ${slug}...`);
            
            const baseUrl = getBaseUrl(slug);

            for (const kode of kodes) {
                if (this.shouldStop) break;

                let lastError = null;
                for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {

                    try {
                        const pengumumanUrl = `${baseUrl}/lelang/${kode}/pengumumanlelang`;
                        this.log(`Detail ${kode} (HTTP)...`);

                        // Try HTTP scraper first (axios+cheerio, near-zero memory)
                        let res = null;
                        try {
                            res = await httpDetailScraper(pengumumanUrl);
                        } catch (httpErr) {
                            this.log(`HTTP ${kode}: ${httpErr.message}`);
                        }

                        // Fall back to Playwright if HTTP failed and memory permits
                        if (!res) {
                            const freeMemMb = Math.round(os.freemem() / 1024 / 1024);
                            if (freeMemMb >= 100) {
                                this.log(`Playwright fallback for ${kode} (${freeMemMb}MB free)...`);
                                await tryFreeMemory();
                                res = await runScraper('detail', pengumumanUrl, String(year));
                            } else {
                                this.log(`Skip ${kode}: HTTP failed, memory too low (${freeMemMb}MB) for Playwright`);
                            }
                        }

                        if (res) {
                            const parsedPagu = parseCurrency(res.pagu);
                            const parsedHps = parseCurrency(res.hps);
                            const hasSbu = res.sbu && res.sbu !== '-';
                            const hasPagu = parsedPagu > 0;

                            if (hasSbu || hasPagu || res.batas_upload) {
                                const normDeadline = res.batas_upload ? res.batas_upload.replace(/\s+/g, ' ').trim() : null;
                                const result = await db.query(`
                                    UPDATE crawled_tenders 
                                    SET sbu = CASE WHEN $1::text IS NOT NULL AND $1::text != '-' THEN $1::text ELSE sbu END,
                                        pagu = CASE WHEN $2::bigint > 0 THEN $2::bigint ELSE pagu END,
                                        hps  = CASE WHEN $3::bigint > 0 THEN $3::bigint ELSE hps  END,
                                        batas_upload = CASE WHEN $4::text IS NOT NULL AND $4::text != '-' THEN $4::text ELSE batas_upload END
                                    WHERE kode_tender = $5 AND slug = $6
                                `, [res.sbu || null, parsedPagu, parsedHps, normDeadline, kode.trim(), slug]);
                                if (result.rowCount === 0) {
                                    this.log(`WARN: UPDATE matched 0 rows for kode=${kode.trim()} slug=${slug}`);
                                } else {
                                    this.log(`Saved ${kode}: SBU=${res.sbu || '-'} Pagu=${parsedPagu || '-'} Deadline=${normDeadline || '-'}`);
                                }
                            } else {
                                this.log(`Data empty ${kode}: SBU="${res.sbu}" Pagu="${res.pagu}"`);
                            }

                            if (this.status.newTendersMap && this.status.newTendersMap[kode]) {
                                const tenderInfo = this.status.newTendersMap[kode];
                                if (hasSbu) {
                                    const sbus = res.sbu.split(',').map(s => s.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                                    const matchesTarget = this.status.waTargetSbu.length === 0 || sbus.some(s => this.status.waTargetSbu.includes(s));
                                    const finalHps = parsedHps || tenderInfo.hps || 0;
                                    const maxHps = this.status.waTargetMaxHps || 0;
                                    const matchesHps = maxHps === 0 || finalHps <= maxHps;

                                    if (matchesTarget && matchesHps) {
                                        const normDeadline = res.batas_upload ? res.batas_upload.replace(/\s+/g, ' ').trim() : '-';
                                        const deadlineOk = isDeadlineFuture(normDeadline);
                                        if (!deadlineOk) {
                                            this.log(`Skip notif ${kode}: batas upload sudah lewat (${normDeadline})`);
                                        } else {
                                            const { sendWhatsAppMessage } = require('../utils/whatsapp');
                                            const formatRp = (v) => new Intl.NumberFormat('id-ID').format(v || 0);
                                            const aanwizingDate = res.aanwijzing_date || extractAanwizingDate(res.schedules) || '-';
                                            const msg = `*Tender Konstruksi Baru Terdeteksi* 🚀\n\n*Nama Paket:* ${tenderInfo.nama_paket}\n*SBU:* ${res.sbu}\n*Instansi:* ${tenderInfo.instansi}\n*Pagu:* Rp ${formatRp(parsedPagu || tenderInfo.pagu)}\n*HPS:* Rp ${formatRp(parsedHps || tenderInfo.hps)}\n*Batas Upload:* ${normDeadline}\n*Aanwijzing:* ${aanwizingDate}\n*LPSE:* ${tenderInfo.nama_lpse}\n\n⚠️ *Catatan:* Masih diperlukan cek alat, personil, dll secara manual di dokpil.`;
                                            sendWhatsAppMessage(null, msg).catch(() => {});
                                        }
                                    }
                                }
                                delete this.status.newTendersMap[kode];
                            }
                        } else {
                            this.log(`No result ${kode}: all scrapers failed`);
                        }

                        lastError = null;
                        break;
                    } catch (err) {
                        lastError = err;
                        const isWaf = err.message.includes('WAF') || err.message.includes('Akses Ditolak') || err.message.includes('timeout');
                        if (attempt < MAX_RETRIES && isWaf) {
                            this.log(`WAF/timeout ${kode} (${attempt}/${MAX_RETRIES}), retry...`);
                        } else if (attempt < MAX_RETRIES) {
                            this.log(`GAGAL ${kode} (${attempt}/${MAX_RETRIES}): ${err.message}`);
                        }
                    }
                }

                if (lastError) {
                    console.error(`[DeepScan] Error ${slug} ${kode}:`, lastError.message);
                }
            }
            await tryFreeMemory();
        }
        this.log('Deep Scan selesai.');
    }
}

const instance = new CrawlerService();
instance.httpDetailScraper = httpDetailScraper;
instance.httpListScraper = httpListScraper;
module.exports = instance;
