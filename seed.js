/**
 * seed.js — Run once to create the initial event document in MongoDB.
 * Usage: node seed.js
 *
 * This replaces the Supabase seed SQL (supabase/schema.sql).
 * Safe to re-run — uses upsert so it won't create duplicate events.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Event    = require('./models/Event');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const existing = await Event.findOne();
    if (existing) {
      console.log('ℹ️  Event already exists — skipping seed.');
      console.log('   Title:', existing.title);
      console.log('   Booked Seats:', existing.bookedSeats, '/', existing.totalSeats);
      process.exit(0);
    }

    const event = await Event.create({
      title:       'ABHYUTTHANAM: Achievers Awards',
      description: 'Annual recognition ceremony celebrating student and faculty excellence across Research, Innovation, Entrepreneurship, Competitions, Patents, and Leadership.',
      date:        new Date('2026-04-21T09:30:00+05:30'),
      time:        '09:30 AM – 04:30 PM IST',
      venue:       'D1-Auditorium, Chandigarh University, Mohali, Punjab',
      totalSeats:  500,
      bookedSeats: 0,
      aboutText:   'ABHYUTTHANAM is the annual achievers awards ceremony at Chandigarh University, celebrating outstanding accomplishments of students, mentors, and coordinators across six major award categories.',
      eventSections: [],
      speakers:    [],
      partners:    [],
    });

    console.log('🎉 Event seeded successfully!');
    console.log('   ID:', event._id.toString());
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
})();
