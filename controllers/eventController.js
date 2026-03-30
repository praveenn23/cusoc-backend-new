const Event        = require('../models/Event');
const Registration = require('../models/Registration');

/**
 * GET /event — fetch the single event document.
 * bookedSeats is always computed live from the Registration collection
 * so the counter can never drift out of sync.
 */
const getEvent = async (req, res) => {
  try {
    const [event, liveCount] = await Promise.all([
      Event.findOne(),
      Registration.countDocuments(),
    ]);

    if (!event) {
      return res.status(404).json({
        error: 'No event found. Please seed the database via the Admin Panel.',
      });
    }

    // Auto-correct stored bookedSeats if it has drifted
    if (event.bookedSeats !== liveCount) {
      event.bookedSeats = liveCount;
      await Event.findByIdAndUpdate(event._id, { bookedSeats: liveCount });
    }

    return res.status(200).json({ success: true, event });
  } catch (err) {
    console.error('getEvent error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch event details' });
  }
};

module.exports = { getEvent };
