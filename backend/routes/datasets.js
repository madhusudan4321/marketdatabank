const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const {
  getDatasets,
  getPendingDatasets,
  approveDataset,
  rejectDataset,
  getDataset,
  uploadDataset,
  deleteDataset,
  downloadDataset,
  previewDataset,
  toggleLike,
} = require('../controllers/datasetController');

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.csv', '.json'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only .csv and .json files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

// ── Public routes ──
router.get('/', getDatasets);
router.get('/:id/download', downloadDataset);
router.get('/:id/preview', previewDataset);

// ── Admin-only routes (must be before /:id to avoid param clash) ──
router.get('/admin/pending', auth, adminOnly, getPendingDatasets);
router.patch('/:id/approve', auth, adminOnly, approveDataset);
router.patch('/:id/reject', auth, adminOnly, rejectDataset);

// ── Single dataset (auth optional — controller checks status) ──
router.get('/:id', getDataset);

// ── Protected user + admin routes ──
router.post('/', auth, upload.single('file'), uploadDataset);
router.delete('/:id', auth, deleteDataset);
router.post('/:id/like', auth, toggleLike);

// Multer error handling
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 50MB.' });
    }
  }
  if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
});

module.exports = router;
