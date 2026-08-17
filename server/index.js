const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const db = require('./db');

const { requireAuth } = require('./auth');
const { startPublishingScheduler } = require('./publishing');
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

const app = express();
const PORT = process.env.PORT || 4001;
const IS_PROD = process.env.NODE_ENV === 'production';
const IS_HOSTED = IS_PROD || process.env.RENDER === 'true' || !!process.env.VERCEL || !!process.env.RAILWAY_ENVIRONMENT || !!process.env.FLY_APP_NAME;
app.disable('x-powered-by');
if (IS_HOSTED) app.set('trust proxy', 1);

if (IS_HOSTED && (!process.env.CLIENT_ORIGIN || process.env.CLIENT_ORIGIN.split(',').map((s) => s.trim()).includes('*'))) {
  throw new Error('CLIENT_ORIGIN explicito (sem wildcard) e obrigatorio em producao.');
}
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',').map((s) => s.trim()).filter(Boolean);
const originAllowed = (origin) => !origin || allowedOrigins.includes(origin) || (!IS_HOSTED && allowedOrigins.includes('*'));

app.use(cors({
  origin(origin, cb) {
    if (originAllowed(origin)) return cb(null, true);
    return cb(new Error('Origem nao permitida.'));
  },
  credentials: true,
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (IS_HOSTED) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use(express.json({ limit: '2mb', type: 'application/json' }));
app.use(cookieParser());

// CSRF hardening for cookie-authenticated browser requests. CORS alone does not stop
// a malicious page from submitting certain state-changing forms.
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const fetchSite = String(req.get('sec-fetch-site') || '').toLowerCase();
  if (fetchSite === 'cross-site') return res.status(403).json({ error: 'Requisicao cross-site bloqueada.' });
  const origin = req.get('origin');
  if (origin && !originAllowed(origin)) return res.status(403).json({ error: 'Origem nao permitida.' });
  next();
});

const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(require('./db').DATA_DIR || path.join(__dirname, '..', 'data'), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', requireAuth, express.static(uploadDir, { fallthrough: false, maxAge: IS_PROD ? '1d' : 0 }));

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

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error(err);
  if (err?.message === 'Origem nao permitida.') return res.status(403).json({ error: err.message });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalido.' });
  if (err?.status === 413 || err?.type === 'entity.too.large') return res.status(413).json({ error: 'Requisicao grande demais.' });
  if (Number.isInteger(err?.status) && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message || 'Requisicao invalida.' });
  }
  res.status(500).json({ error: 'Algo deu errado no servidor.' });
});

try {
  const seed = require('./seed');
  const hasExplicitSeed = process.env.SEED_WRITER_EMAIL && process.env.SEED_WRITER_PASSWORD && process.env.SEED_READER_EMAIL && process.env.SEED_READER_PASSWORD;
  if (!IS_HOSTED || hasExplicitSeed) {
    seed({
      writerEmail: process.env.SEED_WRITER_EMAIL || 'escritor@novly.local',
      writerPassword: process.env.SEED_WRITER_PASSWORD || 'trocar-esta-senha',
      readerEmail: process.env.SEED_READER_EMAIL || 'leitora@novly.local',
      readerPassword: process.env.SEED_READER_PASSWORD || 'trocar-esta-senha',
    });
  } else {
    console.log('[novly] Seed automatico desativado em producao sem credenciais explicitas.');
  }
} catch (e) {
  console.error('[novly] Seed opcional falhou:', e.message);
}

// Refuse to run a hosted deployment that still has one of the old known default
// passwords. If strong SEED_* values are supplied, rotate that legacy account in
// place so existing books/relations are preserved.
if (IS_HOSTED) {
  const legacyAccounts = [
    { role: 'escritor', email: 'escritor@novly.local', envEmail: 'SEED_WRITER_EMAIL', envPassword: 'SEED_WRITER_PASSWORD' },
    { role: 'leitora', email: 'leitora@novly.local', envEmail: 'SEED_READER_EMAIL', envPassword: 'SEED_READER_PASSWORD' },
  ];
  for (const legacy of legacyAccounts) {
    const user = db.prepare('SELECT id, email, password_hash FROM users WHERE role = ? AND email = ?').get(legacy.role, legacy.email);
    if (!user || !bcrypt.compareSync('trocar-esta-senha', user.password_hash)) continue;
    const replacementEmail = String(process.env[legacy.envEmail] || '').toLowerCase().trim();
    const replacementPassword = String(process.env[legacy.envPassword] || '');
    if (!replacementEmail || replacementEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replacementEmail) || replacementPassword.length < 12 || replacementPassword.length > 72) {
      throw new Error(`Conta ${legacy.role} ainda usa credencial padrao. Defina ${legacy.envEmail} valido e ${legacy.envPassword} (12-72 caracteres) para rotaciona-la.`);
    }
    const conflict = db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(replacementEmail, user.id);
    if (conflict) throw new Error(`Nao foi possivel rotacionar a conta ${legacy.role}: o email configurado ja esta em uso.`);
    db.prepare('UPDATE users SET email = ?, password_hash = ?, session_version = session_version + 1 WHERE id = ?')
      .run(replacementEmail, bcrypt.hashSync(replacementPassword, 10), user.id);
    console.log(`[novly] Credencial padrao antiga da conta ${legacy.role} foi rotacionada.`);
  }
}

startPublishingScheduler();
app.listen(PORT, () => console.log(`Novly server rodando na porta ${PORT}`));
