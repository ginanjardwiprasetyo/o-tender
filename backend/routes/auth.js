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
    const role = verifyCredentials(username, password);
    if (!role) {
        return res.status(401).json({ success: false, error: 'Username atau password salah' });
    }
    setSessionCookie(res, createSession(String(username)));
    res.json({ success: true, data: { user: String(username), role } });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    clearSessionCookie(res);
    res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
    const sess = verifySession(getSessionToken(req));
    if (!sess) return res.status(401).json({ success: false, error: 'Belum login' });
    res.json({ success: true, data: { user: sess.user, role: sess.role } });
});

module.exports = router;
