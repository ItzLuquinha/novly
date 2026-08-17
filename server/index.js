const express = require('express');
const cookieParser = require('cookie-parser');
const db = require('./db');
const { requireAuth } = require('./auth');
const { seedFromBindings } = require('./seed');

const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const commentRoutes = require('./routes/comments');
const highlightRoutes = require('./routes/highlights');
const homeRoutes = require('./routes/home');
const profileRoutes = require('./routes/profile');
const writerBooksRoutes = require('./routes/writerBooks');
const writerChaptersRoutes = require('./routes/writerChapters');
const writerDashboardRoutes = require('./routes/writerDashboard');
const writerCharactersRoutes = require('./routes/writerCharacters');
const writerPlacesRoutes = require('./routes/writerPlaces');
const writerObjectsRoutes = require('./routes/writerObjects');
const writerTimelineRoutes = require('./routes/writerTimeline');
const writerNotesRoutes = require('./routes/writerNotes');
const writerKanbanRoutes = require('./routes/writerKanban');
const writerScenesRoutes = require('./routes/writerScenes');
const notesRoutes = require('./routes/notes');
const bookLoreRoutes = require('./routes/bookLore');
const settingsRoutes = require('./routes/settings');
const uploadsRoutes = require('./routes/uploads');
const grammarCheckRoutes = require('./routes/grammarCheck');
const writerBackupRoutes = require('./routes/writerBackup');
const loreNetworkRoutes = require('./routes/loreNetwork');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
});
app.use(express.json({ limit: '2mb', type: 'application/json' }));
app.use(cookieParser());

// Same-origin deployment means CORS is unnecessary. Reject state-changing requests
// that originate from a different site as an additional CSRF layer.
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const site = String(req.get('sec-fetch-site') || '').toLowerCase();
  if (site === 'cross-site') return res.status(403).json({ error: 'Requisicao cross-site bloqueada.' });
  const origin = req.get('origin');
  const host = req.get('host');
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return res.status(403).json({ error: 'Origem nao permitida.' });
    } catch (_) { return res.status(403).json({ error: 'Origem invalida.' }); }
  }
  next();
});

// On a new D1 database, create the two private accounts from Worker secrets.
// This is idempotent and does nothing once users exist.
app.use('/api', async (req, res, next) => {
  try { await seedFromBindings(); next(); }
  catch (err) { next(err); }
});

// Private D1-backed images. Any authenticated Novly user may view them;
// mutation remains restricted by the upload endpoints and entity permissions.
app.get('/uploads/*path', requireAuth, async (req, res, next) => {
  try {
    const key = decodeURIComponent(req.originalUrl.split('?')[0].slice('/uploads/'.length));
    if (!key || key.includes('..') || key.startsWith('/')) return res.status(400).json({ error: 'Arquivo invalido.' });
    const file = await db.prepare('SELECT mime_type, data FROM uploaded_files WHERE storage_key = ?').get(key);
    if (!file) return res.status(404).json({ error: 'Arquivo nao encontrado.' });
    const bytes = file.data instanceof Uint8Array ? file.data : Uint8Array.from(file.data || []);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(Buffer.from(bytes));
  } catch (err) { next(err); }
});

app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/highlights', highlightRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/writer', writerBooksRoutes);
app.use('/api/writer', writerChaptersRoutes);
app.use('/api/writer', writerDashboardRoutes);
app.use('/api/writer', writerCharactersRoutes);
app.use('/api/writer', writerPlacesRoutes);
app.use('/api/writer', writerObjectsRoutes);
app.use('/api/writer', writerTimelineRoutes);
app.use('/api/writer', writerNotesRoutes);
app.use('/api/writer', writerKanbanRoutes);
app.use('/api/writer', writerScenesRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/books', bookLoreRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/grammar', grammarCheckRoutes);
app.use('/api/writer', writerBackupRoutes);
app.use('/api', loreNetworkRoutes);
app.get('/api/health', (req, res) => res.json({ ok: true, platform: 'cloudflare-workers' }));

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('[novly]', err);
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalido.' });
  if (err?.status === 413 || err?.type === 'entity.too.large') return res.status(413).json({ error: 'Requisicao grande demais.' });
  if (Number.isInteger(err?.status) && err.status >= 400 && err.status < 500) return res.status(err.status).json({ error: err.message || 'Requisicao invalida.' });
  res.status(500).json({ error: 'Algo deu errado no servidor.' });
});

module.exports = app;
