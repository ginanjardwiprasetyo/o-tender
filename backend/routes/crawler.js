/**
 * Crawler Routes
 */
const express = require('express');
const router = express.Router();
const crawler = require('../services/crawler');
const db = require('../config/db');

// Start crawl manually
router.post('/start', async (req, res) => {
    try {
        const year = req.body.year || new Date().getFullYear();
        // Start asynchronously, do not await
        crawler.crawlAllLPSE(year).catch(e => console.error('Crawl failed:', e));
        res.json({ success: true, message: 'Crawl started' });
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
        const { search, lpse, page = 1, limit = 20, sort = 'deadline_asc' } = req.query;
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

        // Sorting logic
        let orderBy = 'batas_upload ASC NULLS LAST, crawled_at DESC';
        if (sort === 'deadline_desc') {
            orderBy = 'batas_upload DESC NULLS LAST, crawled_at DESC';
        } else if (sort === 'crawled_at') {
            orderBy = 'crawled_at DESC';
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
