/**
 * TenderBuild — PostgreSQL Database Client
 * Menggunakan koneksi langsung via DATABASE_URL (Transaction Pooler Supabase)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Diperlukan untuk Supabase pooler
    max: 5,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 15000,
    statement_timeout: 15000, // Kill queries that run over 15s
    allowExitOnIdle: true,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
});

pool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err.message);
});

/**
 * Helper query — mirip interface Supabase tapi pakai pg langsung
 * Usage: const { rows } = await db.query('SELECT * FROM tenders WHERE id = $1', [id])
 */
const db = {
    query: (text, params) => pool.query(text, params),
    pool,

    /**
     * Test koneksi database
     */
    async testConnection() {
        try {
            const { rows } = await pool.query('SELECT NOW() as now');
            console.log('✅ Database connected:', rows[0].now);
            return true;
        } catch (err) {
            console.error('❌ Database connection failed:', err.message);
            return false;
        }
    },

    /**
     * Run migration SQL
     */
    async runMigration(sql) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(sql);
            await client.query('COMMIT');
            return { success: true };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
};

module.exports = db;
