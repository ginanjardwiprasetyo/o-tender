/**
 * Auth — session token (HMAC) tanpa dependency tambahan.
 * User/pass gmp: hanya hash disimpan (aman di-commit).
 */
const crypto = require('crypto');

const APP_USER = 'gmp';
// sha256("gmp") — password login: gmp (hash saja, tanpa plaintext di repo)
const APP_PASS_HASH = sha256Hex('gmp');
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
    const userOk = crypto.timingSafeEqual(Buffer.from(u), Buffer.from(APP_USER.length === u.length ? u : 'xxxxxxxx'));
    const passOk = crypto.timingSafeEqual(
        Buffer.from(sha256(p), 'hex'),
        Buffer.from(APP_PASS_HASH, 'hex')
    );
    return userOk && passOk;
}

function sign(payload) {
    return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

function createSession() {
    const exp = Date.now() + TTL_MS;
    const payload = Buffer.from(JSON.stringify({ u: APP_USER, exp })).toString('base64url');
    return `${payload}.${sign(payload)}`;
}

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
        return data.u === APP_USER && data.exp > Date.now();
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
    // Publik: login + health + cek DB setup
    const p = req.path;
    if (p === '/auth/login' || p === '/health' || p === '/db-status') return next();
    if (verifySession(getSessionToken(req))) return next();
    res.status(401).json({ success: false, error: 'Belum login' });
}

module.exports = {
    verifyCredentials,
    createSession,
    verifySession,
    getSessionToken,
    setSessionCookie,
    clearSessionCookie,
    requireAuth,
};
