/**
 * TenderBuild — Crawler Service
 * Crawls LKPP INAPROC API and stores data in Supabase
 */
const axios = require('axios');
const db = require('../config/db');
const { getSlug, getBaseUrl } = require('../utils/lpse-mapper');
const { exec } = require('child_process');
const util = require('util');
const os = require('os');
const execPromise = util.promisify(exec);
const { normalizeDate } = require('../utils/date-formatter');

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

async function runScraper(type, url, yearStr) {
    // Skip Playwright if memory is critically low (avoids OOM on Render free tier)
    const freeMemMb = Math.round(os.freemem() / 1024 / 1024);
    if (freeMemMb < 200) {
        const warnMsg = `Memory too low (${freeMemMb}MB free), skipping Playwright ${type}`;
        console.warn(`[Crawler] ${warnMsg}`);
        return type === 'list' ? [] : null;
    }
    const cmd = `node --max-old-space-size=256 /Applications/XAMPP/xamppfiles/htdocs/o-tender/backend/services/playwright_scraper.js --type ${type} --url "${url}" --year ${yearStr}`;
    const { stdout } = await execPromise(cmd, { maxBuffer: 10 * 1024 * 1024, timeout: 120000 });
    try {
        const lines = stdout.split('\n').filter(l => l.trim().startsWith('{') || l.trim().startsWith('['));
        if (lines.length > 0) {
            return JSON.parse(lines[lines.length - 1]);
        }
        return type === 'list' ? [] : null;
    } catch(e) {
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
    let clean = str.replace(/Rp/gi, '').replace(/\./g, '').replace(/\s/g, '');
    clean = clean.split(',')[0];
    return parseInt(clean, 10) || 0;
};

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
        // but a log is still 'running', mark it as 'error'
        if (this.status.state !== 'running') {
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
            const { data: allLpse } = await axios.get('https://isb.lkpp.go.id/isb-2/api/satudata/MasterLPSE', { timeout: 30000 });
            
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
            
            let lpseList = allLpse;
            if (targets && targets.length > 0) {
                const targetKds = targets.map(t => String(t.kd_lpse));
                lpseList = allLpse.filter(l => targetKds.includes(String(l.kd_lpse)));
            }
            
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
                // Short delay between LPSE crawls to let garbage collection run
                await new Promise(r => setTimeout(r, 800));
            }

            // 4. Run deep scan for missing SBU & deadlines
            this.log('Menjalankan Deep Scan untuk melengkapi data SBU & Batas Upload...');
            const targetKds = (targets && targets.length > 0) ? targets.map(t => String(t.kd_lpse)) : null;
            await this.deepScanMissingData(year, targetKds);

            // 5. Finish
            this.status.state = 'idle';
            this.status.finishedAt = new Date();
            this.log(`Crawl selesai! Total Tender: ${this.status.totalTenders}, Konstruksi: ${this.status.totalKonstruksi}`);

            await db.query(
                `UPDATE crawl_logs SET finished_at = NOW(), total_lpse = $1, total_tenders = $2, total_konstruksi = $3, status = 'success' WHERE id = $4`,
                [this.status.totalLpse, this.status.totalTenders, this.status.totalKonstruksi, this.status.logId]
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
        const url = `https://isb.lkpp.go.id/isb-2/api/satudata/TenderUmumPublik/${year}/${kd_lpse}`;
        try {
            const resp = await axios.get(url, { timeout: 15000 });
            let data = resp.data;
            if (typeof data === 'string' && data.includes('<invalid_response>')) return [];
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.warn(`[Crawler] API failed for ${kd_lpse}:`, err.message);
            return [];
        }
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
            return tenders.length;
        } catch (err) {
            console.error(`[Crawler] Failed for ${kd_lpse}:`, err.message);
            return 0;
        }
    }

    async deepScanMissingData(year, targetKds = null) {
        // Find all tenders from this year that are missing SBU or batas_upload
        let query = `
            SELECT kode_tender, slug FROM crawled_tenders 
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
        this.log(`Ditemukan ${rows.length} tender tanpa SBU/Deadline. Melengkapi data via Ekstensi Chrome...`);

        // Group by slug to batch requests
        const bySlug = {};
        for (const r of rows) {
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
            const listUrl = `${baseUrl}/lelang?kategoriId=2&tahun=${year}&instansiId=&rekanan=&kontrak_status=&kontrak_tipe=`;

            for (const kode of kodes) {
                if (this.shouldStop) break;

                let lastError = null;
                for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {

                    try {
                        const pengumumanUrl = `${baseUrl}/lelang/${kode}/pengumumanlelang`;
                        this.log(`Detail ${kode} (via list)...`);

                        // viaList: navigate to list page → click tender link → scrape detail
                        // This bypasses both Cloudflare and SPSE WAF by using real browser CSRF token
                        const res = await runScraper('detail', pengumumanUrl, String(year));

                        if (res) {
                            const parsedPagu = parseCurrency(res.pagu);
                            const parsedHps = parseCurrency(res.hps);
                            const hasSbu = res.sbu && res.sbu !== '-';
                            const hasPagu = parsedPagu > 0;

                            if (hasSbu || hasPagu || res.batas_upload) {
                                const normDeadline = res.batas_upload ? res.batas_upload.replace(/\s+/g, ' ').trim() : null;
                                await db.query(`
                                    UPDATE crawled_tenders 
                                    SET sbu = CASE WHEN $1::text IS NOT NULL AND $1::text != '-' THEN $1::text ELSE sbu END,
                                        pagu = CASE WHEN $2::bigint > 0 THEN $2::bigint ELSE pagu END,
                                        hps  = CASE WHEN $3::bigint > 0 THEN $3::bigint ELSE hps  END,
                                        batas_upload = CASE WHEN $4::text IS NOT NULL AND $4::text != '-' THEN $4::text ELSE batas_upload END
                                    WHERE kode_tender = $5 AND slug = $6
                                `, [res.sbu || null, parsedPagu, parsedHps, normDeadline, kode, slug]);
                                this.log(`Saved ${kode}: SBU=${res.sbu || '-'} Pagu=${parsedPagu || '-'} Deadline=${normDeadline || '-'}`);
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
                                            const aanwizingDate = extractAanwizingDate(res.schedules) || '-';
                                            const msg = `*Tender Konstruksi Baru Terdeteksi* 🚀\n\n*Nama Paket:* ${tenderInfo.nama_paket}\n*SBU:* ${res.sbu}\n*Instansi:* ${tenderInfo.instansi}\n*Pagu:* Rp ${formatRp(parsedPagu || tenderInfo.pagu)}\n*HPS:* Rp ${formatRp(parsedHps || tenderInfo.hps)}\n*Batas Upload:* ${normDeadline}\n*Aanwijzing:* ${aanwizingDate}\n*LPSE:* ${tenderInfo.nama_lpse}\n\n⚠️ *Catatan:* Masih diperlukan cek alat, personil, dll secara manual di dokpil.`;
                                            sendWhatsAppMessage(null, msg).catch(() => {});
                                        }
                                    }
                                }
                                delete this.status.newTendersMap[kode];
                            }
                        } else {
                            this.log(`No result ${kode}: extension returned null`);
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
        }
        this.log('Deep Scan selesai.');
    }
}

module.exports = new CrawlerService();
