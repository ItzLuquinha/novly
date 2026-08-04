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

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Algo deu errado no servidor.' });
});

app.listen(PORT, () => {
  console.log(`Novly server rodando na porta ${PORT}`);
});
