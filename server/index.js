const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('./db');

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

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return cb(null, true);
    }
    return cb(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(require('./db').DATA_DIR || path.join(__dirname, '..', 'data'), 'uploads');
if (!require('fs').existsSync(uploadDir)) require('fs').mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

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
  console.error(err);
  res.status(500).json({ error: 'Algo deu errado no servidor.' });
});

try {
  const seed = require('./seed');
  seed({
    writerEmail: process.env.SEED_WRITER_EMAIL || 'escritor@novly.local',
    writerPassword: process.env.SEED_WRITER_PASSWORD || 'trocar-esta-senha',
    readerEmail: process.env.SEED_READER_EMAIL || 'leitora@novly.local',
    readerPassword: process.env.SEED_READER_PASSWORD || 'trocar-esta-senha',
  });
} catch (e) {
  console.error('[novly] Seed opcional falhou:', e.message);
}

app.listen(PORT, () => {
  console.log(`Novly server rodando na porta ${PORT}`);
});

