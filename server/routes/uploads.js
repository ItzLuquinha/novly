const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { requireAuth, requireRole } = require('../auth');
const { detectFileType, removeFileQuietly, createRateLimiter } = require('../security');
const db = require('../db');

const UPLOAD_DIR = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(db.DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
console.log(`[novly] Uploads: ${UPLOAD_DIR}`);

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];
const configuredQuota = Number(process.env.UPLOAD_QUOTA_BYTES);
const USER_QUOTA_BYTES = Number.isFinite(configuredQuota)
  ? Math.max(50 * 1024 * 1024, Math.floor(configuredQuota))
  : 250 * 1024 * 1024;

function extForMime(mime) {
  return ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'video/mp4': '.mp4', 'video/webm': '.webm' })[mime] || '.bin';
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${req._uploadPrefix || 'file'}-${req.user.id}-${crypto.randomUUID()}${extForMime(file.mimetype)}`),
});

function makeUpload(allowedTypes, maxBytes) {
  return multer({
    storage,
    limits: { fileSize: maxBytes, files: 1, fields: 0, parts: 2, fieldNameSize: 100, headerPairs: 50, fieldNestingDepth: 0 },
    fileFilter: (req, file, cb) => allowedTypes.includes(file.mimetype) ? cb(null, true) : cb(new Error('Formato de arquivo nao suportado.')),
  });
}

const uploadImage = makeUpload(IMAGE_TYPES, 8 * 1024 * 1024);
const uploadVideo = makeUpload(VIDEO_TYPES, 40 * 1024 * 1024);
const uploadLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20, keyFn: (req) => `upload:${req.user?.id || req.ip}` });

function usedBytes(userId) {
  const marker = `-${userId}-`;
  return fs.readdirSync(UPLOAD_DIR).filter((name) => name.includes(marker)).reduce((sum, name) => {
    try { return sum + fs.statSync(path.join(UPLOAD_DIR, name)).size; } catch (_) { return sum; }
  }, 0);
}

function handleUpload(upload, field, allowedTypes, responseBuilder) {
  return (req, res) => {
    upload.single(field)(req, res, (err) => {
      if (err) {
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ error: err.message || 'Falha no upload.' });
      }
      if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo recebido.' });
      try {
        const detected = detectFileType(req.file.path);
        if (!detected || !allowedTypes.includes(detected)) {
          removeFileQuietly(req.file.path);
          return res.status(400).json({ error: 'O conteudo do arquivo nao corresponde a um formato permitido.' });
        }

        // Never preserve an extension that came only from a spoofable Content-Type header.
        const correctExt = extForMime(detected);
        if (path.extname(req.file.filename).toLowerCase() !== correctExt) {
          const newFilename = `${path.basename(req.file.filename, path.extname(req.file.filename))}${correctExt}`;
          const newPath = path.join(UPLOAD_DIR, newFilename);
          fs.renameSync(req.file.path, newPath);
          req.file.filename = newFilename;
          req.file.path = newPath;
          req.file.mimetype = detected;
        }
        if (usedBytes(req.user.id) > USER_QUOTA_BYTES) {
          removeFileQuietly(req.file.path);
          return res.status(413).json({ error: 'Limite de armazenamento de uploads atingido.' });
        }
        res.json(responseBuilder(req.file));
      } catch (e) {
        removeFileQuietly(req.file.path);
        return res.status(400).json({ error: 'Nao foi possivel validar o arquivo enviado.' });
      }
    });
  };
}


function cleanupOrphanUploads({ minAgeMs = 24 * 60 * 60 * 1000 } = {}) {
  const referenced = new Set();
  const addUrl = (url) => {
    if (typeof url === 'string' && url.startsWith('/uploads/')) referenced.add(path.basename(url));
  };
  for (const row of db.prepare('SELECT avatar_url, background_value FROM users').all()) {
    addUrl(row.avatar_url); addUrl(row.background_value);
  }
  for (const row of db.prepare('SELECT cover_url FROM books').all()) addUrl(row.cover_url);
  for (const row of db.prepare('SELECT photo_url FROM characters').all()) addUrl(row.photo_url);

  const now = Date.now();
  for (const name of fs.readdirSync(UPLOAD_DIR)) {
    const filePath = path.join(UPLOAD_DIR, name);
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile() || referenced.has(name) || now - stat.mtimeMs < minAgeMs) continue;
      removeFileQuietly(filePath);
    } catch (_) {}
  }
}

try { cleanupOrphanUploads(); } catch (err) { console.warn('[novly] Limpeza de uploads orfaos falhou:', err.message); }

const router = express.Router();
router.use(requireAuth, uploadLimiter);

router.post('/background-image', (req, res, next) => { req._uploadPrefix = 'bg'; next(); },
  handleUpload(uploadImage, 'image', IMAGE_TYPES, (f) => ({ url: `/uploads/${f.filename}`, kind: 'image' })));
router.post('/background-video', (req, res, next) => { req._uploadPrefix = 'bgvid'; next(); },
  handleUpload(uploadVideo, 'video', VIDEO_TYPES, (f) => ({ url: `/uploads/${f.filename}`, kind: 'video' })));
router.post('/character-photo', requireRole('escritor'), (req, res, next) => { req._uploadPrefix = 'char'; next(); },
  handleUpload(uploadImage, 'image', IMAGE_TYPES, (f) => ({ url: `/uploads/${f.filename}` })));
router.post('/book-cover', requireRole('escritor'), (req, res, next) => { req._uploadPrefix = 'cover'; next(); },
  handleUpload(uploadImage, 'image', IMAGE_TYPES, (f) => ({ url: `/uploads/${f.filename}` })));

module.exports = router;
