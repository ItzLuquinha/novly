const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { publishDueChapters } = require('../publishing');
const { boundedNumber, boundedInt, getBookAndChapterBySlug } = require('../security');

const router = express.Router();

function safeBookForReader(book) {
  return {
    id: book.id,
    title: book.title,
    slug: book.slug,
    synopsis: book.synopsis || '',
    cover_color: book.cover_color,
    spine_color: book.spine_color,
    cover_url: book.cover_url || '',
    reader_guide: book.reader_guide || '',
    category: book.category || '',
    status: book.status,
    warnings: book.warnings || '',
    published_at: book.published_at,
    order_index: book.order_index || 0,
    created_at: book.created_at,
    updated_at: book.updated_at,
  };
}

async function bookWithStats(book, user, readChapterIdsPreload = null) {
  const isWriter = user.role === 'escritor';
  const chapters = await db.prepare(`
    SELECT id, title, order_index, status, word_count, published_at, scheduled_for
    FROM chapters
    WHERE book_id = ? ${isWriter ? '' : "AND status = 'publicado'"}
    ORDER BY order_index ASC
  `).all(book.id);

  const readChapterIds = readChapterIdsPreload || new Set(
    (await db.prepare('SELECT chapter_id FROM reading_stats WHERE user_id = ?')
      .all(user.id)).map((r) => r.chapter_id)
  );

  const chaptersWithReadFlag = chapters.map((c) => ({
    ...c,
    ...(isWriter ? {} : { scheduled_for: undefined }),
    is_read: readChapterIds.has(c.id),
  }));

  const publishedChapters = chapters.filter((c) => c.status === 'publicado');
  const totalWords = publishedChapters.reduce((sum, c) => sum + (c.word_count || 0), 0);
  const readCount = publishedChapters.filter((c) => readChapterIds.has(c.id)).length;
  let progress = await db.prepare('SELECT * FROM reading_progress WHERE user_id = ? AND book_id = ?')
    .get(user.id, book.id);
  if (!isWriter && progress && !publishedChapters.some((c) => c.id === progress.chapter_id)) progress = null;
  const readerCount = (await db.prepare(`
    SELECT COUNT(DISTINCT user_id) as c FROM reading_stats rs
    JOIN chapters ch ON ch.id = rs.chapter_id WHERE ch.book_id = ?
  `).get(book.id)).c;
  const percentComplete = publishedChapters.length ? Math.round((readCount / publishedChapters.length) * 100) : 0;

  return {
    ...(isWriter ? book : safeBookForReader(book)),
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

async function booksWithStatsBulk(books, user) {
  if (!books.length) return [];
  const isWriter = user.role === 'escritor';
  const [allChapters, readRows, progressRows, readerRows] = await Promise.all([
    db.prepare(`
      SELECT id, book_id, title, order_index, status, word_count, published_at, scheduled_for
      FROM chapters
      ORDER BY book_id ASC, order_index ASC
    `).all(),
    db.prepare('SELECT chapter_id FROM reading_stats WHERE user_id = ?').all(user.id),
    db.prepare('SELECT * FROM reading_progress WHERE user_id = ?').all(user.id),
    db.prepare(`
      SELECT ch.book_id, COUNT(DISTINCT rs.user_id) AS c
      FROM reading_stats rs JOIN chapters ch ON ch.id = rs.chapter_id
      GROUP BY ch.book_id
    `).all(),
  ]);
  const readIds = new Set(readRows.map((r) => r.chapter_id));
  const chaptersByBook = new Map();
  for (const chapter of allChapters) {
    if (!isWriter && chapter.status !== 'publicado') continue;
    if (!chaptersByBook.has(chapter.book_id)) chaptersByBook.set(chapter.book_id, []);
    chaptersByBook.get(chapter.book_id).push(chapter);
  }
  const progressByBook = new Map(progressRows.map((row) => [row.book_id, row]));
  const readerCountByBook = new Map(readerRows.map((row) => [row.book_id, Number(row.c || 0)]));

  return books.map((book) => {
    const chapters = chaptersByBook.get(book.id) || [];
    const chaptersWithReadFlag = chapters.map((c) => ({
      ...c,
      ...(isWriter ? {} : { scheduled_for: undefined }),
      is_read: readIds.has(c.id),
    }));
    const published = chapters.filter((c) => c.status === 'publicado');
    const totalWords = published.reduce((sum, c) => sum + Number(c.word_count || 0), 0);
    const readCount = published.filter((c) => readIds.has(c.id)).length;
    const percentComplete = published.length ? Math.round((readCount / published.length) * 100) : 0;
    let progress = progressByBook.get(book.id) || null;
    if (!isWriter && progress && !published.some((c) => c.id === progress.chapter_id)) progress = null;
    return {
      ...(isWriter ? book : safeBookForReader(book)),
      chapters: chaptersWithReadFlag,
      published_chapter_count: published.length,
      total_word_count: totalWords,
      estimated_minutes: Math.ceil(totalWords / 200),
      percent_complete: percentComplete,
      is_completed: published.length > 0 && percentComplete === 100,
      reader_count: readerCountByBook.get(book.id) || 0,
      current_progress: progress,
    };
  });
}

router.get('/', requireAuth, async (req, res) => {
  await publishDueChapters();
  const books = await db.prepare('SELECT * FROM books ORDER BY order_index ASC, created_at ASC').all();
  const visible = req.user.role === 'escritor' ? books : books.filter((b) => b.published_at);
  res.json({ books: await booksWithStatsBulk(visible, req.user) });
});

router.get('/:slug', requireAuth, async (req, res) => {
  await publishDueChapters();
  const book = await db.prepare('SELECT * FROM books WHERE slug = ?').get(req.params.slug);
  if (!book) return res.status(404).json({ error: 'Livro nao encontrado.' });
  if (!book.published_at && req.user.role !== 'escritor') return res.status(403).json({ error: 'Este livro ainda nao foi publicado.' });
  res.json({ book: await bookWithStats(book, req.user) });
});

router.get('/:slug/chapters/:chapterId', requireAuth, async (req, res) => {
  await publishDueChapters();
  const access = await getBookAndChapterBySlug(req.params.slug, req.params.chapterId, req.user);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });
  const { book, chapter } = access;

  const allChapters = await db.prepare(`
    SELECT id, title, order_index, status FROM chapters
    WHERE book_id = ? ${req.user.role === 'escritor' ? '' : "AND status = 'publicado'"}
    ORDER BY order_index ASC
  `).all(book.id);
  const idx = allChapters.findIndex((c) => c.id === chapter.id);
  const prevChapter = idx > 0 ? allChapters[idx - 1] : null;
  const nextChapter = idx < allChapters.length - 1 ? allChapters[idx + 1] : null;
  const isFavorite = await db.prepare("SELECT 1 FROM favorites WHERE user_id = ? AND target_type = 'chapter' AND target_id = ?").get(req.user.id, chapter.id);
  const isLiked = await db.prepare("SELECT 1 FROM likes WHERE user_id = ? AND target_type = 'chapter' AND target_id = ?").get(req.user.id, chapter.id);
  const bookmark = await db.prepare('SELECT * FROM bookmarks WHERE user_id = ? AND chapter_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(req.user.id, chapter.id);
  const currentProgress = await db.prepare('SELECT scroll_position, char_offset, progress_percent, updated_at FROM reading_progress WHERE user_id = ? AND book_id = ? AND chapter_id = ?')
    .get(req.user.id, book.id, chapter.id);

  res.json({
    chapter,
    book: { id: book.id, title: book.title, slug: book.slug, reader_guide: book.reader_guide || '' },
    prev_chapter: prevChapter,
    next_chapter: nextChapter,
    is_favorite: !!isFavorite,
    is_liked: !!isLiked,
    bookmark: bookmark || null,
    current_progress: currentProgress || null,
  });
});

router.post('/:slug/chapters/:chapterId/progress', requireAuth, async (req, res) => {
  const access = await getBookAndChapterBySlug(req.params.slug, req.params.chapterId, req.user);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });
  const { book, chapter } = access;

  const scrollPosition = boundedNumber(req.body?.scroll_position, 0, 10_000_000, 0);
  const charOffset = boundedInt(req.body?.char_offset, 0, Math.max(0, chapter.content.length), 0);
  const progressPercent = boundedNumber(req.body?.progress_percent, 0, 100, 0);

  const activity = await db.prepare('SELECT accumulated_seconds, last_ping_at FROM reading_activity WHERE user_id = ? AND chapter_id = ?')
    .get(req.user.id, chapter.id);
  const activityStatement = activity
    ? db.prepare(`
        UPDATE reading_activity
        SET accumulated_seconds = accumulated_seconds + MIN(30, MAX(0, CAST((julianday('now') - julianday(last_ping_at)) * 86400 AS INTEGER))),
            last_ping_at = datetime('now')
        WHERE user_id = ? AND chapter_id = ?
      `).bind(req.user.id, chapter.id)
    : db.prepare("INSERT INTO reading_activity (user_id, chapter_id, accumulated_seconds, last_ping_at) VALUES (?, ?, 0, datetime('now'))")
      .bind(req.user.id, chapter.id);

  await db.batch([
    db.prepare(`
      INSERT INTO reading_progress (user_id, book_id, chapter_id, scroll_position, char_offset, progress_percent, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, book_id) DO UPDATE SET
        chapter_id = excluded.chapter_id,
        scroll_position = excluded.scroll_position,
        char_offset = excluded.char_offset,
        progress_percent = excluded.progress_percent,
        updated_at = datetime('now')
    `).bind(req.user.id, book.id, chapter.id, scrollPosition, charOffset, progressPercent),
    activityStatement,
  ]);

  res.json({ ok: true });
});

