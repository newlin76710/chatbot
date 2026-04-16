const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');

const UPLOAD_DIR = '/app/uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/quicktime', 'video/x-msvideo',
];

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '';
    const name = `${Date.now()}-${Math.random().toString(36).substr(2, 8)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支援的檔案格式，請上傳圖片（JPEG/PNG/GIF/WEBP）或影片（MP4）'));
    }
  },
});

const BASE_URL = process.env.FRONTEND_URL || 'https://bot.ek21.com';

// POST /api/upload
router.post('/', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到檔案' });
  const url = `${BASE_URL}/uploads/${req.file.filename}`;
  const isVideo = req.file.mimetype.startsWith('video/');
  res.json({ url, filename: req.file.filename, type: isVideo ? 'video' : 'image' });
});

// Error handler for multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: '檔案過大，上限 50MB' });
  }
  res.status(400).json({ error: err.message || '上傳失敗' });
});

module.exports = router;
