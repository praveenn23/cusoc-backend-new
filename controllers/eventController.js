const Event = require('../models/Event');

/**
 * GET /event — fetch the single event document
 */
const getEvent = async (req, res) => {
  try {
    const event = await Event.findOne();

    if (!event) {
      return res.status(404).json({
        error: 'No event found. Please seed the database via the Admin Panel.',
      });
    }

    return res.status(200).json({ success: true, event });
  } catch (err) {
    console.error('getEvent error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch event details' });
  }
};

module.exports = { getEvent };
