/**
 * TenderBuild — Express Server
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const fs = require('fs');
const db = require('./config/db');
const cron = require('node-cron');
const crawler = require('./services/crawler');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(compression());   // gzip — asset JS/CSS ~1MB → ~200KB
app.use(express.json({ limit: '100gb' }));
app.use(express.urlencoded({ limit: '100gb', extended: true }));

// ── Static Files ─────────────────────────────────────────────
// URL ber "?v=N" (versi manual di index.html) → cache 1 tahun immutable: tak ada
// re-download tiap kunjungan; versi lama tetap aman karena URL-nya berubah.
// URL tanpa ?v= → no-cache (perubahan selalu tampil, tanpa cache-bust manual).
// path frontend: monorepo = sibling ../frontend; Docker (context ./backend) = /app/frontend (di dalam __dirname)
const FRONTEND_DIR = fs.existsSync(path.join(__dirname, 'frontend'))
    ? path.join(__dirname, 'frontend')
    : path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR, {
    setHeaders: (res, filePath) => {
        if (!/\.(js|css)$/.test(filePath)) return;
        if (/[?&]v=/.test(res.req.originalUrl || res.req.url)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        else res.setHeader('Cache-Control', 'no-cache');
    }
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/migrations', express.static(path.join(__dirname, 'migrations')));

// ─── API Auth (cookie session) ───────────────────────────────
// penanda versi = hash isi kode (server.js + frontend js/css/html) — hanya berubah saat
// deploy, TIDAK saat cold start (Date.now() bikin toast "aplikasi diperbarui" muncul terus)
const crypto = require('crypto');
const _verHash = crypto.createHash('sha1');
const _walkVer = (dir) => {
    if (!fs.existsSync(dir)) return; // container: frontend ada di /app/frontend (bukan sibling) → skip bila tidak ada
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) _walkVer(p);
        else if (/\.(js|css|html)$/.test(f.name)) _verHash.update(fs.readFileSync(p));
    }
};
_walkVer(FRONTEND_DIR);
_verHash.update(fs.readFileSync(__filename));
const APP_VER = _verHash.digest('hex').slice(0, 12);
app.use('/api', (req, res, next) => { res.setHeader('X-App-Ver', APP_VER); next(); });
const { requireAuth, requireWrite } = require('./utils/auth');
app.use('/api', requireAuth, requireWrite);
app.use('/api/auth', require('./routes/auth'));

// ─── API Routes ───────────────────────────────────────────────
app.use('/api/equipments', require('./routes/equipments'));
app.use('/api/rkk',         require('./routes/rkk'));
app.use('/api/personnel',  require('./routes/personnel'));
app.use('/api/companies',  require('./routes/companies'));
app.use('/api/uploads',    require('./routes/uploads'));
app.use('/api/tenders',    require('./routes/tenders'));
app.use('/api/lkpp',       require('./routes/lkpp'));
app.use('/api/followed',   require('./routes/followed'));
app.use('/api/crawler',    require('./routes/crawler'));
app.use('/api/schedules',  require('./routes/schedules'));
app.use('/api/templates',  require('./routes/templates'));
app.use('/api/documents',  require('./routes/documents'));
app.use('/api/letters',    require('./routes/letters'));
app.use('/api/settings',   require('./routes/settings'));
app.use('/api/cron',       require('./routes/cron'));
app.use('/api/dokpil',       require('./routes/dokpil'));
// ONLYOFFICE_DULU_DIMATIKAN — route OnlyOffice dinonaktifkan (edit template via CKEditor). Aktifkan lagi: uncomment 2 baris terkait onlyoffice di file ini
// app.use('/api/onlyoffice', require('./routes/onlyoffice'));
app.use('/api/sirup',      require('./routes/sirup'));

// ─── Health Check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: 'TenderBuild', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ─── Statistik publik untuk layar login (tanpa auth) ─────────
app.get('/api/public-stats', async (req, res) => {
    // ponytail: counts murah per tampil login; gagal → nol agar login tak pernah rusak
    const out = { tercrawling: 0, diikuti: 0, nilai_kontrak: 0, jml_sbu: 0 };
    try {
        const db = require('./config/db');
        const c1 = await db.query('SELECT COUNT(*)::int AS n FROM crawled_tenders');
        out.tercrawling = c1.rows[0].n;
        const c2 = await db.query('SELECT COUNT(*)::int AS n, COALESCE(SUM(pagu::numeric), 0) AS pagu FROM followed_tenders');
        out.diikuti = c2.rows[0].n;
        out.nilai_kontrak = Number(c2.rows[0].pagu) || 0;
        const c3 = await db.query('SELECT kbli FROM companies WHERE kbli IS NOT NULL');
        const sbu = new Set();
        c3.rows.forEach(r => String(r.kbli).split(',').forEach(k => { const s = k.trim(); if (s) sbu.add(s); }));
        out.jml_sbu = sbu.size;
    } catch (e) { console.warn('[public-stats]', e.message); }
    res.json({ success: true, data: out });
});

// ─── DB Status & Auto-Migration ───────────────────────────────
app.get('/api/db-status', async (req, res) => {
    try {
        await db.query('SELECT 1 FROM settings LIMIT 1');
        res.json({ ok: true });
    } catch (err) {
        const needsMigration = err.message.includes('does not exist') || err.message.includes('schema cache');
        const projectRef = (process.env.SUPABASE_URL || '').replace('https://', '').split('.')[0];
        res.json({
            ok: false,
            needs_migration: needsMigration,
            error: err.message,
            migration_url: `https://supabase.com/dashboard/project/${projectRef}/sql/new`,
            project_ref: projectRef
        });
    }
});

// POST /api/db-migrate — Jalankan migration otomatis via connection string
app.post('/api/db-migrate', async (req, res) => {
    try {
        const sqlPath = path.join(__dirname, 'migrations', '001_init.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await db.runMigration(sql);
        res.json({ success: true, message: 'Migration berhasil dijalankan!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── Security: blok akses direct ke path sirup → 404 elegan ──
const send404 = (res) => {
    const p = path.join(FRONTEND_DIR, '404.html');
    if (fs.existsSync(p)) return res.status(404).sendFile(p);
    res.status(404).send('Not Found');
};
app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api')) return next();
    const p = req.path;
    // root uploads (error Supabase invalidkey) + /uploads/sirup/*, /sirup/*, dll
    if (
        p === '/uploads' ||
        p === '/uploads/' ||
        /^\/uploads\/sirup(\/|$)/.test(p) ||
        /^\/sirup(\/|$)/.test(p) ||
        /^\/\/uploads\/sirup(\/|$)/.test(p) ||
        /\/[^/]+\/sirup(\/|$)/.test(p) ||
        /\/[^/]+\/[^/]+\/sirup(\/|$)/.test(p)
    ) {
        return send404(res);
    }
    next();
});

// ─── SPA Fallback ─────────────────────────────────────────────
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        // path API tak dikenal → 404 (jangan diam / hang)
        return res.status(404).json({ success: false, error: 'Not Found' });
    }
    const indexPath = path.join(FRONTEND_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.json({
            success: true,
            message: "TenderBuild API Server is running successfully.",
            timestamp: new Date().toISOString()
        });
    }
});

// ─── Error Handler ───────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[Server Error]', err.stack);
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
});

// ─── Start Server ─────────────────────────────────────────────
app.listen(PORT, async () => {
    console.log(`
╔══════════════════════════════════════════════╗
║   🏗️  TenderBuild Server v1.0.0              ║
║   📍 http://localhost:${PORT}                  ║
║   🔧 Mode: ${process.env.NODE_ENV || 'development'}                  ║
╚══════════════════════════════════════════════╝
    `);

    // Test DB connection & auto-migrate
    const connected = await db.testConnection();
    if (connected) {
        try {
            await db.query('SELECT 1 FROM settings LIMIT 1');
            console.log('✅ Database tables OK');
        } catch {
            console.log('⚠️  Tabel belum ada, menjalankan migration otomatis...');
            try {
                const sqlPath = path.join(__dirname, 'migrations', '001_init.sql');
                const sql = fs.readFileSync(sqlPath, 'utf8');
                await db.runMigration(sql);
                console.log('✅ Migration berhasil! Semua tabel sudah dibuat.');
            } catch (migErr) {
                console.error('❌ Migration gagal:', migErr.message);
                console.log('   Jalankan manual: node backend/scratch/run-migration.js');
            }
        }
        
        // Self-healing: Tambahkan kolom notifikasi di followed_tenders jika belum ada
        try {
            await db.query(`
                ALTER TABLE followed_tenders ADD COLUMN IF NOT EXISTS notif_penjelasan_sent BOOLEAN DEFAULT FALSE;
                ALTER TABLE followed_tenders ADD COLUMN IF NOT EXISTS notif_upload_sent BOOLEAN DEFAULT FALSE;
                ALTER TABLE followed_tenders ADD COLUMN IF NOT EXISTS notif_pemenang_sent BOOLEAN DEFAULT FALSE;
            `);
            console.log('✅ Kolom notifikasi followed_tenders OK');
        } catch (colErr) {
            console.warn('⚠️ Gagal menambahkan kolom notifikasi followed_tenders:', colErr.message);
        }

        // Self-healing: "Lembaga Pendidikan" jadi opsional (riwayat pendidikan bisa
        // diisi sebagian) → lepaskan NOT NULL di education_history.lembaga
        try {
            await db.query('ALTER TABLE education_history ALTER COLUMN lembaga DROP NOT NULL;');
            console.log('✅ education_history.lembaga nullable OK');
        } catch (colErr) {
            console.warn('⚠️ Gagal melepas NOT NULL education_history.lembaga:', colErr.message);
        }

        // Self-healing: Enable RLS deny-all (backend via DATABASE_URL = postgres owner/bypass)
        // Jangan pakai 010_disable_rls lagi — bikin linter Supabase error terus
        try {
            const rlsPath = path.join(__dirname, 'migrations', '012_enable_rls_deny_all.sql');
            if (fs.existsSync(rlsPath)) {
                const rlsSql = fs.readFileSync(rlsPath, 'utf8');
                await db.runMigration(rlsSql);
                console.log('✅ RLS enabled (deny-all) on all public tables');
            }
        } catch (rlsErr) {
            console.warn('⚠️ RLS migration skipped:', rlsErr.message);
        }
    }

    // ONLYOFFICE_DULU_DIMATIKAN — auto-start DocumentServer dimatikan (juga uncomment app.use '/api/onlyoffice' di atas)
    // try { require('./routes/onlyoffice').ensureOnlyOffice(); } catch {}

    // Schedule Crawler (6 AM and 4 PM) - Can be disabled via env DISABLE_CRAWLER=true (e.g. for Render.com instance)
    const disableCrawler = process.env.DISABLE_CRAWLER === 'true';
    if (!disableCrawler) {
        cron.schedule('0 6 * * *', () => {
            console.log('Running scheduled crawl (6 AM)');
            crawler.crawlAllLPSE(new Date().getFullYear()).catch(e => console.error(e));
        });
        cron.schedule('0 16 * * *', () => {
            console.log('Running scheduled crawl (4 PM)');
            crawler.crawlAllLPSE(new Date().getFullYear()).catch(e => console.error(e));
        });
        console.log('📅 [Scheduler] Crawler scheduled at 6 AM and 4 PM');
    } else {
        console.log('🚫 [Scheduler] Crawler is disabled on this instance (DISABLE_CRAWLER = true)');
    }

    // Schedule SIRUP Crawl (7 AM daily) — config from settings table (synced online/local)
    const sirupCrawler = require('./services/sirup_crawler');
    cron.schedule('0 7 * * *', async () => {
        console.log('Running scheduled SIRUP crawl (7 AM)');
        try {
            const { rows } = await db.query(
                `SELECT key, value FROM settings WHERE key IN ('sirup_provinsi', 'sirup_bulan', 'sirup_akhir_bulan', 'sirup_exclude_words')`
            );
            const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));
            let provinsi = [];
            try { provinsi = cfg.sirup_provinsi ? JSON.parse(cfg.sirup_provinsi) : []; } catch {}
            let bulan = [];
            try { bulan = cfg.sirup_bulan ? JSON.parse(cfg.sirup_bulan) : []; } catch {}
            let akhirBulan = [];
            try { akhirBulan = cfg.sirup_akhir_bulan ? JSON.parse(cfg.sirup_akhir_bulan) : []; } catch {}
            let excludeWords = [];
            try { excludeWords = cfg.sirup_exclude_words ? JSON.parse(cfg.sirup_exclude_words) : []; } catch {}
            if (!provinsi.length) return; // no default - skip if not configured
            if (!bulan.length) bulan = [new Date().getMonth() + 1];
            sirupCrawler.crawlAll({
                provinsi,
                bulan,
                akhirBulan: akhirBulan.length ? akhirBulan : undefined,
                excludeWords,
            }).catch(e => console.error(e));
        } catch (e) {
            console.error('[SIRUP cron]', e);
        }
    });
    console.log('📅 [Scheduler] SIRUP crawl scheduled at 7 AM');

    // Schedule WA notifications check for Followed Tenders (every 15 minutes)
    const { checkAndSendNotifications } = require('./services/notif_scheduler');
    console.log('⏰ [Scheduler] Memulai pengecekan awal notifikasi diikuti...');
    checkAndSendNotifications().catch(e => console.error(e));

    cron.schedule('*/15 * * * *', () => {
        checkAndSendNotifications().catch(e => console.error(e));
    });

    // Auto-sync template Google Docs (tiap 15 menit + saat start) — incremental, hanya file berubah
    if (process.env.GDRIVE_TEMPLATE_FOLDER) {
        const { syncFolderTemplates } = require('./services/gdoc_sync');
        const runGdocSync = () => syncFolderTemplates().then(r => {
            if (r.added || r.updated || r.removed) console.log(`📄 [GDoc Sync] +${r.added} ~${r.updated} -${r.removed} dari ${r.total} file`);
        }).catch(e => console.error('[GDoc Sync]', e.message));
        runGdocSync();
        cron.schedule('*/15 * * * *', runGdocSync);
        console.log('📄 [Scheduler] GDocs template sync setiap 15 menit');
    }

    // Supabase Keep-Alive: Ping database every 12 hours to prevent auto-pause of free tier projects
    cron.schedule('0 */12 * * *', async () => {
        console.log('⏰ [Supabase Keep-Alive] Mengirim ping database...');
        try {
            await db.query('SELECT 1');
            console.log('✅ [Supabase Keep-Alive] Ping database sukses!');
        } catch (err) {
            console.error('❌ [Supabase Keep-Alive] Ping database gagal:', err.message);
        }
    });
});

module.exports = app;
