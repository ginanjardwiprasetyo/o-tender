/**
 * SIRUP Routes — RUP Crawling API
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const sirupCrawler = require('../services/sirup_crawler');
const { getProvincesWithCounts, resolveProvinceIds } = require('../utils/sirup-lokasi');

// GET /api/sirup/provinces — List all provinces with RUP counts
router.get('/provinces', async (req, res) => {
    try {
        const provinces = getProvincesWithCounts();
        const { rows } = await db.query(
            `SELECT lokasi_id, COUNT(*) as cnt FROM sirup_rup GROUP BY lokasi_id`
        );
        const countMap = {};
        for (const r of rows) countMap[r.lokasi_id] = parseInt(r.cnt);

        const result = provinces.map(p => {
            const lokasiIds = resolveProvinceIds([p.name]);
            const crawledCount = lokasiIds.reduce((sum, id) => sum + (countMap[id] || 0), 0);
            return { ...p, crawledCount };
        });

        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/sirup/metode — Unique metode values from crawled data
router.get('/metode', async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT DISTINCT metode FROM sirup_rup WHERE metode IS NOT NULL AND metode != '' ORDER BY metode`
        );
        res.json({ success: true, data: rows.map(r => r.metode) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/sirup/crawled-provinces — Unique province names from crawled data
router.get('/crawled-provinces', async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT DISTINCT SPLIT_PART(lokasi, ',', 1) as provinsi FROM sirup_rup WHERE lokasi IS NOT NULL AND lokasi != '' ORDER BY provinsi`
        );
        res.json({ success: true, data: rows.map(r => r.provinsi) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/sirup — List crawled RUP data with filters
router.get('/', async (req, res) => {
    try {
        const { provinsi, bulan, tahun, metode, search, filter_lokasi, exclude, page = 1, limit = 20 } = req.query;
        const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
        const lim = Math.min(100, Math.max(1, parseInt(limit) || 20));

        let where = ['1=1'];
        let params = [];
        let paramIdx = 1;

        if (provinsi) {
            const provArr = Array.isArray(provinsi) ? provinsi : provinsi.split(',');
            const lokasiIds = resolveProvinceIds(provArr);
            if (lokasiIds.length > 0) {
                where.push(`lokasi_id = ANY($${paramIdx})`);
                params.push(lokasiIds);
                paramIdx++;
            }
        }

        if (bulan) {
            const bulanArr = Array.isArray(bulan) ? bulan.map(Number) : bulan.split(',').map(Number);
            // Filter by end month (bulan_akhir) to match display; fallback to bulan if bulan_akhir is null
            where.push(`COALESCE(bulan_akhir, bulan) = ANY($${paramIdx})`);
            params.push(bulanArr);
            paramIdx++;
        }

        if (tahun) {
            where.push(`tahun_anggaran = $${paramIdx}`);
            params.push(parseInt(tahun));
            paramIdx++;
        }

        if (metode) {
            where.push(`metode ILIKE $${paramIdx}`);
            params.push(`%${metode}%`);
            paramIdx++;
        }

        if (search) {
            const words = search.trim().split(/\s+/).filter(Boolean);
            if (words.length) {
                const conditions = words.map((_, i) => `(nama_paket ILIKE $${paramIdx + i} OR kldi ILIKE $${paramIdx + i} OR satuan_kerja ILIKE $${paramIdx + i})`);
                where.push(conditions.join(' AND '));
                words.forEach(w => { params.push(`%${w}%`); });
                paramIdx += words.length;
            }
        }

        if (exclude) {
            // Support multi-word phrases via | separator (legacy: space-separated single words)
            let exWords;
            try {
                const parsed = JSON.parse(exclude);
                exWords = Array.isArray(parsed) ? parsed : [exclude];
            } catch {
                exWords = exclude.includes('|')
                    ? exclude.split('|')
                    : exclude.trim().split(/\s+/);
            }
            exWords = exWords.map(w => String(w).trim()).filter(Boolean);
            exWords.forEach(w => {
                where.push(`nama_paket NOT ILIKE $${paramIdx}`);
                params.push(`%${w}%`);
                paramIdx++;
            });
        }

        if (filter_lokasi) {
            // Match full lokasi (provinsi + kota) or just the province segment
            where.push(`(lokasi ILIKE $${paramIdx} OR SPLIT_PART(lokasi, ',', 1) ILIKE $${paramIdx})`);
            params.push(`%${filter_lokasi}%`);
            paramIdx++;
        }

        const whereClause = where.join(' AND ');
        const countQuery = `SELECT COUNT(*) FROM sirup_rup WHERE ${whereClause}`;

        // Sort: whitelist columns to prevent injection
        const allowedSort = new Set(['nama_paket','pagu','metode','pemilihan','lokasi','bulan','tahun_anggaran','crawled_at','kode_paket']);
        let sortCol = req.query.sort && allowedSort.has(req.query.sort) ? req.query.sort : 'crawled_at';
        const sortDir = req.query.dir === 'asc' ? 'ASC' : 'DESC';
        // pemilihan displays end month; sort by bulan_akhir (end month number), fallback to bulan
        if (sortCol === 'pemilihan') sortCol = 'COALESCE(bulan_akhir, bulan)';

        const dataQuery = `SELECT * FROM sirup_rup WHERE ${whereClause} ORDER BY ${sortCol} ${sortDir} LIMIT ${lim} OFFSET ${offset}`;

        const [countResult, dataResult] = await Promise.all([
            db.query(countQuery, params),
            db.query(dataQuery, params),
        ]);

        res.json({
            success: true,
            data: dataResult.rows,
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page),
            limit: lim,
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/sirup/stats — Summary statistics
router.get('/stats', async (req, res) => {
    try {
        const { tahun = 2026 } = req.query;
        const { rows } = await db.query(`
            SELECT
                COUNT(*) as total_paket,
                COALESCE(SUM(pagu), 0) as total_pagu,
                COUNT(DISTINCT lokasi_id) as total_lokasi,
                COUNT(DISTINCT metode) as total_metode,
                COUNT(DISTINCT bulan) as total_bulan
            FROM sirup_rup
            WHERE tahun_anggaran = $1
        `, [parseInt(tahun)]);

        const { rows: byMetode } = await db.query(`
            SELECT metode, COUNT(*) as count, COALESCE(SUM(pagu), 0) as pagu
            FROM sirup_rup
            WHERE tahun_anggaran = $1
            GROUP BY metode ORDER BY count DESC
        `, [parseInt(tahun)]);

        const { rows: byBulan } = await db.query(`
            SELECT bulan, COUNT(*) as count, COALESCE(SUM(pagu), 0) as pagu
            FROM sirup_rup
            WHERE tahun_anggaran = $1
            GROUP BY bulan ORDER BY bulan
        `, [parseInt(tahun)]);

        res.json({
            success: true,
            data: { summary: rows[0], byMetode, byBulan },
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/sirup/status — Crawl status (MUST be before /:kode_paket)
router.get('/status', (req, res) => {
    res.json({ success: true, data: sirupCrawler.getStatus() });
});

// POST /api/sirup/crawl — Trigger crawl
router.post('/crawl', async (req, res) => {
    try {
        const { provinsi = [], bulan, tahun, akhirBulan, jenisPengadaan, excludeWords } = req.body;
        const akhirBulanArr = akhirBulan ? (Array.isArray(akhirBulan) ? akhirBulan.map(Number) : [Number(akhirBulan)]) : null;
        const jenisArr = jenisPengadaan ? (Array.isArray(jenisPengadaan) ? jenisPengadaan.map(String) : [String(jenisPengadaan)]) : ['2'];
        const excludeArr = Array.isArray(excludeWords)
            ? excludeWords
            : (excludeWords ? String(excludeWords).split('|') : []);
        const bulanArr = bulan
            ? (Array.isArray(bulan) ? bulan.map(Number) : [Number(bulan)])
            : [new Date().getMonth() + 1];
        sirupCrawler.crawlAll({
            provinsi: Array.isArray(provinsi) ? provinsi : [provinsi],
            bulan: bulanArr,
            tahun: tahun || new Date().getFullYear(),
            akhirBulan: akhirBulanArr,
            jenisPengadaan: jenisArr,
            excludeWords: excludeArr,
        }).catch(e => console.error('[SIRUP] Crawl error:', e));
        res.json({ success: true, message: 'SIRUP crawl started' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/sirup/crawl/stop — Stop crawl
router.post('/crawl/stop', (req, res) => {
    try {
        sirupCrawler.stop();
        res.json({ success: true, message: 'Stop requested' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/sirup/status — Crawl status (MUST be before /:kode_paket catch-all)
router.get('/status', (req, res) => {
    try {
        const status = sirupCrawler.getStatus();
        res.json({ success: true, data: status });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/sirup/:kode_paket — Single RUP detail (MUST be last — catch-all)
router.get('/:kode_paket', async (req, res) => {
    try {
        const kode = req.params.kode_paket;
        let { rows } = await db.query(
            'SELECT * FROM sirup_rup WHERE kode_paket = $1',
            [kode]
        );

        // Auto-import: some RUP exist only on detail page, not in search API
        if (rows.length === 0) {
            try {
                const { initSession, fetchDetail, parseDetailHtml, parseMonthYear } = require('../services/sirup_crawler');
                const jar = await initSession();
                const html = await fetchDetail(jar, kode);
                const detail = parseDetailHtml(html);
                if (detail && detail['Nama Paket']) {
                    const mulai = parseMonthYear(detail['Jadwal Pemilihan Penyedia Mulai']);
                    const akhir = parseMonthYear(detail['Jadwal Pemilihan Penyedia Akhir']);
                    const lr = (detail._lokasi_rows || [])[0] || {};
                    const prov = lr.provinsi || '';
                    const kab = lr.kabupaten || '';
                    const lokasi = [prov, kab].filter(Boolean).join(', ');
                    const { PROVINCE_LOKASI } = require('../utils/sirup-lokasi');
                    const lokasiIds = PROVINCE_LOKASI[prov] || [];
                    const pagu = parseInt(String(detail['Total Pagu'] || '0').replace(/[^\d]/g, '')) || 0;
                    const satkerFull = detail['Satuan Kerja'] || '';
                    const satkerParts = satkerFull.split('/');
                    const kldi = satkerParts[0] ? satkerParts[0].trim() : null;
                    const satuanKerja = satkerParts.length > 1 ? satkerParts.slice(1).join('/').trim() : satkerFull;

                    await db.query(`
                        INSERT INTO sirup_rup (
                            kode_paket, nama_paket, pagu, jenis_pengadaan,
                            is_pdn, is_umk, metode, pemilihan,
                            kldi, satuan_kerja, lokasi, lokasi_id,
                            tahun_anggaran, bulan, bulan_akhir,
                            detail_data, detail_html, raw_data, crawled_at, updated_at
                        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW(),NOW())
                        ON CONFLICT (kode_paket) DO UPDATE SET
                            detail_data = COALESCE(EXCLUDED.detail_data, sirup_rup.detail_data),
                            detail_html = COALESCE(EXCLUDED.detail_html, sirup_rup.detail_html),
                            updated_at = NOW()
                    `, [
                        kode,
                        detail['Nama Paket'],
                        pagu,
                        detail['Jenis Pengadaan'] || 'Pekerjaan Konstruksi',
                        !!detail['Produk Dalam Negeri'],
                        !!detail['Usaha Kecil/Koperasi'],
                        detail['Metode Pemilihan'] || null,
                        detail['Jadwal Pemilihan Penyedia Mulai'] || null,
                        kldi,
                        satuanKerja,
                        lokasi || null,
                        lokasiIds[0] || kode,
                        parseInt(detail['Tahun Anggaran']) || new Date().getFullYear(),
                        mulai ? mulai.bulan : null,
                        akhir ? akhir.bulan : null,
                        JSON.stringify(detail),
                        html,
                        JSON.stringify({ source: 'detail_page_only' }),
                    ]);
                    ({ rows } = await db.query('SELECT * FROM sirup_rup WHERE kode_paket = $1', [kode]));
                }
            } catch {
                // fall through to 404
            }
        }

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'RUP not found' });
        }

        const rup = rows[0];

        if (!rup.detail_data && rup.kode_paket) {
            try {
                const { initSession, fetchDetail, parseDetailHtml } = require('../services/sirup_crawler');
                const jar = await initSession();
                const html = await fetchDetail(jar, rup.kode_paket);
                const detail = parseDetailHtml(html);
                if (detail) {
                    await db.query(
                        'UPDATE sirup_rup SET detail_data = $1, detail_html = $2 WHERE kode_paket = $3',
                        [JSON.stringify(detail), html, rup.kode_paket]
                    );
                    rup.detail_data = detail;
                }
            } catch {
                // Non-fatal
            }
        }

        res.json({ success: true, data: rup });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
