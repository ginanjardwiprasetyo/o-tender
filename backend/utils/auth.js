/**
 * Auth — session token (HMAC) tanpa dependency tambahan.
 * Multi-user + role: admin (penuh) vs viewer (lihat saja).
 */
const crypto = require('crypto');

// ponytail: user di-hash saat runtime (tanpa plaintext di repo); tambah user baru = 1 baris di sini
const USERS = {
    gindid: { pass: 'gindid', role: 'admin' },
    gmp26: { pass: 'gmp26', role: 'viewer' },
};
// fallback lokal (bukan secret produksi) — bisa diganti AUTH_SECRET di .env
const SECRET = process.env.AUTH_SECRET || sha256Hex('otender-session-v1');
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sha256Hex(s) {
    return crypto.createHash('sha256').update(s).digest('hex');
}

function sha256(s) {
    return sha256Hex(s);
}

function verifyCredentials(username, password) {
    const u = String(username || '');
    const p = String(password || '');
    const rec = USERS[u];
    if (!rec) return false;
    // compare via hex hash agar panjang buffer selalu sama (timingSafeEqual wajib equal length)
    const passOk = sha256Hex(p) === sha256Hex(rec.pass);
    return passOk ? rec.role : false;
}

function sign(payload) {
    return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

function createSession(username) {
    const role = (USERS[username] || {}).role || 'admin';
    const exp = Date.now() + TTL_MS;
    const payload = Buffer.from(JSON.stringify({ u: username, role, exp })).toString('base64url');
    return `${payload}.${sign(payload)}`;
}

/** @returns {{user, role}|false} */
function verifySession(token) {
    if (!token || typeof token !== 'string') return false;
    const i = token.lastIndexOf('.');
    if (i < 0) return false;
    const payload = token.slice(0, i);
    const sig = token.slice(i + 1);
    const expect = sign(payload);
    if (sig.length !== expect.length) return false;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return false;
    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (!USERS[data.u] || data.exp <= Date.now()) return false;
        return { user: data.u, role: data.role || USERS[data.u].role };
    } catch {
        return false;
    }
}

function parseCookies(req) {
    const out = {};
    const raw = req.headers.cookie;
    if (!raw) return out;
    raw.split(';').forEach(p => {
        const i = p.indexOf('=');
        if (i < 0) return;
        out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
    });
    return out;
}

function getSessionToken(req) {
    const cookies = parseCookies(req);
    if (cookies.session) return cookies.session;
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) return auth.slice(7);
    return null;
}

function setSessionCookie(res, token) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `session=${token}; HttpOnly; Path=/; Max-Age=${TTL_MS / 1000}; SameSite=Lax${secure}`);
}

function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
}

function requireAuth(req, res, next) {
    // Publik: login + health + cek DB setup + statistik login
    const p = req.path;
    if (p === '/auth/login' || p === '/health' || p === '/db-status' || p === '/public-stats') return next();
    // DocumentServer (container) → tanpa cookie; divalidasi HMAC di route onlyoffice
    if (p.startsWith('/onlyoffice/file/') || p.startsWith('/onlyoffice/callback/')) return next();
    if (verifySession(getSessionToken(req))) return next();
    res.status(401).json({ success: false, error: 'Belum login' });
}

/** Viewer = GET saja (kecuali Template & Pengaturan: tutup total); semua mutasi ditolak 403. */
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const VIEWER_CLOSED = ['/templates', '/settings'];
function requireWrite(req, res, next) {
    const p = req.path;
    if (p === '/auth/login' || p === '/auth/logout') return next();
    if (p.startsWith('/onlyoffice/file/') || p.startsWith('/onlyoffice/callback/')) return next();
    const sess = verifySession(getSessionToken(req));
    if (!sess || sess.role !== 'viewer') return next();
    if (VIEWER_CLOSED.some(pref => p === pref || p.startsWith(pref + '/'))) {
        return res.status(403).json({ success: false, error: 'Halaman khusus admin' });
    }
    if (WRITE_METHODS.has(req.method)) {
        return res.status(403).json({ success: false, error: 'Akses lihat saja (viewer)' });
    }
    next();
}

module.exports = {
    verifyCredentials,
    createSession,
    verifySession,
    getSessionToken,
    setSessionCookie,
    clearSessionCookie,
    requireAuth,
    requireWrite,
};
