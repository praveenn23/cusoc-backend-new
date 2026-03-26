/**
 * Admin Auth Middleware
 * Checks for X-Admin-Key header matching ADMIN_SECRET_KEY env var
 */
const adminAuth = (req, res, next) => {
    const key = req.headers['x-admin-key'];
    const secret = process.env.ADMIN_SECRET_KEY;

    if (!secret) {
        console.error('⚠️  ADMIN_SECRET_KEY is not set in .env');
        return res.status(500).json({ error: 'Admin not configured' });
    }

    if (!key || key !== secret) {
        return res.status(401).json({ error: 'Unauthorized. Invalid admin key.' });
    }

    next();
};

module.exports = adminAuth;
