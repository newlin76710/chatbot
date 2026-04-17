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

// GET /api/upload/list - 列出已上傳檔案
router.get('/list', auth, (req, res) => {
  const { type } = req.query; // 'image' | 'video' | 不傳 = 全部
  try {
    if (!fs.existsSync(UPLOAD_DIR)) return res.json({ files: [] });
    const files = fs.readdirSync(UPLOAD_DIR)
      .filter(f => !f.startsWith('.'))
      .map(f => {
        const isVideo = /\.(mp4|mov|avi)$/i.test(f);
        return {
          filename: f,
          url: `${BASE_URL}/uploads/${f}`,
          type: isVideo ? 'video' : 'image',
          mtime: fs.statSync(path.join(UPLOAD_DIR, f)).mtimeMs,
        };
      })
      .filter(f => !type || f.type === type)
      .sort((a, b) => b.mtime - a.mtime); // 最新優先
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
