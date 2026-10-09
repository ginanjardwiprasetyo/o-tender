// Entry CLI crawl LPSE — dipakai GitHub Actions (.github/workflows/crawl-lpse.yml)
// Env (DATABASE_URL dsb) di-load otomatis oleh config/db.js dari backend/.env (lokal)
// atau dari environment GitHub Secrets (Actions).
const crawler = require('../services/crawler');
const db = require('../config/db');

const year = parseInt(process.argv[2]) || new Date().getFullYear();

// ponytail: retry DNS/connect sementara (EAI_AGAIN di GitHub runner)
async function waitDb(attempts = 12, delayMs = 10000) {
    for (let i = 1; i <= attempts; i++) {
        try {
            await db.query('SELECT 1');
            return;
        } catch (err) {
            if (i === attempts) throw err;
            console.warn(`[DB] connect gagal (${err.code || err.message}), retry ${i}/${attempts - 1}...`);
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
}

// Bersihkan baris 'running' sisa run yang mati (timeout/cancel) sebelum mulai
waitDb()
    .then(() => db.query("UPDATE crawl_logs SET finished_at = NOW(), status = 'error', error = 'Proses terhenti (runner berhenti)' WHERE status = 'running'").catch(() => {}))
    .then(() => crawler.crawlAllLPSE(year))
    .then(() => process.exit(crawler.status.error ? 1 : 0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
