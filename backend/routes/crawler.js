/**
 * Crawler Routes
 */
const express = require('express');
const router = express.Router();
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
