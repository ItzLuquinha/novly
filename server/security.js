const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./db');

function positiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function boundedNumber(value, min, max, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function boundedInt(value, min, max, fallback = 0) {
  return Math.round(boundedNumber(value, min, max, fallback));
}

function boundedString(value, maxLength, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).slice(0, maxLength);
}

function getChapterAccessById(chapterId, user) {
  const id = positiveInt(chapterId);
  if (!id) return { error: { status: 400, message: 'Capitulo invalido.' } };

  const row = db.prepare(`
    SELECT ch.*, b.slug as book_slug, b.published_at as book_published_at
    FROM chapters ch JOIN books b ON b.id = ch.book_id
    WHERE ch.id = ?
  `).get(id);
  if (!row) return { error: { status: 404, message: 'Capitulo nao encontrado.' } };

  if (user.role !== 'escritor' && (!row.book_published_at || row.status !== 'publicado')) {
    return { error: { status: 403, message: 'Este capitulo ainda nao foi publicado.' } };
  }

  return { chapter: row };
}

function getBookAndChapterBySlug(slug, chapterId, user) {
  const book = db.prepare('SELECT * FROM books WHERE slug = ?').get(slug);
  if (!book) return { error: { status: 404, message: 'Livro nao encontrado.' } };
  if (user.role !== 'escritor' && !book.published_at) {
    return { error: { status: 403, message: 'Este livro ainda nao foi publicado.' } };
  }

  const id = positiveInt(chapterId);
  if (!id) return { error: { status: 400, message: 'Capitulo invalido.' } };
  const chapter = db.prepare('SELECT * FROM chapters WHERE id = ? AND book_id = ?').get(id, book.id);
  if (!chapter) return { error: { status: 404, message: 'Capitulo nao encontrado.' } };
  if (user.role !== 'escritor' && chapter.status !== 'publicado') {
    return { error: { status: 403, message: 'Este capitulo ainda nao foi publicado.' } };
  }
  return { book, chapter };
}

function randomFilename(prefix, ext) {
  return `${prefix}-${crypto.randomUUID()}${ext}`;
}

function detectFileType(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(32);
    const bytes = fs.readSync(fd, buf, 0, buf.length, 0);
    const b = buf.subarray(0, bytes);
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
    if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return 'image/png';
    if (b.length >= 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
    if (b.length >= 6 && ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('ascii'))) return 'image/gif';
    if (b.length >= 12 && b.subarray(4, 8).toString('ascii') === 'ftyp') return 'video/mp4';
    if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm';
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

function removeFileQuietly(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
}


function managedUploadPath(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('/uploads/')) return null;
  const name = path.basename(url);
  const dir = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(db.DATA_DIR, 'uploads');
  const candidate = path.join(dir, name);
  if (!candidate.startsWith(dir + path.sep)) return null;
  return candidate;
}

function removeManagedUploadUrl(url) {
  const filePath = managedUploadPath(url);
  if (filePath) removeFileQuietly(filePath);
}

function createRateLimiter({ windowMs, max, keyFn, maxBuckets = 5000 }) {
  const buckets = new Map();
  let requestsSinceCleanup = 0;

  function cleanup(now) {
    for (const [key, value] of buckets) {
      if (value.resetAt <= now) buckets.delete(key);
    }
    // Do not let an attacker create an unbounded number of unique keys/emails.
    if (buckets.size > maxBuckets) {
      const overflow = buckets.size - maxBuckets;
      let removed = 0;
      for (const key of buckets.keys()) {
        buckets.delete(key);
        removed += 1;
        if (removed >= overflow) break;
      }
    }
  }

  return (req, res, next) => {
    const now = Date.now();
    requestsSinceCleanup += 1;
    if (requestsSinceCleanup >= 100 || buckets.size > maxBuckets) {
      cleanup(now);
      requestsSinceCleanup = 0;
    }

    const key = String(keyFn ? keyFn(req) : req.ip || 'unknown').slice(0, 512);
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.delete(key);
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > max) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em instantes.' });
    }
    next();
  };
}

module.exports = {
  positiveInt,
  boundedNumber,
  boundedInt,
  boundedString,
  getChapterAccessById,
  getBookAndChapterBySlug,
  randomFilename,
  detectFileType,
  removeFileQuietly,
  createRateLimiter,
  managedUploadPath,
  removeManagedUploadUrl,
};
