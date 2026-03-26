const express = require('express');
const router  = express.Router();
const { uploadProof } = require('../controllers/uploadController');

// POST /upload/proof
// Accepts: multipart/form-data with field name "file"
// Returns: { success: true, url: "https://drive.google.com/..." }
router.post('/proof', uploadProof);

module.exports = router;
