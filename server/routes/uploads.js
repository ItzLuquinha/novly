const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const { requireAuth, requireRole } = require('../auth');
const { detectBufferType, createRateLimiter } = require('../security');
const db = require('../db');

// D1 has a 2 MB maximum BLOB/row size. Stay comfortably below that ceiling.
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 1_250_000;
// Hard app-level caps keep media far below D1 Free's database capacity.
const USER_QUOTA_BYTES = 32 * 1024 * 1024;
const GLOBAL_QUOTA_BYTES = 64 * 1024 * 1024;
const storage = multer.memoryStorage();

const uploadImage = multer({
  storage,
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 1,
    fields: 0,
    parts: 2,
    fieldNameSize: 100,
    headerPairs: 50,
  },
  fileFilter: (req, file, cb) => IMAGE_TYPES.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error('Use uma imagem JPEG, PNG ou WebP.')),
});

const uploadLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyFn: (req) => `upload:${req.user?.id || req.ip}`,
});

async function quotaUsage(userId) {
  const [user, global] = await Promise.all([
    db.prepare('SELECT COALESCE(SUM(size_bytes), 0) AS total FROM uploaded_files WHERE owner_id = ?').get(userId),
    db.prepare('SELECT COALESCE(SUM(size_bytes), 0) AS total FROM uploaded_files').get(),
  ]);
  return { userBytes: Number(user?.total || 0), globalBytes: Number(global?.total || 0) };
}

function handleImageUpload(field, prefix, responseBuilder) {
  return [
    (req, res, next) => uploadImage.single(field)(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Imagem grande demais apos compressao. Limite: 1,25 MB.' });
      }
      return res.status(400).json({ error: err.message || 'Falha no upload.' });
    }),
    async (req, res) => {
      if (!req.file?.buffer) return res.status(400).json({ error: 'Nenhum arquivo recebido.' });

      const detected = detectBufferType(req.file.buffer);
      if (!detected || !IMAGE_TYPES.includes(detected)) {
        return res.status(400).json({ error: 'O conteudo do arquivo nao corresponde a JPEG, PNG ou WebP.' });
      }
      if (req.file.buffer.length > MAX_IMAGE_BYTES) {
        return res.status(413).json({ error: 'Imagem grande demais. Limite: 1,25 MB.' });
      }

      const usage = await quotaUsage(req.user.id);
      if (usage.userBytes + req.file.buffer.length > USER_QUOTA_BYTES) {
        return res.status(413).json({ error: 'Sua quota de imagens chegou a 32 MB. Remova imagens antigas antes de enviar outras.' });
      }
      if (usage.globalBytes + req.file.buffer.length > GLOBAL_QUOTA_BYTES) {
        return res.status(413).json({ error: 'O limite total de 64 MB de imagens do Novly foi atingido.' });
      }

      const key = `${req.user.id}-${prefix}-${crypto.randomUUID()}`;
      await db.prepare(`
        INSERT INTO uploaded_files (storage_key, owner_id, mime_type, size_bytes, data)
        VALUES (?, ?, ?, ?, ?)
      `).run(key, req.user.id, detected, req.file.buffer.length, req.file.buffer);

      return res.json(responseBuilder(`/uploads/${encodeURIComponent(key)}`));
    },
  ];
}

const router = express.Router();
router.use(requireAuth, uploadLimiter);
router.post('/background-image', ...handleImageUpload('image', 'bg', (url) => ({ url, kind: 'image' })));
router.post('/character-photo', requireRole('escritor'), ...handleImageUpload('image', 'char', (url) => ({ url })));
router.post('/book-cover', requireRole('escritor'), ...handleImageUpload('image', 'cover', (url) => ({ url })));
router.get('/storage', requireRole('escritor'), async (req, res) => {
  const row = await db.prepare('SELECT COALESCE(SUM(size_bytes), 0) AS total, COUNT(*) AS files FROM uploaded_files').get();
  res.json({
    bytes: Number(row?.total || 0),
    files: Number(row?.files || 0),
    hard_limit_bytes: GLOBAL_QUOTA_BYTES,
  });
});

module.exports = router;
