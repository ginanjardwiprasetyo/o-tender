const express = require('express');
const router = express.Router();

const CRON_SECRET = process.env.CRON_SECRET || 'rahasia-default-ganti-di-produksi';

router.get('/check-notifications', async (req, res) => {
    try {
        if (req.query.secret !== CRON_SECRET) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { checkAndSendNotifications } = require('../services/notif_scheduler');
        await checkAndSendNotifications();

        res.json({ success: true, message: 'Notifikasi berhasil diperiksa', timestamp: new Date().toISOString() });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/ping', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
