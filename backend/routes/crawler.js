/**
 * Crawler Routes
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');
const crawler = require('../services/crawler');
const db = require('../config/db');
const crawlerQueue = require('../services/crawler-queue');

// Extension task queue: pop next task
router.get('/task', (req, res) => {
    const task = crawlerQueue.popTask();
    if (task) {
        res.json({ success: true, data: task });
    } else {
        res.json({ success: false, data: null });
    }
});

// Extension task queue: submit result
router.post('/task-result', (req, res) => {
    const { taskId, data } = req.body;
    const found = crawlerQueue.submitResult(taskId, data);
    res.json({ success: found });
});

// Start crawl manually
router.post('/start', async (req, res) => {
    try {
        // Instance online (Render) tanpa Playwright — trigger GitHub Actions, crawl jalan di runner GitHub
        if (process.env.DISABLE_CRAWLER === 'true') {
            if (!process.env.GITHUB_TOKEN) {
                return res.status(503).json({ success: false, error: 'GITHUB_TOKEN belum dikonfigurasi di Render (Environment → variable GITHUB_TOKEN).' });
            }
            const gh = await axios.post(
                'https://api.github.com/repos/ginanjardwiprasetyo/o-tender/actions/workflows/crawl-lpse.yml/dispatches',
                { ref: 'main' },
                { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, timeout: 15000 }
            ).catch(e => {
                const d = e.response ? `HTTP ${e.response.status} ${JSON.stringify(e.response.data)}` : e.message;
                throw new Error('GitHub API: ' + d);
            });
            if (gh.status !== 204) throw new Error('GitHub API: HTTP ' + gh.status);
            return res.json({ success: true, message: 'Crawl dijalankan via GitHub Actions (±1–3 menit). Pantau di tab Actions GitHub: github.com/ginanjardwiprasetyo/o-tender/actions — hasil muncul di data yang sama.' });
        }
        const year = req.body.year || new Date().getFullYear();
        crawler.status.finishedAt = null;
        // Start asynchronously, do not await
        crawler.crawlAllLPSE(year).catch(e => console.error('Crawl failed:', e));
        res.json({ success: true, message: 'Crawl started' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Stop crawl
router.post('/stop', async (req, res) => {
    try {
        if (process.env.DISABLE_CRAWLER === 'true') {
            return res.json({ success: true, message: 'Instance online tidak menjalankan crawl lokal. Untuk menghentikan, buka tab Actions GitHub → run aktif → Cancel run.' });
        }
        crawler.stop();
        res.json({ success: true, message: 'Crawl stop requested' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get status
router.get('/status', async (req, res) => {
    try {
        const status = await crawler.getStatus();
        res.json({ success: true, data: status });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get crawled tenders
router.get('/tenders', async (req, res) => {
    try {
        const { search, lpse, page = 1, limit = 20, sort = 'deadline_desc' } = req.query;
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM crawled_tenders WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (search) {
            query += ` AND (nama_paket ILIKE $${paramIndex} OR instansi ILIKE $${paramIndex} OR kode_tender ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }
        if (lpse) {
            query += ` AND kd_lpse = $${paramIndex}`;
            params.push(parseInt(lpse));
            paramIndex++;
        }

        // Sorting logic — parse batas_upload text to proper date for sorting
        // Handle both ISO dates (2026-03-12) and Indonesian dates (12 Maret 2026)
        const dateExpr = `
            CASE
                WHEN batas_upload ~ '^\\d{4}-\\d{2}-\\d{2}' THEN batas_upload::timestamp
                WHEN batas_upload ~ '^\\d{1,2}\\s+\\w+\\s+\\d{4}' THEN
                    to_date(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
                    regexp_replace(regexp_replace(regexp_replace(regexp_replace(
                    regexp_replace(regexp_replace(regexp_replace(regexp_replace(
                        batas_upload,
                        'Januari', '01'),
                        'Februari', '02'),
                        'Maret', '03'),
                        'April', '04'),
                        'Mei', '05'),
                        'Juni', '06'),
                        'Juli', '07'),
                        'Agustus', '08'),
                        'September', '09'),
                        'Oktober', '10'),
                        'November', '11'),
                        'Desember', '12'),
                    'DD MM YYYY')
                ELSE NULL
            END
        `;
        let orderBy = `${dateExpr} DESC NULLS LAST, crawled_at DESC`;
        if (sort === 'deadline_asc') {
            orderBy = `${dateExpr} ASC NULLS LAST, crawled_at DESC`;
        }

        query += ` ORDER BY ${orderBy} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const { rows } = await db.query(query, params);
        
        // Count total
        let countQuery = 'SELECT COUNT(*) FROM crawled_tenders WHERE 1=1';
        const countParams = [];
        if (search) {
            countQuery += ` AND (nama_paket ILIKE $1 OR instansi ILIKE $1 OR kode_tender ILIKE $1)`;
            countParams.push(`%${search}%`);
        }
        if (lpse) {
            countQuery += ` AND kd_lpse = $${countParams.length + 1}`;
            countParams.push(parseInt(lpse));
        }
        const { rows: countRows } = await db.query(countQuery, countParams);

        res.json({ 
            success: true, 
            data: rows,
            pagination: {
                total: parseInt(countRows[0].count),
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
