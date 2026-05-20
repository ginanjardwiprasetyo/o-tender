/**
 * LKPP Routes — Proxy to LKPP ISB API for tender browsing
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../config/db');

const ISB_BASE = 'https://isb.lkpp.go.id/isb-2/api/satudata';
const { getSlug } = require('../utils/lpse-mapper');
const { parsePaguString } = require('../utils/parser');
const { scrapeTender, scrapeTenderList, scrapeMultiple } = require('../services/scraper');

// GET /api/lkpp/lpse — Get list of all LPSE
router.get('/lpse', async (req, res) => {
    try {
        const response = await axios.get(`${ISB_BASE}/MasterLPSE`, { timeout: 15000 });
        const data = Array.isArray(response.data) ? response.data : [];
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Gagal mengambil data LPSE: ' + err.message });
    }
});

// GET /api/lkpp/klpd — Get list of all KLPD
router.get('/klpd', async (req, res) => {
    try {
        const response = await axios.get(`${ISB_BASE}/MasterKLPD`, { timeout: 15000 });
        res.json({ success: true, data: response.data });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Gagal mengambil data KLPD: ' + err.message });
    }
});

// GET /api/lkpp/tenders?tahun=2026&kd_lpse=13 — Browse public tenders
router.get('/tenders', async (req, res) => {
    try {
        const { tahun, kd_lpse, lpse_name } = req.query;
        
        if (!tahun || !kd_lpse) {
            return res.status(400).json({ success: false, error: 'Parameter tahun dan kd_lpse wajib diisi' });
        }
        
        const url = `${ISB_BASE}/TenderUmumPublik/${tahun}/${kd_lpse}`;
        let data = [];
        try {
            const response = await axios.get(url, { timeout: 15000 });
            data = response.data;
            
            if (typeof data === 'string') {
                // Try to parse as JSON first (some endpoints return JSON as text)
                try {
                    data = JSON.parse(data);
                } catch {
                    // If it's CSV, parse it
                    data = parseCSV(data);
                }
            }
            
            // Handle case where API returns HTML error page or specific LKPP error tags
            if (typeof data === 'string' && (
                data.includes('<!DOCTYPE') || 
                data.includes('<html') || 
                data.includes('<invalid_response>') ||
                data.trim().startsWith('<')
            )) {
                console.warn(`[LKPP] API for LPSE ${kd_lpse} returned invalid/empty tag: ${data.substring(0, 50)}`);
                data = [];
            }
            
            // Ensure it's an array
            if (!Array.isArray(data)) {
                // Some endpoints return a single object instead of array
                if (data && typeof data === 'object' && !data.data) {
                    data = [data];
                } else if (data && data.data && Array.isArray(data.data)) {
                    data = data.data;
                } else {
                    data = [];
                }
            }
        } catch (apiErr) {
            console.warn(`[LKPP] API Call failed for ${kd_lpse}:`, apiErr.message);
            data = []; // Fallback to scraper below
        }

        // Detailed logging for debugging
        console.log(`[LKPP] Tahun: ${tahun}, LPSE: ${kd_lpse}, Count Raw: ${data.length}`);
        
        // Filter for construction tenders only (exclude consultancy)
        // Trust the LKPP API for year filtering — it already returns the right year
        const filtered = data.filter(t => {
            const possibleCats = [
                t['Kategori Pekerjaan'], t['kategori_pekerjaan'],
                t['Kategori'], t['kategori'],
                t['Jenis Pengadaan'], t['jenis_pengadaan']
            ].filter(v => v !== undefined && v !== null);
            const kategori = possibleCats.join(' ').toLowerCase();
            const nama = String(t['Nama Paket'] || t.nama_paket || t.nama || '').toLowerCase();
            const isKonstruksi = kategori.includes('konstruksi') || 
                                 nama.includes('pembangunan') || 
                                 nama.includes('rehabilitasi') ||
                                 nama.includes('renovasi') ||
                                 nama.includes('pemeliharaan') ||
                                 nama.includes('peningkatan') ||
                                 nama.includes('jalan') ||
                                 nama.includes('jembatan') ||
                                 nama.includes('gedung') ||
                                 nama.includes('irigasi') ||
                                 nama.includes('drainase') ||
                                 nama.includes('air bersih');
            const isKonsultansi = kategori.includes('konsultansi');
            return isKonstruksi && !isKonsultansi;
        });
        
        // Resolve slug: prefer lpse_name param, then data, then empty fallback
        let lpseName = lpse_name || '';
        if (!lpseName && data.length > 0) {
            lpseName = data[0]['LPSE'] || data[0].nama_lpse || '';
        }
        const slugGuess = getSlug(kd_lpse, lpseName);

        // If LKPP API has few/no results, always try scraping SPSE as fallback
        let finalResults = [...filtered];
        if (filtered.length === 0) {
            console.log(`[LKPP] API returned no construction tenders for ${kd_lpse} (${lpseName}). Trying scraper fallback...`);
            try {
                const scraped = await scrapeTenderList(slugGuess, tahun);
                if (scraped && scraped.length > 0) {
                    console.log(`[LKPP] Scraper fallback found ${scraped.length} tenders for ${slugGuess}`);
                    finalResults = scraped;
                } else {
                    console.log(`[LKPP] Scraper fallback also returned no results for ${slugGuess}`);
                }
            } catch (scrapeErr) {
                console.warn(`[LKPP] Scraper fallback failed for ${slugGuess}:`, scrapeErr.message);
                // Continue with empty results from API
            }
        }

        // Normalize all results — add per-tender slug, fix status/pagu
        finalResults = finalResults.map(t => {
            if (!t) return null;
            // Per-tender slug: derive from the tender's own LPSE, not the search LPSE
            const tenderKdLpse = t['Repo id LPSE'] || t.kd_lpse || kd_lpse;
            const tenderLpseName = t['LPSE'] || t.nama_lpse || lpseName;
            t['_slug'] = getSlug(String(tenderKdLpse), tenderLpseName);

            // Normalize status field
            const rawStatus = String(t['Status_Tender'] || t['Status Tender'] || t.status_tender || '');
            t['Status_Tender'] = rawStatus.replace(/\s*\[\.+\]\s*$/, '').trim() || '-';

            // Fix pagu
            let pagu = t['Pagu'] || t.pagu;
            if (typeof pagu === 'string') {
                t['Pagu'] = parsePaguString(pagu);
            } else if (typeof pagu === 'number') {
                // If number is too small, it might be corrupted/shorthand in a weird way
                if (pagu < 10000 && pagu > 0) {
                    const statusVal = String(t['Status Tender'] || t['Status_Tender'] || '');
                    const parsed = parsePaguString(statusVal);
                    if (parsed > 0) { t['Pagu'] = parsed; t['Status_Tender'] = '-'; }
                }
            } else {
                t['Pagu'] = 0;
            }

            return t;
        }).filter(Boolean);

        res.json({ 
            success: true, 
            data: finalResults,
            total_raw: data.length,
            total_filtered: finalResults.length,
            slug: slugGuess,
            source: finalResults.length > filtered.length ? 'API + Scraper' : 'API'
        });
    } catch (err) {
        console.error('[LKPP Error]', err.message);
        res.status(500).json({ success: false, error: 'Gagal mengambil data tender: ' + err.message });
    }
});

// GET /api/lkpp/scrape — Scrape detail from SPSE
router.get('/scrape', async (req, res) => {
    try {
        const { slug, kode } = req.query;
        if (!slug || !kode) return res.status(400).json({ success: false, error: 'Slug and kode required' });
        
        const data = await scrapeTender(slug, kode);
        
        // Sync the rich detailed data (real Pagu, HPS, SBU, Batas Upload) back to crawled_tenders DB row in the background
        const { details, sbu, uploadDate } = data;
        if (details) {
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
            const { normalizeDate } = require('../utils/date-formatter');
            
            const realPagu = parseCurrency(details['Nilai Pagu Paket'] || details['Pagu'] || 0);
            const realHps = parseCurrency(details['Nilai HPS Paket'] || details['HPS'] || 0);
            const normalizedDeadline = normalizeDate(uploadDate);
            
            db.query(`
                UPDATE crawled_tenders 
                SET pagu = CASE WHEN $1::bigint > 0 THEN $1::bigint ELSE pagu END,
                    hps  = CASE WHEN $2::bigint > 0 THEN $2::bigint ELSE hps  END,
                    sbu  = CASE WHEN $3::text IS NOT NULL AND $3::text != '-' THEN $3::text ELSE sbu END,
                    batas_upload = CASE WHEN $4::text IS NOT NULL AND $4::text != '-' THEN $4::text ELSE batas_upload END,
                    raw_data = jsonb_set(
                        jsonb_set(raw_data, '{Pagu}', to_jsonb($1::bigint)),
                        '{HPS}', to_jsonb($2::bigint)
                    )
                WHERE kode_tender = $5 AND slug = $6
            `, [realPagu, realHps, sbu || null, normalizedDeadline || null, kode, slug])
            .catch(err => console.error('[Scrape DB Sync Error]', err.message));
        }
        
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/lkpp/follow — Follow a tender (save to new followed_tenders table)
router.post('/follow', async (req, res) => {
    try {
        const tenderData = req.body;
        
        const tender = {
            kode_tender:      tenderData['Kode Tender'] || tenderData.kode_tender,
            nama_tender:      tenderData['Nama Paket'] || tenderData['Nama Tender'] || tenderData.nama_paket || tenderData.nama_tender,
            pagu:             parsePaguString(tenderData['Pagu'] || tenderData['Nilai Pagu Paket'] || tenderData.pagu),
            hps:              parsePaguString(tenderData['HPS'] || tenderData['Nilai HPS Paket'] || tenderData.hps),
            klpd:             tenderData['K/L/PD/Instansi Lainnya'] || tenderData['Instansi'] || tenderData.instansi || '',
            satuan_kerja:     tenderData['Satuan Kerja'] || tenderData.satker || '',
            tahun:            (() => {
                const rawYear = String(tenderData['Tahun Anggaran'] || tenderData.anggaran || tenderData.tahun || '');
                const match = rawYear.match(/\d{4}/);
                return match ? parseInt(match[0]) : new Date().getFullYear();
            })(),
            lokasi_pekerjaan: tenderData['Lokasi Pekerjaan'] || tenderData['Lokasi Paket'] || tenderData.lokasi_paket || '',
            slug:             tenderData['LPSE'] || tenderData.slug || '',
            deadline:         tenderData['Deadline'] || null,
            jadwal:           tenderData.jadwal || null
        };

        if (!tender.kode_tender || !tender.nama_tender) {
            return res.status(400).json({ success: false, error: 'Data tender tidak lengkap' });
        }
        
        // Cek duplikat
        const { rows: existing } = await db.query(
            'SELECT id FROM followed_tenders WHERE kode_tender = $1 LIMIT 1', [tender.kode_tender]
        );
        if (existing.length > 0) {
            return res.status(409).json({ success: false, error: 'Tender ini sudah diikuti' });
        }
        
        // Insert
        const fields = Object.keys(tender);
        const values = Object.values(tender);
        const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
        
        const { rows: savedRows } = await db.query(
            `INSERT INTO followed_tenders (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`,
            values
        );
        
        res.status(201).json({ success: true, data: savedRows[0] });
    } catch (err) {
        console.error('[Follow Error]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});



/**
 * Simple CSV parser for LKPP API responses
 */
