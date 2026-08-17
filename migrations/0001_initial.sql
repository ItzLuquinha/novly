CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('escritor', 'leitora')),
  username TEXT NOT NULL,
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  favorite_book_id INTEGER,
  favorite_chapter_id INTEGER,
  last_active_at TEXT,
  background_type TEXT DEFAULT 'default',
  background_value TEXT DEFAULT '',
  session_version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  synopsis TEXT DEFAULT '',
  cover_color TEXT DEFAULT '#4a3728',
  spine_color TEXT DEFAULT '#3a2b1f',
  cover_url TEXT DEFAULT '',
  reader_guide TEXT DEFAULT '',
  category TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'em_andamento' CHECK(status IN ('em_andamento', 'concluido', 'pausado')),
  warnings TEXT DEFAULT '',
  writer_notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT,
  order_index INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK(status IN ('rascunho', 'publicado', 'agendado')),
  scheduled_for TEXT,
  word_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT,
  revision INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reading_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  book_id INTEGER NOT NULL REFERENCES books(id),
  chapter_id INTEGER NOT NULL REFERENCES chapters(id),
  scroll_position REAL DEFAULT 0,
  char_offset INTEGER DEFAULT 0,
  progress_percent REAL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, book_id)
);

CREATE TABLE IF NOT EXISTS reading_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  chapter_id INTEGER NOT NULL REFERENCES chapters(id),
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  seconds_spent INTEGER DEFAULT 0,
  UNIQUE(user_id, chapter_id)
);

CREATE TABLE IF NOT EXISTS reading_activity (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  accumulated_seconds INTEGER NOT NULL DEFAULT 0,
  last_ping_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, chapter_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  book_id INTEGER NOT NULL REFERENCES books(id),
  chapter_id INTEGER REFERENCES chapters(id),
  parent_id INTEGER REFERENCES comments(id),
  anchor_text TEXT,
  anchor_start INTEGER,
  anchor_end INTEGER,
  content TEXT NOT NULL,
  resolved INTEGER DEFAULT 0,
  pinned INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS highlights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  chapter_id INTEGER NOT NULL REFERENCES chapters(id),
  book_id INTEGER NOT NULL REFERENCES books(id),
  text TEXT NOT NULL,
  char_start INTEGER,
  char_end INTEGER,
  note TEXT DEFAULT '',
  collection TEXT DEFAULT 'palavras_que_ficaram',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL CHECK(target_type IN ('chapter', 'comment', 'highlight')),
  target_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL CHECK(target_type IN ('book', 'chapter', 'highlight')),
  target_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  chapter_id INTEGER NOT NULL REFERENCES chapters(id),
  char_offset INTEGER DEFAULT 0,
  label TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS presence (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  last_ping_at TEXT NOT NULL DEFAULT (datetime('now')),
  location TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS chapter_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  word_count INTEGER DEFAULT 0,
  label TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS writing_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  chapter_id INTEGER REFERENCES chapters(id),
  book_id INTEGER REFERENCES books(id),
  words_written INTEGER DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT
);

CREATE TABLE IF NOT EXISTS writer_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  daily_goal INTEGER DEFAULT 500,
  weekly_goal INTEGER DEFAULT 3000,
  editor_font TEXT DEFAULT 'reading',
  editor_font_size INTEGER DEFAULT 19,
  editor_text_color TEXT DEFAULT '#e8dcc8',
  spellcheck_mode TEXT DEFAULT 'local'
);

CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  nicknames TEXT DEFAULT '',
  age TEXT DEFAULT '',
  description TEXT DEFAULT '',
  appearance TEXT DEFAULT '',
  personality TEXT DEFAULT '',
  goals TEXT DEFAULT '',
  fears TEXT DEFAULT '',
  likes TEXT DEFAULT '',
  relationships TEXT DEFAULT '',
  history TEXT DEFAULT '',
  trivia TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  photo_color TEXT DEFAULT '#4a3728',
  photo_url TEXT DEFAULT '',
  body_type TEXT DEFAULT 'medio',
  height_cm INTEGER DEFAULT 170,
  gender TEXT DEFAULT '',
  skin_tone TEXT DEFAULT '#c68863',
  hair_color TEXT DEFAULT '#2b1a12',
  hair_style TEXT DEFAULT 'curto',
  eye_color TEXT DEFAULT '#4a3728',
  outfit_color TEXT DEFAULT '#3a2c1f',
  outfit_style TEXT DEFAULT 'casual',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS character_books (
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  PRIMARY KEY (character_id, book_id)
);

CREATE TABLE IF NOT EXISTS character_chapters (
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  PRIMARY KEY (character_id, chapter_id)
);

CREATE TABLE IF NOT EXISTS places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  history TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  photo_color TEXT DEFAULT '#3a2c1f',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS place_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  order_index INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS place_books (
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  PRIMARY KEY (place_id, book_id)
);

CREATE TABLE IF NOT EXISTS place_chapters (
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  PRIMARY KEY (place_id, chapter_id)
);

CREATE TABLE IF NOT EXISTS objects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT DEFAULT '',
  description TEXT DEFAULT '',
  significance TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  photo_color TEXT DEFAULT '#5a4530',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS object_books (
  object_id INTEGER NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  PRIMARY KEY (object_id, book_id)
);

CREATE TABLE IF NOT EXISTS object_chapters (
  object_id INTEGER NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  PRIMARY KEY (object_id, chapter_id)
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  event_date TEXT DEFAULT '',
  chapter_id INTEGER REFERENCES chapters(id),
  order_index INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS special_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT NOT NULL,
  special_date TEXT NOT NULL,
  chapter_id INTEGER REFERENCES chapters(id),
  found_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS note_discoveries (
  note_id INTEGER NOT NULL REFERENCES special_notes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  discovery_year INTEGER NOT NULL,
  found_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (note_id, user_id, discovery_year)
);

CREATE TABLE IF NOT EXISTS kanban_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  chapter_id INTEGER REFERENCES chapters(id),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ideia' CHECK(status IN ('ideia', 'rascunho', 'revisao', 'pronto')),
  order_index INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scenes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT DEFAULT '',
  order_index INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chapters_book_order ON chapters(book_id, order_index);
CREATE INDEX IF NOT EXISTS idx_chapters_status_schedule ON chapters(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_comments_chapter ON comments(chapter_id, created_at);
CREATE INDEX IF NOT EXISTS idx_highlights_user ON highlights(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reading_stats_user ON reading_stats(user_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_reading_activity_chapter ON reading_activity(chapter_id);
CREATE INDEX IF NOT EXISTS idx_timeline_book_order ON timeline_events(book_id, order_index);
CREATE INDEX IF NOT EXISTS idx_kanban_book_status ON kanban_cards(book_id, status, order_index);
