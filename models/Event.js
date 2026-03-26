const mongoose = require('mongoose');

/**
 * Event — single-document collection (singleton pattern).
 * Mirrors the Supabase `event` table exactly.
 */
const eventSchema = new mongoose.Schema(
  {
    title:         { type: String, required: true },
    description:   { type: String, default: null },
    date:          { type: Date,   required: true },
    time:          { type: String, default: null },      // display string e.g. "9:30 AM – 4:30 PM IST"
    venue:         { type: String, required: true },
    totalSeats:    { type: Number, required: true, default: 100, min: 1 },
    bookedSeats:   { type: Number, default: 0, min: 0 },
    aboutText:     { type: String, default: null },
    eventSections: { type: Array,  default: [] },        // 3-column content grid
    speakers:      { type: Array,  default: [] },        // [{name, role, bio, ...}]
    partners:      { type: Array,  default: [] },        // [{name, logo_url}]
  },
  { timestamps: true }
);

// Provide a camelCase alias for `bookedSeats` so the frontend sees `booked_seats`
// We use a virtual + transform to keep the API response shape unchanged.
eventSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id           = ret._id;
    ret.total_seats  = ret.totalSeats;
    ret.booked_seats = ret.bookedSeats;
    ret.about_text   = ret.aboutText;
    ret.event_sections = ret.eventSections;
    ret.created_at   = ret.createdAt;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Event', eventSchema);
