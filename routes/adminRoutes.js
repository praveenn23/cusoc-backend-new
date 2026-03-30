const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const {
    getStats,
    getRegistrations,
    deleteRegistration,
    getEvent,
    updateEvent,
    adminLogin,
    sendTickets,
    markAttendance,
    updateEvaluation,
} = require('../controllers/adminController');

// ── No-cache middleware for ALL admin routes ─────────────────────────────────
// Prevents Vercel CDN and browsers from returning stale 304 responses.
// Admin data (registrations, stats) must always be fresh from the DB.
router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// Public — login (no auth middleware)
router.post('/login', adminLogin);

// Protected — all routes below require the admin key
router.use(adminAuth);

router.get('/stats', getStats);
router.get('/registrations', getRegistrations);
router.delete('/registrations/:id', deleteRegistration);
router.get('/event', getEvent);
router.put('/event', updateEvent);
router.post('/send-tickets', sendTickets);
router.post('/mark-attendance', markAttendance);
router.put('/registrations/:id/evaluation', updateEvaluation);

module.exports = router;
