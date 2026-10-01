// Entry CLI crawl LPSE — dipakai GitHub Actions (.github/workflows/crawl-lpse.yml)
// Env (DATABASE_URL dsb) di-load otomatis oleh config/db.js dari backend/.env (lokal)
// atau dari environment GitHub Secrets (Actions).
const crawler = require('../services/crawler');

const year = parseInt(process.argv[2]) || new Date().getFullYear();

crawler.crawlAllLPSE(year)
    .then(() => process.exit(crawler.status.error ? 1 : 0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
