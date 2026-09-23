const express = require('express');
const router = express.Router();
const {
    verifyCredentials,
    createSession,
    clearSessionCookie,
    setSessionCookie,
    getSessionToken,
    verifySession,
} = require('../utils/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!verifyCredentials(username, password)) {
        return res.status(401).json({ success: false, error: 'Username atau password salah' });
    }
    setSessionCookie(res, createSession());
    res.json({ success: true, data: { user: 'gmp' } });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    clearSessionCookie(res);
    res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
    const ok = verifySession(getSessionToken(req));
    if (!ok) return res.status(401).json({ success: false, error: 'Belum login' });
    res.json({ success: true, data: { user: 'gmp' } });
});

module.exports = router;
