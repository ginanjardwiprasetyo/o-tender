// Entry CLI crawl LPSE — dipakai GitHub Actions (.github/workflows/crawl-lpse.yml)
// Env (DATABASE_URL dsb) di-load otomatis oleh config/db.js dari backend/.env (lokal)
// atau dari environment GitHub Secrets (Actions).
const crawler = require('../services/crawler');
const db = require('../config/db');

const year = parseInt(process.argv[2]) || new Date().getFullYear();

// Bersihkan baris 'running' sisa run yang mati (timeout/cancel) sebelum mulai
db.query("UPDATE crawl_logs SET finished_at = NOW(), status = 'error', error = 'Proses terhenti (runner berhenti)' WHERE status = 'running'")
    .catch(() => {})
    .then(() => crawler.crawlAllLPSE(year))
    .then(() => process.exit(crawler.status.error ? 1 : 0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