router.post('/:slug/chapters/:chapterId/complete', requireAuth, async (req, res) => {
  const access = await getBookAndChapterBySlug(req.params.slug, req.params.chapterId, req.user);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });
  const { book, chapter } = access;

  const progress = await db.prepare('SELECT progress_percent FROM reading_progress WHERE user_id = ? AND book_id = ? AND chapter_id = ?')
    .get(req.user.id, book.id, chapter.id);
  if (req.user.role !== 'escritor' && (!progress || Number(progress.progress_percent || 0) < 85)) {
    return res.status(400).json({ error: 'Leia pelo menos 85% do capitulo antes de conclui-lo.' });
  }

  const activity = await db.prepare('SELECT accumulated_seconds FROM reading_activity WHERE user_id = ? AND chapter_id = ?')
    .get(req.user.id, chapter.id);
  const secondsSpent = boundedInt(activity?.accumulated_seconds || 0, 0, 24 * 60 * 60, 0);
  // Keep the threshold forgiving, but proportional to chapter length. At ~480 wpm
  // a reader can still read quickly without a 5-second open counting as completion.
  const minimumReadingSeconds = Math.min(180, Math.max(10, Math.ceil((Number(chapter.word_count || 0) * 0.85) / 8)));
  if (req.user.role !== 'escritor' && secondsSpent < minimumReadingSeconds) {
    return res.status(400).json({
      error: 'Tempo de leitura insuficiente para concluir o capitulo.',
      minimum_seconds: minimumReadingSeconds,
    });
  }

  await db.prepare(`
    INSERT INTO reading_stats (user_id, chapter_id, completed_at, seconds_spent)
    VALUES (?, ?, datetime('now'), ?)
    ON CONFLICT(user_id, chapter_id) DO UPDATE SET
      seconds_spent = MAX(reading_stats.seconds_spent, excluded.seconds_spent)
  `).run(req.user.id, chapter.id, secondsSpent);
  res.json({ ok: true, seconds_spent: secondsSpent });
});

