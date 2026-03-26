const express = require('express');
const router = express.Router();
const { getEvent } = require('../controllers/eventController');

// GET /event — fetch event details
router.get('/', getEvent);

module.exports = router;
