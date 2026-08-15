const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

function slugify(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function uniqueSlug(baseTitle) {
  let base = slugify(baseTitle) || 'livro';
  let slug = base;
  let n = 2;
  while (db.prepare('SELECT 1 FROM books WHERE slug = ?').get(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

router.use(requireAuth, requireRole('escritor'));

router.get('/books', (req, res) => {
  const books = db.prepare('SELECT * FROM books ORDER BY order_index ASC, created_at ASC').all();
  const enriched = books.map((b) => {
    const chapterCounts = db.prepare(`
      SELECT
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'publicado' THEN 1 ELSE 0 END), 0) as published,
        COALESCE(SUM(CASE WHEN status = 'rascunho' THEN 1 ELSE 0 END), 0) as draft
      FROM chapters WHERE book_id = ?
    `).get(b.id);
    return { ...b, chapter_counts: chapterCounts };
  });
  res.json({ books: enriched });
});

router.post('/books', (req, res) => {
  const { title, synopsis, category, warnings, writer_notes, cover_color, spine_color, cover_url } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'O livro precisa de um titulo.' });
  }

  const slug = uniqueSlug(title.trim());
  const maxOrder = db.prepare('SELECT COALESCE(MAX(order_index), -1) as m FROM books').get().m;

  const result = db.prepare(`
    INSERT INTO books (title, slug, synopsis, category, warnings, writer_notes, cover_color, spine_color, cover_url, order_index, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    title.trim(),
    slug,
    synopsis || '',
    category || '',
    warnings || '',
    writer_notes || '',
    cover_color || '#4a3728',
    spine_color || '#2e2015',
    cover_url || '',
    maxOrder + 1
  );

  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ book });
});

router.patch('/books/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Livro nao encontrado.' });

  const fields = [];
  const values = [];
  const allowed = ['title', 'synopsis', 'category', 'status', 'warnings', 'writer_notes', 'cover_color', 'spine_color', 'cover_url', 'reader_guide'];

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }

  if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar.' });

  fields.push("updated_at = datetime('now')");
  values.push(req.params.id);
  db.prepare(`UPDATE books SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  res.json({ book: updated });
});

router.post('/books/:id/publish', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Livro nao encontrado.' });
  db.prepare("UPDATE books SET published_at = datetime('now') WHERE id = ?").run(req.params.id);
  const updated = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  res.json({ book: updated });
});

router.delete('/books/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Livro nao encontrado.' });

  const chapterIds = db.prepare('SELECT id FROM chapters WHERE book_id = ?')
    .all(req.params.id).map((c) => c.id);

  db.exec('BEGIN');
  try {
    if (chapterIds.length) {
      const placeholders = chapterIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM reading_progress WHERE chapter_id IN (${placeholders})`).run(...chapterIds);
      db.prepare(`DELETE FROM reading_stats WHERE chapter_id IN (${placeholders})`).run(...chapterIds);
      db.prepare(`DELETE FROM comments WHERE chapter_id IN (${placeholders})`).run(...chapterIds);
      db.prepare(`DELETE FROM highlights WHERE chapter_id IN (${placeholders})`).run(...chapterIds);
      db.prepare(`DELETE FROM bookmarks WHERE chapter_id IN (${placeholders})`).run(...chapterIds);
      db.prepare(`DELETE FROM likes WHERE target_type = 'chapter' AND target_id IN (${placeholders})`).run(...chapterIds);
      db.prepare(`DELETE FROM favorites WHERE target_type = 'chapter' AND target_id IN (${placeholders})`).run(...chapterIds);
      db.prepare(`DELETE FROM chapter_versions WHERE chapter_id IN (${placeholders})`).run(...chapterIds);
      db.prepare(`DELETE FROM scenes WHERE chapter_id IN (${placeholders})`).run(...chapterIds);
      db.prepare(`DELETE FROM character_chapters WHERE chapter_id IN (${placeholders})`).run(...chapterIds);
      db.prepare(`DELETE FROM place_chapters WHERE chapter_id IN (${placeholders})`).run(...chapterIds);
      db.prepare(`DELETE FROM object_chapters WHERE chapter_id IN (${placeholders})`).run(...chapterIds);
    }

    db.prepare('DELETE FROM reading_progress WHERE book_id = ?').run(req.params.id);
    db.prepare('DELETE FROM comments WHERE book_id = ?').run(req.params.id);
    db.prepare('DELETE FROM highlights WHERE book_id = ?').run(req.params.id);
    db.prepare('DELETE FROM writing_sessions WHERE book_id = ?').run(req.params.id);
    db.prepare('DELETE FROM special_notes WHERE chapter_id IN (SELECT id FROM chapters WHERE book_id = ?)').run(req.params.id);
    db.prepare('DELETE FROM kanban_cards WHERE book_id = ?').run(req.params.id);
    db.prepare('DELETE FROM timeline_events WHERE book_id = ?').run(req.params.id);
    db.prepare('DELETE FROM character_books WHERE book_id = ?').run(req.params.id);
    db.prepare('DELETE FROM place_books WHERE book_id = ?').run(req.params.id);
    db.prepare('DELETE FROM object_books WHERE book_id = ?').run(req.params.id);
    db.prepare("DELETE FROM favorites WHERE target_type = 'book' AND target_id = ?").run(req.params.id);
    db.prepare('DELETE FROM chapters WHERE book_id = ?').run(req.params.id);
    db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: 'Nao foi possivel excluir o livro.' });
  }

  res.json({ ok: true });
});


router.get('/books/:id/export', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Livro nao encontrado.' });

  const chapters = db.prepare(`
    SELECT title, content, order_index, status, scheduled_for, word_count, published_at
    FROM chapters WHERE book_id = ? ORDER BY order_index ASC
  `).all(req.params.id);

  const scenes = db.prepare(`
    SELECT s.title, s.summary, s.order_index, c.order_index as chapter_order
    FROM scenes s
    JOIN chapters c ON c.id = s.chapter_id
    WHERE c.book_id = ?
    ORDER BY c.order_index ASC, s.order_index ASC
  `).all(req.params.id);

  const timeline = db.prepare(`
    SELECT title, description, event_date, order_index
    FROM timeline_events WHERE book_id = ? ORDER BY order_index ASC
  `).all(req.params.id);

  const payload = {
    version: 1,
    exported_at: new Date().toISOString(),
    book: {
      title: book.title,
      synopsis: book.synopsis,
      category: book.category,
      status: book.status,
      warnings: book.warnings,
      writer_notes: book.writer_notes,
      cover_color: book.cover_color,
      spine_color: book.spine_color,
      cover_url: book.cover_url || '',
    },
    chapters,
    scenes,
    timeline,
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${book.slug || 'livro'}-novly.json"`);
  res.json(payload);
});

