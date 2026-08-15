const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../auth');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const prefix = req._uploadPrefix || 'img';
    let safeExt = '.jpg';
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) safeExt = ext;
    if (['.mp4', '.webm'].includes(ext)) safeExt = ext;
    if (VIDEO_TYPES.includes(file.mimetype) && safeExt === '.jpg') {
      safeExt = file.mimetype === 'video/webm' ? '.webm' : '.mp4';
    }
    cb(null, `${prefix}-${req.user.id}-${Date.now()}${safeExt}`);
  },
});

function makeUpload(allowedTypes, maxBytes) {
  return multer({
    storage,
    limits: { fileSize: maxBytes },
    fileFilter: (req, file, cb) => {
      if (!allowedTypes.includes(file.mimetype)) {
        return cb(new Error('Formato de arquivo nao suportado.'));
      }
      cb(null, true);
    },
  });
}

const uploadImage = makeUpload(IMAGE_TYPES, 8 * 1024 * 1024);
const uploadVideo = makeUpload(VIDEO_TYPES, 40 * 1024 * 1024);

const router = express.Router();

router.post('/background-image', requireAuth, (req, res) => {
  req._uploadPrefix = 'bg';
  uploadImage.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Falha ao enviar a imagem.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem recebida.' });
    }
    res.json({ url: `/uploads/${req.file.filename}`, kind: 'image' });
  });
});

router.post('/background-video', requireAuth, (req, res) => {
  req._uploadPrefix = 'bgvid';
  uploadVideo.single('video')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Falha ao enviar o video.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum video recebido.' });
    }
    res.json({ url: `/uploads/${req.file.filename}`, kind: 'video' });
  });
});

router.post('/character-photo', requireAuth, (req, res) => {
  req._uploadPrefix = 'char';
  uploadImage.single('image')(req, res, (err) => {
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
  uploadImage.single('image')(req, res, (err) => {
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
