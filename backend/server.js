/**
 * TenderBuild — Express Server
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const db = require('./config/db');
const cron = require('node-cron');
const crawler = require('./services/crawler');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '100gb' }));
app.use(express.urlencoded({ limit: '100gb', extended: true }));

// ─── Static Files ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/migrations', express.static(path.join(__dirname, 'migrations')));

// ─── API Routes ───────────────────────────────────────────────
app.use('/api/equipments', require('./routes/equipments'));
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
app.use('/api/dokpil',     require('./routes/dokpil'));
app.use('/api/onlyoffice', require('./routes/onlyoffice'));
app.use('/api/sirup',      require('./routes/sirup'));

// ─── Health Check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: 'TenderBuild', version: '1.0.0', timestamp: new Date().toISOString() });
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

// ─── SPA Fallback ─────────────────────────────────────────────
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        const indexPath = path.join(__dirname, '..', 'frontend', 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.json({ 
                success: true, 
                message: "TenderBuild API Server is running successfully.", 
                timestamp: new Date().toISOString() 
            });
        }
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

        // Self-healing: Disable RLS (backend uses service role, bypasses RLS anyway)
        try {
            const rlsPath = path.join(__dirname, 'migrations', '010_disable_rls.sql');
            if (fs.existsSync(rlsPath)) {
                const rlsSql = fs.readFileSync(rlsPath, 'utf8');
                await db.runMigration(rlsSql);
                console.log('✅ RLS disabled on all tables');
            }
        } catch (rlsErr) {
            // Ignore if policies don't exist or RLS already disabled
            console.warn('⚠️ RLS migration skipped:', rlsErr.message);
        }
    }

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
                `SELECT key, value FROM settings WHERE key IN ('sirup_provinsi', 'sirup_akhir_bulan')`
            );
            const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));
            let provinsi = [];
            try { provinsi = cfg.sirup_provinsi ? JSON.parse(cfg.sirup_provinsi) : []; } catch {}
            let akhirBulan = [];
            try { akhirBulan = cfg.sirup_akhir_bulan ? JSON.parse(cfg.sirup_akhir_bulan) : []; } catch {}
            if (!provinsi.length) provinsi = ['DKI Jakarta'];
            const bulanArr = akhirBulan.length ? [1,2,3,4,5,6,7,8,9,10,11,12] : [new Date().getMonth() + 1];
            sirupCrawler.crawlAll({
                provinsi,
                bulan: bulanArr,
                akhirBulan: akhirBulan.length ? akhirBulan : undefined,
            }).catch(e => console.error(e));
        } catch (e) {
            console.error('[SIRUP cron]', e);
            sirupCrawler.crawlAll({ provinsi: ['DKI Jakarta'], bulan: [new Date().getMonth() + 1] }).catch(e2 => console.error(e2));
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
