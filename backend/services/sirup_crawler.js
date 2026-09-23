/**
 * SIRUP Crawler Service — Crawls RUP data from sirup.inaproc.id
 * HTTP-only (no Playwright needed — SIRUP returns DataTables JSON)
 */
const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../config/db');
const { resolveProvinceIds, getProvince } = require('../utils/sirup-lokasi');

const SIRUP_BASE = 'https://sirup.inaproc.id/sirup';

const CHROME_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Referer': 'https://sirup.inaproc.id/sirup/caripaketctr/index',
};

let _running = false;
let _stopRequested = false;
let _status = { state: 'idle', progress: '', logs: [], current: null, history: [] };

const MONTH_NAMES = {
    'januari': 1, 'februari': 2, 'maret': 3, 'april': 4, 'mei': 5, 'juni': 6,
    'juli': 7, 'agustus': 8, 'september': 9, 'oktober': 10, 'november': 11, 'desember': 12,
};

/**
 * Parse "Agustus 2026" → { bulan: 8, tahun: 2026 }
 * Also handles ranges "Mulai Akhir Oktober 2026 Desember 2026" → last month (end).
 */
function parseMonthYear(str) {
    if (!str) return null;
    const re = /(\w+)\s+(\d{4})/g;
    let m, last = null;
    while ((m = re.exec(str)) !== null) last = m;
    if (!last) return null;
    const bulan = MONTH_NAMES[last[1].toLowerCase()];
    const tahun = parseInt(last[2]);
    if (!bulan || !tahun) return null;
    return { bulan, tahun };
}

