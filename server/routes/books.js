const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

function bookWithStats(book, userId) {
  const chapters = db.prepare(`
    SELECT id, title, order_index, status, word_count, published_at
    FROM chapters WHERE book_id = ? ORDER BY order_index ASC
  `).all(book.id);

  const readChapterIds = new Set(
    db.prepare(`
      SELECT chapter_id FROM reading_stats WHERE user_id = ?
    `).all(userId).map((r) => r.chapter_id)
  );

  const chaptersWithReadFlag = chapters.map((c) => ({
    ...c,
    is_read: readChapterIds.has(c.id),
  }));

  const publishedChapters = chapters.filter(c => c.status === 'publicado');
  const totalWords = publishedChapters.reduce((sum, c) => sum + (c.word_count || 0), 0);

  const readCount = publishedChapters.filter((c) => readChapterIds.has(c.id)).length;

  const progress = db.prepare(`
    SELECT * FROM reading_progress WHERE user_id = ? AND book_id = ?
  `).get(userId, book.id);

  const readerCount = db.prepare(`
    SELECT COUNT(DISTINCT user_id) as c FROM reading_stats rs
    JOIN chapters ch ON ch.id = rs.chapter_id WHERE ch.book_id = ?
  `).get(book.id).c;

  const percentComplete = publishedChapters.length
    ? Math.round((readCount / publishedChapters.length) * 100)
    : 0;

  return {
    ...book,
    chapters: chaptersWithReadFlag,
    published_chapter_count: publishedChapters.length,
    total_word_count: totalWords,
    estimated_minutes: Math.ceil(totalWords / 200),
    percent_complete: percentComplete,
    is_completed: publishedChapters.length > 0 && percentComplete === 100,
    reader_count: readerCount,
    current_progress: progress || null,
  };
}

router.get('/', requireAuth, (req, res) => {
  const isWriter = req.user.role === 'escritor';
  const books = db.prepare(`
    SELECT * FROM books ORDER BY order_index ASC, created_at ASC
  `).all();

  const visible = isWriter ? books : books.filter(b => b.published_at);
  const enriched = visible.map(b => bookWithStats(b, req.user.id));
  res.json({ books: enriched });
});

router.get('/:slug', requireAuth, (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE slug = ?').get(req.params.slug);
  if (!book) return res.status(404).json({ error: 'Livro nao encontrado.' });
  if (!book.published_at && req.user.role !== 'escritor') {
    return res.status(403).json({ error: 'Este livro ainda nao foi publicado.' });
  }
  res.json({ book: bookWithStats(book, req.user.id) });
});

router.get('/:slug/chapters/:chapterId', requireAuth, (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE slug = ?').get(req.params.slug);
  if (!book) return res.status(404).json({ error: 'Livro nao encontrado.' });

  const chapter = db.prepare('SELECT * FROM chapters WHERE id = ? AND book_id = ?')
    .get(req.params.chapterId, book.id);
  if (!chapter) return res.status(404).json({ error: 'Capitulo nao encontrado.' });

  if (chapter.status !== 'publicado' && req.user.role !== 'escritor') {
    return res.status(403).json({ error: 'Este capitulo ainda nao foi publicado.' });
  }

  const allChapters = db.prepare(`
    SELECT id, title, order_index, status FROM chapters
    WHERE book_id = ? ${req.user.role === 'escritor' ? '' : "AND status = 'publicado'"}
    ORDER BY order_index ASC
  `).all(book.id);

  const idx = allChapters.findIndex(c => c.id === chapter.id);
  const prevChapter = idx > 0 ? allChapters[idx - 1] : null;
  const nextChapter = idx < allChapters.length - 1 ? allChapters[idx + 1] : null;

  const isFavorite = db.prepare(`
    SELECT 1 FROM favorites WHERE user_id = ? AND target_type = 'chapter' AND target_id = ?
  `).get(req.user.id, chapter.id);

  const isLiked = db.prepare(`
    SELECT 1 FROM likes WHERE user_id = ? AND target_type = 'chapter' AND target_id = ?
  `).get(req.user.id, chapter.id);

  const bookmark = db.prepare(`
    SELECT * FROM bookmarks WHERE user_id = ? AND chapter_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(req.user.id, chapter.id);

  res.json({
    chapter,
    book: { id: book.id, title: book.title, slug: book.slug },
    prev_chapter: prevChapter,
    next_chapter: nextChapter,
    is_favorite: !!isFavorite,
    is_liked: !!isLiked,
    bookmark: bookmark || null,
  });
});

router.post('/:slug/chapters/:chapterId/progress', requireAuth, (req, res) => {
  const { scroll_position, char_offset } = req.body;
  const book = db.prepare('SELECT * FROM books WHERE slug = ?').get(req.params.slug);
  if (!book) return res.status(404).json({ error: 'Livro nao encontrado.' });

  db.prepare(`
    INSERT INTO reading_progress (user_id, book_id, chapter_id, scroll_position, char_offset, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, book_id) DO UPDATE SET
      chapter_id = excluded.chapter_id,
      scroll_position = excluded.scroll_position,
      char_offset = excluded.char_offset,
      updated_at = datetime('now')
  `).run(req.user.id, book.id, req.params.chapterId, scroll_position || 0, char_offset || 0);

  res.json({ ok: true });
});

router.post('/:slug/chapters/:chapterId/complete', requireAuth, (req, res) => {
  const { seconds_spent } = req.body;
  db.prepare(`
    INSERT INTO reading_stats (user_id, chapter_id, completed_at, seconds_spent)
    VALUES (?, ?, datetime('now'), ?)
    ON CONFLICT(user_id, chapter_id) DO UPDATE SET seconds_spent = seconds_spent + excluded.seconds_spent
  `).run(req.user.id, req.params.chapterId, seconds_spent || 0);
  res.json({ ok: true });
});

router.post('/:slug/chapters/:chapterId/like', requireAuth, (req, res) => {
  try {
    db.prepare(`
      INSERT INTO likes (user_id, target_type, target_id) VALUES (?, 'chapter', ?)
    `).run(req.user.id, req.params.chapterId);
  } catch (e) {
    db.prepare(`DELETE FROM likes WHERE user_id = ? AND target_type = 'chapter' AND target_id = ?`)
      .run(req.user.id, req.params.chapterId);
    return res.json({ liked: false });
  }
  res.json({ liked: true });
});

router.post('/:slug/chapters/:chapterId/favorite', requireAuth, (req, res) => {
  try {
    db.prepare(`
      INSERT INTO favorites (user_id, target_type, target_id) VALUES (?, 'chapter', ?)
    `).run(req.user.id, req.params.chapterId);
  } catch (e) {
    db.prepare(`DELETE FROM favorites WHERE user_id = ? AND target_type = 'chapter' AND target_id = ?`)
      .run(req.user.id, req.params.chapterId);
    return res.json({ favorited: false });
  }
  res.json({ favorited: true });
});

module.exports = router;
