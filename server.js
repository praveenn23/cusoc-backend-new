require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const connectDB = require('./config/db');

const eventRoutes        = require('./routes/eventRoutes');
const otpRoutes          = require('./routes/otpRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
const adminRoutes        = require('./routes/adminRoutes');
const uploadRoutes       = require('./routes/uploadRoutes');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Connect to MongoDB ───────────────────────────────────────────────────────
connectDB();

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Handle browser preflight OPTIONS requests
app.options('*', cors());

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/event',    eventRoutes);
app.use('/',         otpRoutes);           // /send-otp  /verify-otp
app.use('/register', registrationRoutes);
app.use('/admin',    adminRoutes);
app.use('/upload',   uploadRoutes);        // /upload/proof  (Google Drive)

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start server (local dev only) ─────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  });
}

// ── Export for Vercel serverless ──────────────────────────────────────────────
module.exports = app;