router.post('/books/import', (req, res) => {
  const data = req.body;
  if (!data || !data.book || !data.book.title) {
    return res.status(400).json({ error: 'Arquivo de importacao invalido.' });
  }

  const b = data.book;
  const slug = uniqueSlug(b.title.trim());
  const maxOrder = db.prepare('SELECT COALESCE(MAX(order_index), -1) as m FROM books').get().m;

  db.exec('BEGIN');
  try {
    const result = db.prepare(`
      INSERT INTO books (title, slug, synopsis, category, status, warnings, writer_notes, cover_color, spine_color, cover_url, order_index, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      b.title.trim(),
      slug,
      b.synopsis || '',
      b.category || '',
      ['em_andamento', 'concluido', 'pausado'].includes(b.status) ? b.status : 'em_andamento',
      b.warnings || '',
      b.writer_notes || '',
      b.cover_color || '#4a3728',
      b.spine_color || '#2e2015',
      b.cover_url || '',
      maxOrder + 1
    );

    const bookId = result.lastInsertRowid;
    const chapterIdByOrder = {};

    const chapters = Array.isArray(data.chapters) ? data.chapters : [];
    for (const ch of chapters) {
      const chResult = db.prepare(`
        INSERT INTO chapters (book_id, title, content, order_index, status, scheduled_for, word_count, published_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        bookId,
        ch.title || 'Capitulo',
        ch.content || '',
        ch.order_index ?? 0,
        ['rascunho', 'publicado', 'agendado'].includes(ch.status) ? ch.status : 'rascunho',
        ch.scheduled_for || null,
        ch.word_count || 0,
        ch.published_at || null
      );
      chapterIdByOrder[ch.order_index] = chResult.lastInsertRowid;
    }

    const scenes = Array.isArray(data.scenes) ? data.scenes : [];
    for (const sc of scenes) {
      const chapterId = chapterIdByOrder[sc.chapter_order];
      if (!chapterId) continue;
      db.prepare(`
        INSERT INTO scenes (chapter_id, title, summary, order_index, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(
        chapterId,
        sc.title || 'Cena',
        sc.summary || sc.description || '',
        sc.order_index ?? 0
      );
    }

    const timeline = Array.isArray(data.timeline) ? data.timeline : [];
    for (const ev of timeline) {
      db.prepare(`
        INSERT INTO timeline_events (book_id, title, description, event_date, order_index, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(
        bookId,
        ev.title || 'Evento',
        ev.description || '',
        ev.event_date || '',
        ev.order_index ?? 0
      );
    }

    db.exec('COMMIT');
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
    res.status(201).json({ book });
  } catch (err) {
    db.exec('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Nao foi possivel importar o livro.' });
  }
});
module.exports = router;
