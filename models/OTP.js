const mongoose = require('mongoose');

/**
 * OTP — stores email verification codes with auto-expiry.
 * MongoDB TTL index automatically deletes expired documents.
 * Replaces Supabase `otp_verifications` table.
 */
const otpSchema = new mongoose.Schema(
  {
    email:     { type: String, required: true, lowercase: true, trim: true },
    otp:       { type: String, required: true },
    expiresAt: { type: Date,   required: true },
  },
  { timestamps: true }
);

// TTL index: MongoDB will auto-delete documents after `expiresAt`
// This replaces the manual cleanup we did in Supabase controllers
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index on email for fast lookups
otpSchema.index({ email: 1 });

module.exports = mongoose.model('OTP', otpSchema);
