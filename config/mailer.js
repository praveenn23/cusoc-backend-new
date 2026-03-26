const nodemailer = require('nodemailer');

// ── SMTP Connection Pool ───────────────────────────────────────────────────────
// pool:true        → reuse one SMTP connection for all emails (1 login, not N)
// maxConnections:2 → at most 2 simultaneous SMTP sockets (safe for Gmail)
// maxMessages:100  → reconnect after every 100 messages (prevents idle timeout)
// rateDelta:1000   → rate-limiting window in ms
// rateLimit:3      → max 3 messages per rateDelta window (3/sec, well under Gmail's limit)
const transporter = nodemailer.createTransport({
    pool: true,
    maxConnections: 2,
    maxMessages: 100,
    rateDelta: 1000,   // 1 second window
    rateLimit: 3,      // max 3 emails per second → ~180/min (Gmail limit: 500/day for App Passwords)
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,      // SSL on port 465 — more stable than STARTTLS 587 for bulk
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Verify transporter connection on startup
transporter.verify((error) => {
    if (error) {
        console.error('❌ Email transporter error:', error.message);
    } else {
        console.log('✅ Email transporter ready (pooled, 3 msg/sec, port 465)');
    }
});

module.exports = transporter;