/**
 * Robust CSV parser that handles quoted fields containing commas
 */
function parseCSV(csvText) {
    if (!csvText) return [];
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    // Regex to match CSV fields, including quoted strings
    const regex = /(".*?"|[^",]+)(?=\s*,|\s*$)/g;
    
    const headers = (lines[0].match(regex) || []).map(h => h.trim().replace(/^"|"$/g, ''));
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = (lines[i].match(regex) || []).map(v => v.trim().replace(/^"|"$/g, ''));
        const obj = {};
        headers.forEach((h, idx) => {
            obj[h] = values[idx] || '';
        });
        if (Object.keys(obj).length > 0) result.push(obj);
    }
    
    return result;
}

// GET /api/lkpp/deep-scan — Scrape SBU + upload deadline for multiple kodes in one browser session
router.get('/deep-scan', async (req, res) => {
    const { kodes, slug } = req.query;
    if (!kodes || !slug) return res.status(400).json({ success: false, error: 'Kodes and slug required' });

    const kodeList = kodes.split(',').filter(Boolean).slice(0, 20); // max 20
    console.log(`[DeepScan] Starting for ${kodeList.length} kodes on ${slug}`);

    try {
        const data = await scrapeMultiple(slug, kodeList);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/lkpp/jadwal-batch?slug=xxx&kodes=k1,k2,k3
// Fast batch fetch of Upload Dokumen Penawaran deadline via axios (no browser)
// Optimized with chunking to avoid rate limits
router.get('/jadwal-batch', async (req, res) => {
    const { slug, kodes } = req.query;
    if (!slug || !kodes) return res.status(400).json({ success: false, error: 'slug and kodes required' });

    const kodeList = kodes.split(',').filter(Boolean).slice(0, 50); // limit to 50
    const cheerio  = require('cheerio');
    const headers  = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9',
        'Referer': `https://spse.inaproc.id/${slug}/lelang?kategoriId=2`,
    };

    const results = {};
    const chunkSize = 5; // Fetch 5 at a time
    
    for (let i = 0; i < kodeList.length; i += chunkSize) {
        const chunk = kodeList.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (kode) => {
            try {
                const url = `https://spse.inaproc.id/${slug}/lelang/${kode}/jadwal`;
                const resp = await axios.get(url, { headers, timeout: 10000 });
                const $ = cheerio.load(resp.data);

                let deadline = null;
                $('table tr').each((_, row) => {
                    const cells = $(row).find('td');
                    if (cells.length < 4) return;
                    const stageName = $(cells[1]).text().trim().toLowerCase();
                    if (stageName.includes('upload dokumen penawaran') || stageName.includes('pemasukan penawaran')) {
                        deadline = $(cells[3]).text().trim() || null;
                    }
                });
                results[kode] = deadline;
            } catch (err) {
                console.warn(`[Batch] Failed for ${kode}:`, err.message);
                results[kode] = null;
            }
        }));
        if (i + chunkSize < kodeList.length) {
            await new Promise(r => setTimeout(r, 500)); // Pause between chunks
        }
    }

    res.json({ success: true, data: results });
});

module.exports = router;