router.post('/:slug/chapters/:chapterId/like', requireAuth, async (req, res) => {
  const access = await getBookAndChapterBySlug(req.params.slug, req.params.chapterId, req.user);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });
  try {
    await db.prepare("INSERT INTO likes (user_id, target_type, target_id) VALUES (?, 'chapter', ?)").run(req.user.id, access.chapter.id);
  } catch (_) {
    await db.prepare("DELETE FROM likes WHERE user_id = ? AND target_type = 'chapter' AND target_id = ?").run(req.user.id, access.chapter.id);
    return res.json({ liked: false });
  }
  res.json({ liked: true });
});

router.post('/:slug/chapters/:chapterId/favorite', requireAuth, async (req, res) => {
  const access = await getBookAndChapterBySlug(req.params.slug, req.params.chapterId, req.user);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });
  try {
    await db.prepare("INSERT INTO favorites (user_id, target_type, target_id) VALUES (?, 'chapter', ?)").run(req.user.id, access.chapter.id);
  } catch (_) {
    await db.prepare("DELETE FROM favorites WHERE user_id = ? AND target_type = 'chapter' AND target_id = ?").run(req.user.id, access.chapter.id);
    return res.json({ favorited: false });
  }
  res.json({ favorited: true });
});

module.exports = router;
