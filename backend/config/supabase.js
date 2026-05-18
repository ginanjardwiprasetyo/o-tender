/**
 * Supabase Client Configuration
 * Initializes the Supabase client for database operations.
 */
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your-project')) {
    console.warn('⚠️  Supabase belum dikonfigurasi. Silakan isi SUPABASE_URL dan SUPABASE_ANON_KEY di file .env');
}

const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseKey || 'placeholder',
    {
        realtime: { transport: WebSocket }
    }
);

module.exports = supabase;
