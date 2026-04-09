const multer       = require('multer');
const { uploadToDrive } = require('../config/gdrive');

// Store file in memory (no disk I/O) — works perfectly on Vercel serverless
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 }, // 200 KB max
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPG, and PNG files are allowed'), false);
    }
  },
});

/**
 * POST /upload/proof
 * Accepts a single file upload (field name: "file"),
 * uploads it to Google Drive, and returns the shareable URL.
 *
 * Frontend usage:
 *   const form = new FormData();
 *   form.append('file', fileInput.files[0]);
 *   const res = await fetch('/upload/proof', { method: 'POST', body: form });
 *   const { url } = await res.json();  // save this URL in your categories array
 */
const uploadProof = [
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size exceeds 200 KB limit' });
        }
        return res.status(400).json({ error: err.message });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided. Use field name "file".' });
      }

      const { buffer, originalname, mimetype } = req.file;

      const driveUrl = await uploadToDrive(buffer, originalname, mimetype);

      return res.status(200).json({
        success: true,
        url: driveUrl,
        filename: originalname,
      });
    } catch (err) {
      console.error('uploadProof error:', err.message);
      return res.status(500).json({ error: `File upload failed: ${err.message}` });
    }
  },
];

module.exports = { uploadProof };