function log(msg) {
    const ts = new Date().toISOString().slice(11, 19);
    const line = `[${ts}] ${msg}`;
    _status.logs.push(line);
    if (_status.logs.length > 200) _status.logs.shift();
    console.log(`[SIRUP] ${msg}`);
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

/**
 * Initialize session: visit homepage, get cookies
 * Note: updatesk often returns 401 but search still works with homepage cookies
 * when DataTables columns[] params are included
 */
async function initSession() {
    const jar = {};

    const homeRes = await axios.get(`${SIRUP_BASE}/caripaketctr/index`, {
        headers: CHROME_HEADERS,
        maxRedirects: 5,
        timeout: 15000,
    });
    const setCookies = homeRes.headers['set-cookie'];
    if (setCookies) {
        for (const c of Array.isArray(setCookies) ? setCookies : [setCookies]) {
            const parts = c.split(';')[0].split('=');
            if (parts.length >= 2) jar[parts[0].trim()] = parts.slice(1).join('=').trim();
        }
    }

    // Try updatesk (may fail with 401, that's ok)
    const cookieStr = jarToStr(jar);
    try {
        await axios.post(`${SIRUP_BASE}/userctr/updatesk`, null, {
            headers: { ...CHROME_HEADERS, Cookie: cookieStr },
            timeout: 10000,
        });
    } catch {
        // Non-fatal: search works with homepage cookies + columns params
    }

    return jar;
}

/**
 * Build cookie string from jar object
 */
function jarToStr(jar) {
    return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

// SIRUP requires full DataTables column definitions or returns 0 records
const DATATABLES_COLUMNS = [
    { data: '', searchable: false, orderable: false },
    { data: 'paket', searchable: true, orderable: true },
    { data: 'pagu', searchable: true, orderable: true },
    { data: 'jenisPengadaan', searchable: true, orderable: true },
    { data: 'isPDN', searchable: true, orderable: true },
    { data: 'isUMK', searchable: true, orderable: true },
    { data: 'metode', searchable: true, orderable: true },
    { data: 'pemilihan', searchable: true, orderable: true },
    { data: 'kldi', searchable: true, orderable: true },
    { data: 'satuanKerja', searchable: true, orderable: true },
    { data: 'lokasi', searchable: true, orderable: true },
    { data: 'id', searchable: true, orderable: true },
];

function buildDataTablesParams(start, length) {
    const p = {};
    for (let i = 0; i < DATATABLES_COLUMNS.length; i++) {
        const col = DATATABLES_COLUMNS[i];
        p[`columns[${i}][data]`] = col.data;
        p[`columns[${i}][name]`] = '';
        p[`columns[${i}][searchable]`] = String(col.searchable);
        p[`columns[${i}][orderable]`] = String(col.orderable);
        p[`columns[${i}][search][value]`] = '';
        p[`columns[${i}][search][regex]`] = 'false';
    }
    p['order[0][column]'] = '5';
    p['order[0][dir]'] = 'DESC';
    p['search[value]'] = '';
    p['search[regex]'] = 'false';
    p.draw = '1';
    p.start = String(start);
    p.length = String(length);
    return p;
}

/**
 * Fetch one page of RUP list from SIRUP search API
 */
async function fetchListPage(jar, params, start = 0, length = 100) {
    const dtParams = buildDataTablesParams(start, length);
    const searchParams = new URLSearchParams(dtParams);
    searchParams.set('tahunAnggaran', params.tahunAnggaran || 2026);
    if (params.jenisPengadaan) searchParams.set('jenisPengadaan', params.jenisPengadaan);
    if (params.metodePengadaan) searchParams.set('metodePengadaan', params.metodePengadaan);
    if (params.minPagu) searchParams.set('minPagu', params.minPagu);
    if (params.maxPagu) searchParams.set('maxPagu', params.maxPagu);
    if (params.bulan) searchParams.set('bulan', params.bulan);
    if (params.lokasi) searchParams.set('lokasi', params.lokasi);
    if (params.kldi) searchParams.set('kldi', params.kldi);
    if (params.pdn) searchParams.set('pdn', params.pdn);
    if (params.ukm) searchParams.set('ukm', params.ukm);

    const url = `${SIRUP_BASE}/caripaketctr/search?${searchParams.toString()}`;
    const res = await axios.get(url, {
        headers: { ...CHROME_HEADERS, Cookie: jarToStr(jar) },
        timeout: 20000,
    });
    return res.data;
}

/**
 * Fetch detail page for a single RUP packet
 */
async function fetchDetail(jar, idPaket) {
    const url = `${SIRUP_BASE}/rup/detailPaketPenyedia2020?idPaket=${idPaket}`;
    const res = await axios.get(url, {
        headers: { ...CHROME_HEADERS, Cookie: jarToStr(jar) },
        timeout: 15000,
        maxRedirects: 3,
    });
    return res.data;
}

/**
 * Parse detail HTML and extract structured data
 * SIRUP detail pages have nested tables with key-value pairs.
 * We extract all row pairs aggressively, then deduplicate.
 */
function parseDetailHtml(html) {
    if (!html || html.includes('Form Login')) return null;
    const $ = cheerio.load(html);
    const raw = {};

    // 1) Extract every table row with 2+ cells (label + value pattern)
    $('table').each((_, table) => {
        $(table).find('tr').each((_, row) => {
            const cells = $(row).find('td');
            if (cells.length >= 2) {
                const key = $(cells[0]).text().trim().replace(/\s+/g, ' ');
                const val = $(cells[1]).text().trim().replace(/\s+/g, ' ');
                if (key && val && key.length < 80 && val.length < 2000) {
                    // Skip header rows, row indices, month-only keys, and raw multi-value fields
                    if (/^(No\.|Provinsi$|Kabupaten|Detail Lokasi$|Sumber Dana$|T\.A\.$|MAK$|Pagu$|Jenis Pengadaan$|Mulai$|Akhir$)/.test(key)) return;
                    if (/^\d+\.\s*:?\s*$/.test(key)) return; // row index like "1.:" or "1. "
                    if (/^(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+\d{4}$/.test(key)) return; // month+year from date cells
                    if (!raw[key]) raw[key] = val;
                }
            }
        });
    });

    // 2) Extract nested Mulai/Akhir tables (Jadwal Pemilihan Penyedia, Jadwal Pelaksanaan Kontrak, etc.)
    $('table.table').each((_, table) => {
        const headerRow = $(table).find('tr').first();
        const headers = [];
        headerRow.find('th, td').each((_, cell) => headers.push($(cell).text().trim()));
        if (headers.includes('Mulai') && headers.includes('Akhir')) {
            const dataRow = $(table).find('tr').slice(1).first();
            const cells = dataRow.find('td');
            if (cells.length >= 2) {
                const mulai = $(cells[0]).text().trim().replace(/\s+/g, ' ');
                const akhir = $(cells[1]).text().trim().replace(/\s+/g, ' ');
                // Find parent label
                const parentTd = $(table).closest('td').prev('.label-left');
                if (parentTd.length) {
                    const label = parentTd.text().trim();
                    if (mulai) raw[label + ' Mulai'] = mulai;
                    if (akhir) raw[label + ' Akhir'] = akhir;
                }
            }
        }
    });

    // 3) Extract from panel/card bodies
    $('.panel-body, .card-body, .detail-body').each((_, body) => {
        $(body).find('tr').each((_, row) => {
            const cells = $(row).find('td');
            if (cells.length >= 2) {
                const key = $(cells[0]).text().trim().replace(/\s+/g, ' ');
                const val = $(cells[1]).text().trim().replace(/\s+/g, ' ');
                if (key && val && key.length < 80 && val.length < 2000 && !raw[key]) {
                    raw[key] = val;
                }
            }
        });
    });

    // 3) Extract Lokasi Pekerjaan table (multi-column: Provinsi, Kab/Kota, Detail)
    const lokasiRows = [];
    $('table').each((_, table) => {
        const headers = [];
        $(table).find('tr').first().find('th, td').each((_, cell) => {
            headers.push($(cell).text().trim());
        });
        if (headers.includes('Provinsi') && headers.includes('Kabupaten/Kota')) {
            $(table).find('tr').slice(1).each((_, row) => {
                const cells = $(row).find('td');
                if (cells.length >= 3) {
                    const prov = $(cells[1]).text().trim();
                    const kab = $(cells[2]).text().trim();
                    const detail = cells.length >= 4 ? $(cells[3]).text().trim() : '';
                    if (prov && kab) {
                        lokasiRows.push({ provinsi: prov, kabupaten: kab, detail });
                    }
                }
            });
        }
    });
    if (lokasiRows.length) raw['_lokasi_rows'] = lokasiRows;

    // 4) Extract Sumber Dana table
    const sumberDanaRows = [];
    $('table').each((_, table) => {
        const headers = [];
        $(table).find('tr').first().find('th, td').each((_, cell) => {
            headers.push($(cell).text().trim());
        });
        if (headers.some(h => h.includes('Sumber Dana')) && headers.some(h => h.includes('MAK'))) {
            $(table).find('tr').slice(1).each((_, row) => {
                const cells = $(row).find('td');
                if (cells.length >= 5) {
                    const sumber = $(cells[1]).text().trim();
                    const ta = $(cells[2]).text().trim();
                    const klpd = $(cells[3]).text().trim();
                    const mak = $(cells[4]).text().trim();
                    const pagu = cells.length >= 6 ? $(cells[5]).text().trim() : '';
                    if (sumber && !sumber.includes('Total')) {
                        sumberDanaRows.push({ sumberDana: sumber, tahun: ta, klpd, mak, pagu });
                    }
                }
            });
        }
    });
    if (sumberDanaRows.length) raw['_sumber_dana_rows'] = sumberDanaRows;

    // Clean up: remove raw Lokasi Pekerjaan if we have structured rows
    if (lokasiRows.length && raw['Lokasi Pekerjaan']) delete raw['Lokasi Pekerjaan'];

    return Object.keys(raw).length > 0 ? raw : null;
}

/**
 * Upsert a single RUP record
 */
async function upsertRup(row, bulan, tahunAnggaran, detailData) {
    const kode = String(row.id || '').trim();
    if (!kode) return;

    const province = getProvince(String(row.idsLokasi || ''));
    const raw = typeof row === 'object' ? row : {};

    // Extract end month from detail_data
    let bulanAkhir = null;
    if (detailData) {
        const akhirKey = Object.keys(detailData).find(k => k.endsWith('Akhir') && k.startsWith('Jadwal Pemilihan'));
        const akhirVal = akhirKey ? detailData[akhirKey] : null;
        const parsed = parseMonthYear(akhirVal);
        if (parsed) bulanAkhir = parsed.bulan;
    }

    await db.query(`
        INSERT INTO sirup_rup (
            kode_paket, nama_paket, pagu, jenis_pengadaan,
            is_pdn, is_umk, metode, pemilihan,
            kldi, satuan_kerja, lokasi, lokasi_id,
            tahun_anggaran, bulan, bulan_akhir,
            detail_data, raw_data, crawled_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW(),NOW())
        ON CONFLICT (kode_paket) DO UPDATE SET
            nama_paket = EXCLUDED.nama_paket,
            pagu = EXCLUDED.pagu,
            jenis_pengadaan = EXCLUDED.jenis_pengadaan,
            is_pdn = EXCLUDED.is_pdn,
            is_umk = EXCLUDED.is_umk,
            metode = EXCLUDED.metode,
            pemilihan = EXCLUDED.pemilihan,
            kldi = EXCLUDED.kldi,
            satuan_kerja = EXCLUDED.satuan_kerja,
            lokasi = EXCLUDED.lokasi,
            lokasi_id = EXCLUDED.lokasi_id,
            bulan = EXCLUDED.bulan,
            bulan_akhir = COALESCE(EXCLUDED.bulan_akhir, sirup_rup.bulan_akhir),
            detail_data = COALESCE(EXCLUDED.detail_data, sirup_rup.detail_data),
            raw_data = EXCLUDED.raw_data,
            updated_at = NOW()
    `, [
        kode,
        row.paket || null,
        parseInt(row.pagu) || 0,
        row.jenisPengadaan || null,
        row.isPDN === true,
        row.isUMK === true,
        row.metode || null,
        row.pemilihan || null,
        row.kldi || null,
        row.satuanKerja || null,
        row.lokasi || null,
        String(row.idsLokasi || row.id || ''),
        tahunAnggaran,
        row.idBulan || bulan,
        bulanAkhir,
        detailData ? JSON.stringify(detailData) : null,
        JSON.stringify(raw),
    ]);
}

/**
 * Main crawl function
 * @param {Object} config - { provinsi: string[], bulan: number[], tahun: number, akhirBulan: number[] }
 *   akhirBulan: if set, fetch detail pages and only keep records where "Jadwal Pemilihan Penyedia" end month is in this list
 */
async function crawlAll(config = {}) {
    if (_running) {
        log('Crawl already running, skipping');
        return { success: false, error: 'Already running' };
    }

    _running = true;
    _stopRequested = false;
    _status = { state: 'running', progress: 'Initializing...', logs: [], current: null, history: [] };

    const tahun = config.tahun || new Date().getFullYear();
    const bulanList = config.bulan || [new Date().getMonth() + 1];
    const akhirBulanSet = config.akhirBulan && config.akhirBulan.length > 0
        ? new Set(config.akhirBulan.map(Number))
        : null;
    const fetchDetails = !!akhirBulanSet;
    const excludeList = (config.excludeWords || [])
        .map(w => String(w).trim().toLowerCase())
        .filter(Boolean);
    const provinsiList = config.provinsi && config.provinsi.length > 0
        ? config.provinsi
        : []; // no default - require explicit provinsi

    const lokasiIds = resolveProvinceIds(provinsiList);
    const jenisStr = config.jenisPengadaan && config.jenisPengadaan.length ? config.jenisPengadaan.join(',') : '2';
    log(`Starting crawl: tahun=${tahun}, bulan=[${bulanList}], akhirBulan=[${config.akhirBulan || 'none'}], jenis=[${jenisStr}], exclude=[${excludeList.join(', ') || 'none'}], provinsi=[${provinsiList.join(', ')}] (${lokasiIds.length} lokasi, detail=${fetchDetails})`);

    let totalFetched = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    try {
        const jar = await initSession();
        log('Session initialized');

        for (const bulan of bulanList) {
            if (_stopRequested) break;

            for (const lokasiId of lokasiIds) {
                if (_stopRequested) break;

                _status.progress = `Fetching lokasi ${lokasiId}, bulan ${bulan}...`;

                try {
                    // Fetch all pages for this lokasi+bulan
                    let start = 0;
                    let totalRecords = null;
                    const pageLength = 100;

                    // Support multiple jenisPengadaan (default: 2 for Konstruksi)
                    const jenisList = config.jenisPengadaan && config.jenisPengadaan.length > 0
                        ? config.jenisPengadaan
                        : ['2']; // default: only Konstruksi

                    for (const jenis of jenisList) {
                        if (_stopRequested) break;

                        // Reset pagination for each jenis
                        start = 0;
                        totalRecords = null;

                        while (true) {
                            if (_stopRequested) break;

                            const data = await fetchListPage(jar, {
                                tahunAnggaran: tahun,
                                jenisPengadaan: String(jenis),
                                bulan: String(bulan),
                                lokasi: String(lokasiId),
                            }, start, pageLength);

                            if (!data || !data.data) {
                                log(`No data for lokasi=${lokasiId} bulan=${bulan} jenis=${jenis}`);
                                break;
                            }

                            if (totalRecords === null) {
                                totalRecords = data.recordsTotal || 0;
                                if (totalRecords === 0) break;
                                log(`lokasi=${lokasiId} bulan=${bulan} jenis=${jenis}: ${totalRecords} records`);
                            }

                            const rows = data.data;
                            if (rows.length === 0) break;

                            // Process each row
                            for (const row of rows) {
                                if (_stopRequested) break;

                                try {
                                    const paketName = String(row.paket || row.nama || '').toLowerCase();
                                    if (excludeList.some(w => paketName.includes(w))) {
                                        totalSkipped++;
                                        continue; // excluded by user keyword
                                    }

                                    let detailData = null;

                                    if (fetchDetails) {
                                        // Fetch detail page to get "Jadwal Pemilihan Penyedia" end date
                                        const html = await fetchDetail(jar, row.id);
                                        detailData = parseDetailHtml(html);

                                        let akhirVal = null;
                                        if (detailData) {
                                            const akhirKey = Object.keys(detailData).find(k => k.endsWith('Akhir') && k.startsWith('Jadwal Pemilihan'));
                                            akhirVal = akhirKey ? detailData[akhirKey] : null;
                                        }
                                        // Fallback: list column "pemilihan"
                                        if (!akhirVal) akhirVal = row.pemilihan;
                                        const parsed = parseMonthYear(akhirVal);

                                        if (!parsed || !akhirBulanSet.has(parsed.bulan)) {
                                            totalSkipped++;
                                            continue; // skip: end month doesn't match
                                        }

                                        await sleep(300); // rate limit between detail fetches
                                    }

                                    await upsertRup(row, bulan, tahun, detailData);
                                    totalFetched++;
                                } catch (rowErr) {
                                    totalFailed++;
                                    log(`Failed to process ${row.id}: ${rowErr.message}`);
                                }
                            }

                            start += pageLength;
                            if (start >= totalRecords) break;

                            await sleep(500); // rate limit between pages
                        }
                    }
                } catch (locErr) {
                    totalFailed++;
                    log(`Error fetching lokasi ${lokasiId}: ${locErr.message}`);
                }

                await sleep(500); // rate limit between lokasi
            }
        }

        _status.state = 'completed';
        _status.progress = 'Done';
        log(`Crawl completed: ${totalFetched} fetched, ${totalSkipped} skipped (end month mismatch), ${totalFailed} failed`);

        const historyEntry = {
            finishedAt: new Date().toISOString(),
            tahun, bulan: bulanList, akhirBulan: config.akhirBulan, provinsi: provinsiList,
            excludeWords: excludeList,
            total: totalFetched, skipped: totalSkipped, failed: totalFailed,
        };
        _status.history.push(historyEntry);
        if (_status.history.length > 20) _status.history.shift();

        return { success: true, total: totalFetched, skipped: totalSkipped, failed: totalFailed };
    } catch (err) {
        _status.state = 'error';
        _status.progress = `Error: ${err.message}`;
        log(`Crawl failed: ${err.message}`);
        return { success: false, error: err.message };
    } finally {
        _running = false;
    }
}

function stop() {
    _stopRequested = true;
    log('Stop requested');
}

function getStatus() {
    return {
        ..._status,
        running: _running,
    };
}

module.exports = { crawlAll, stop, getStatus, initSession, fetchDetail, parseDetailHtml, parseMonthYear };
