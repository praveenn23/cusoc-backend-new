const mongoose = require('mongoose');

/**
 * Registration — one document per email (unique index enforced).
 * The `categories` field is a flexible array of objects (equivalent to JSONB).
 * Mirrors the Supabase `registrations` table exactly.
 */
const registrationSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    email:        { type: String, required: true, lowercase: true, trim: true },
    uid:          { type: String, trim: true, default: null },
    cluster:      { type: String, trim: true, default: null },
    department:   { type: String, trim: true, default: null },
    type:         { type: String, default: null },
    categories:   { type: Array,  default: [] },
    ticketSentAt: { type: Date,   default: null },
    attendedAt:   { type: Date,   default: null },
  },
  { timestamps: true }
);

// Keep response shape compatible with existing frontend (snake_case field names)
registrationSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id             = ret._id;
    ret.created_at     = ret.createdAt;
    ret.ticket_sent_at = ret.ticketSentAt;
    ret.attended_at    = ret.attendedAt;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Single unique index on email — declared once here only
registrationSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('Registration', registrationSchema);
