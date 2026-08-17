const crypto = require('crypto');
const db = require('./db');

function positiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}
function boundedNumber(value, min, max, fallback = 0) {
  const n = Number(value); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
function boundedInt(value, min, max, fallback = 0) { return Math.round(boundedNumber(value, min, max, fallback)); }
function boundedString(value, maxLength, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).slice(0, maxLength);
}

async function getChapterAccessById(chapterId, user) {
  const id = positiveInt(chapterId);
  if (!id) return { error: { status: 400, message: 'Capitulo invalido.' } };
  const row = await db.prepare(`
    SELECT ch.*, b.slug as book_slug, b.published_at as book_published_at
    FROM chapters ch JOIN books b ON b.id = ch.book_id WHERE ch.id = ?
  `).get(id);
  if (!row) return { error: { status: 404, message: 'Capitulo nao encontrado.' } };
  if (user.role !== 'escritor' && (!row.book_published_at || row.status !== 'publicado')) {
    return { error: { status: 403, message: 'Este capitulo ainda nao foi publicado.' } };
  }
  return { chapter: row };
}

async function getBookAndChapterBySlug(slug, chapterId, user) {
  const book = await db.prepare('SELECT * FROM books WHERE slug = ?').get(slug);
  if (!book) return { error: { status: 404, message: 'Livro nao encontrado.' } };
  if (user.role !== 'escritor' && !book.published_at) return { error: { status: 403, message: 'Este livro ainda nao foi publicado.' } };
  const id = positiveInt(chapterId);
  if (!id) return { error: { status: 400, message: 'Capitulo invalido.' } };
  const chapter = await db.prepare('SELECT * FROM chapters WHERE id = ? AND book_id = ?').get(id, book.id);
  if (!chapter) return { error: { status: 404, message: 'Capitulo nao encontrado.' } };
  if (user.role !== 'escritor' && chapter.status !== 'publicado') return { error: { status: 403, message: 'Este capitulo ainda nao foi publicado.' } };
  return { book, chapter };
}

function randomFilename(prefix, ext) { return `${prefix}-${crypto.randomUUID()}${ext}`; }
function detectBufferType(buffer) {
  const b = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return 'image/png';
  if (b.length >= 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (b.length >= 6 && ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('ascii'))) return 'image/gif';
  if (b.length >= 12 && b.subarray(4, 8).toString('ascii') === 'ftyp') return 'video/mp4';
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm';
  return null;
}
function managedUploadKey(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('/uploads/')) return null;
  const key = decodeURIComponent(url.slice('/uploads/'.length));
  if (!key || key.includes('..') || key.startsWith('/')) return null;
  return key;
}
async function removeManagedUploadUrl(url) {
  const key = managedUploadKey(url);
  if (key) await db.prepare('DELETE FROM uploaded_files WHERE storage_key = ?').run(key);
}

function createRateLimiter({ windowMs, max, keyFn, maxBuckets = 5000 }) {
  const buckets = new Map();
  return (req, res, next) => {
    const now = Date.now();
    if (buckets.size > maxBuckets) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
      while (buckets.size > maxBuckets) buckets.delete(buckets.keys().next().value);
    }
    const key = String(keyFn ? keyFn(req) : req.ip || 'unknown').slice(0, 512);
    let cur = buckets.get(key);
    if (!cur || cur.resetAt <= now) { cur = { count: 0, resetAt: now + windowMs }; buckets.set(key, cur); }
    cur.count += 1;
    if (cur.count > max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((cur.resetAt - now) / 1000))));
      return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em instantes.' });
    }
    next();
  };
}

module.exports = { positiveInt, boundedNumber, boundedInt, boundedString, getChapterAccessById, getBookAndChapterBySlug, randomFilename, detectBufferType, createRateLimiter, managedUploadKey, removeManagedUploadUrl };
