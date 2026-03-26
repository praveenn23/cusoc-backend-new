const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP } = require('../controllers/otpController');

// POST /send-otp
router.post('/send-otp', sendOTP);

// POST /verify-otp
router.post('/verify-otp', verifyOTP);

module.exports = router;
