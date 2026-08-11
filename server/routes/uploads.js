const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../auth');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
    const prefix = req._uploadPrefix || 'img';
    cb(null, `${prefix}-${req.user.id}-${Date.now()}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error('Formato de imagem nao suportado.'));
    }
    cb(null, true);
  },
});

const router = express.Router();

router.post('/background-image', requireAuth, (req, res) => {
  req._uploadPrefix = 'bg';
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Falha ao enviar a imagem.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem recebida.' });
    }
    res.json({ url: `/uploads/${req.file.filename}` });
  });
});

router.post('/character-photo', requireAuth, (req, res) => {
  req._uploadPrefix = 'char';
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Falha ao enviar a foto.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma foto recebida.' });
    }
    res.json({ url: `/uploads/${req.file.filename}` });
  });
});

router.post('/book-cover', requireAuth, (req, res) => {
  req._uploadPrefix = 'cover';
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Falha ao enviar a capa.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem recebida.' });
    }
    res.json({ url: `/uploads/${req.file.filename}` });
  });
});

module.exports = router;
