const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { removeManagedUploadUrl, boundedString, boundedInt } = require('../security');

const router = express.Router();

function slugify(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function uniqueSlug(baseTitle) {
  let base = slugify(baseTitle) || 'livro';
  let slug = base;
  let n = 2;
  while (await db.prepare('SELECT 1 FROM books WHERE slug = ?').get(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

router.use(requireAuth, requireRole('escritor'));

router.get('/books', async (req, res) => {
  const books = await db.prepare('SELECT * FROM books ORDER BY order_index ASC, created_at ASC').all();
  const enriched = await Promise.all(books.map(async (b) => {
    const chapterCounts = await db.prepare(`
      SELECT
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'publicado' THEN 1 ELSE 0 END), 0) as published,
        COALESCE(SUM(CASE WHEN status = 'rascunho' THEN 1 ELSE 0 END), 0) as draft
      FROM chapters WHERE book_id = ?
    `).get(b.id);
    return { ...b, chapter_counts: chapterCounts };
  }));
  res.json({ books: enriched });
});

router.post('/books', async (req, res) => {
  const { title, synopsis, category, warnings, writer_notes, cover_color, spine_color, cover_url } = req.body;
  const safeTitle = boundedString(title, 300, '').trim();
  if (!safeTitle) {
    return res.status(400).json({ error: 'O livro precisa de um titulo.' });
  }

  const slug = await uniqueSlug(safeTitle);
  const maxOrder = (await db.prepare('SELECT COALESCE(MAX(order_index), -1) as m FROM books').get()).m;

  const result = await db.prepare(`
    INSERT INTO books (title, slug, synopsis, category, warnings, writer_notes, cover_color, spine_color, cover_url, order_index, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    safeTitle,
    slug,
    boundedString(synopsis, 20000, ''),
    boundedString(category, 200, ''),
    boundedString(warnings, 5000, ''),
    boundedString(writer_notes, 50000, ''),
    boundedString(cover_color, 64, '#4a3728'),
    boundedString(spine_color, 64, '#2e2015'),
    boundedString(cover_url, 2048, ''),
    maxOrder + 1
  );

  const book = await db.prepare('SELECT * FROM books WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ book });
});

router.patch('/books/:id', async (req, res) => {
  const book = await db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Livro nao encontrado.' });

  const fields = [];
  const values = [];
  const allowed = ['title', 'synopsis', 'category', 'status', 'warnings', 'writer_notes', 'cover_color', 'spine_color', 'cover_url', 'reader_guide'];

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      if (key === 'status' && !['em_andamento', 'concluido', 'pausado'].includes(req.body[key])) {
        return res.status(400).json({ error: 'Status do livro invalido.' });
      }
      if (key === 'title' && !boundedString(req.body[key], 300, '').trim()) {
        return res.status(400).json({ error: 'O livro precisa de um titulo.' });
      }
      const limits = {
        title: 300, synopsis: 20000, category: 200, warnings: 5000,
        writer_notes: 50000, cover_color: 64, spine_color: 64,
        cover_url: 2048, reader_guide: 50000,
      };
      fields.push(`${key} = ?`);
      values.push(key === 'status' ? req.body[key] : boundedString(req.body[key], limits[key] || 5000, ''));
    }
  }

  if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar.' });

  fields.push("updated_at = datetime('now')");
  values.push(req.params.id);
  await db.prepare(`UPDATE books SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  if (req.body.cover_url !== undefined && req.body.cover_url !== book.cover_url) await removeManagedUploadUrl(book.cover_url);

  const updated = await db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  res.json({ book: updated });
});

router.post('/books/:id/publish', async (req, res) => {
  const book = await db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Livro nao encontrado.' });
  await db.prepare("UPDATE books SET published_at = datetime('now') WHERE id = ?").run(req.params.id);
  const updated = await db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  res.json({ book: updated });
});

router.delete('/books/:id', async (req, res) => {
  const book = await db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Livro nao encontrado.' });

  const bookId = req.params.id;
  const statements = [
    db.prepare('UPDATE users SET favorite_book_id = NULL WHERE favorite_book_id = ?').bind(bookId),
    db.prepare('UPDATE users SET favorite_chapter_id = NULL WHERE favorite_chapter_id IN (SELECT id FROM chapters WHERE book_id = ?)').bind(bookId),
    db.prepare("DELETE FROM likes WHERE target_type = 'comment' AND target_id IN (SELECT id FROM comments WHERE book_id = ? OR chapter_id IN (SELECT id FROM chapters WHERE book_id = ?))").bind(bookId, bookId),
    db.prepare("DELETE FROM likes WHERE target_type = 'highlight' AND target_id IN (SELECT id FROM highlights WHERE book_id = ? OR chapter_id IN (SELECT id FROM chapters WHERE book_id = ?))").bind(bookId, bookId),
    db.prepare("DELETE FROM favorites WHERE target_type = 'highlight' AND target_id IN (SELECT id FROM highlights WHERE book_id = ? OR chapter_id IN (SELECT id FROM chapters WHERE book_id = ?))").bind(bookId, bookId),
    db.prepare("DELETE FROM likes WHERE target_type = 'chapter' AND target_id IN (SELECT id FROM chapters WHERE book_id = ?)").bind(bookId),
    db.prepare("DELETE FROM favorites WHERE target_type = 'chapter' AND target_id IN (SELECT id FROM chapters WHERE book_id = ?)").bind(bookId),
    db.prepare('DELETE FROM reading_progress WHERE book_id = ? OR chapter_id IN (SELECT id FROM chapters WHERE book_id = ?)').bind(bookId, bookId),
    db.prepare('DELETE FROM reading_stats WHERE chapter_id IN (SELECT id FROM chapters WHERE book_id = ?)').bind(bookId),
    db.prepare('DELETE FROM reading_activity WHERE chapter_id IN (SELECT id FROM chapters WHERE book_id = ?)').bind(bookId),
    db.prepare('DELETE FROM comments WHERE book_id = ? OR chapter_id IN (SELECT id FROM chapters WHERE book_id = ?)').bind(bookId, bookId),
    db.prepare('DELETE FROM highlights WHERE book_id = ? OR chapter_id IN (SELECT id FROM chapters WHERE book_id = ?)').bind(bookId, bookId),
    db.prepare('DELETE FROM bookmarks WHERE chapter_id IN (SELECT id FROM chapters WHERE book_id = ?)').bind(bookId),
    db.prepare('DELETE FROM chapter_versions WHERE chapter_id IN (SELECT id FROM chapters WHERE book_id = ?)').bind(bookId),
    db.prepare('DELETE FROM scenes WHERE chapter_id IN (SELECT id FROM chapters WHERE book_id = ?)').bind(bookId),
    db.prepare('DELETE FROM character_chapters WHERE chapter_id IN (SELECT id FROM chapters WHERE book_id = ?)').bind(bookId),
    db.prepare('DELETE FROM place_chapters WHERE chapter_id IN (SELECT id FROM chapters WHERE book_id = ?)').bind(bookId),
    db.prepare('DELETE FROM object_chapters WHERE chapter_id IN (SELECT id FROM chapters WHERE book_id = ?)').bind(bookId),
    db.prepare('DELETE FROM special_notes WHERE chapter_id IN (SELECT id FROM chapters WHERE book_id = ?)').bind(bookId),
    db.prepare('DELETE FROM writing_sessions WHERE book_id = ? OR chapter_id IN (SELECT id FROM chapters WHERE book_id = ?)').bind(bookId, bookId),
    db.prepare('DELETE FROM kanban_cards WHERE book_id = ?').bind(bookId),
    db.prepare('DELETE FROM timeline_events WHERE book_id = ?').bind(bookId),
    db.prepare('DELETE FROM character_books WHERE book_id = ?').bind(bookId),
    db.prepare('DELETE FROM place_books WHERE book_id = ?').bind(bookId),
    db.prepare('DELETE FROM object_books WHERE book_id = ?').bind(bookId),
    db.prepare("DELETE FROM favorites WHERE target_type = 'book' AND target_id = ?").bind(bookId),
    db.prepare('DELETE FROM chapters WHERE book_id = ?').bind(bookId),
    db.prepare('DELETE FROM books WHERE id = ?').bind(bookId),
  ];
  try {
    await db.batch(statements);
  } catch (err) {
    console.error('book delete failed', err);
    return res.status(500).json({ error: 'Nao foi possivel excluir o livro.' });
  }

  await removeManagedUploadUrl(book.cover_url);
  res.json({ ok: true });
});


router.get('/books/:id/export', async (req, res) => {
  const book = await db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Livro nao encontrado.' });

  const chapters = await db.prepare(`
    SELECT title, content, order_index, status, scheduled_for, word_count, published_at
    FROM chapters WHERE book_id = ? ORDER BY order_index ASC
  `).all(req.params.id);

  const scenes = await db.prepare(`
    SELECT s.title, s.summary, s.order_index, c.order_index as chapter_order
    FROM scenes s
    JOIN chapters c ON c.id = s.chapter_id
    WHERE c.book_id = ?
    ORDER BY c.order_index ASC, s.order_index ASC
  `).all(req.params.id);

  const timeline = await db.prepare(`
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

router.post('/books/import', async (req, res) => {
  const data = req.body;
  if (!data || typeof data !== 'object' || !data.book || typeof data.book !== 'object') {
    return res.status(400).json({ error: 'Arquivo de importacao invalido.' });
  }

  const b = data.book;
  const safeTitle = boundedString(b.title, 300, '').trim();
  if (!safeTitle) return res.status(400).json({ error: 'Arquivo de importacao invalido: livro sem titulo.' });

  // Normalize before sending the arrays to SQLite's json_each(). This keeps an import
  // to a handful of D1 queries (important on Workers Free) instead of one query per row.
  const chapters = (Array.isArray(data.chapters) ? data.chapters : []).slice(0, 1000)
    .filter((ch) => ch && typeof ch === 'object')
    .map((ch) => ({
      title: boundedString(ch.title, 300, 'Capitulo').trim() || 'Capitulo',
      content: boundedString(ch.content, 1_500_000, ''),
      order_index: boundedInt(ch.order_index, 0, 1_000_000, 0),
      status: ['rascunho', 'publicado', 'agendado'].includes(ch.status) ? ch.status : 'rascunho',
      scheduled_for: boundedString(ch.scheduled_for, 64, '') || null,
      word_count: boundedInt(ch.word_count, 0, 5_000_000, 0),
      published_at: boundedString(ch.published_at, 64, '') || null,
    }));
  if (chapters.some((ch) => Buffer.byteLength(ch.content, 'utf8') > 1_800_000)) {
    return res.status(413).json({ error: 'Um dos capitulos excede o limite do D1. Divida esse capitulo antes de importar.' });
  }
  const chapterOrders = new Set(chapters.map((ch) => ch.order_index));
  const scenes = (Array.isArray(data.scenes) ? data.scenes : []).slice(0, 5000)
    .filter((sc) => sc && typeof sc === 'object')
    .map((sc) => ({
      chapter_order: boundedInt(sc.chapter_order, 0, 1_000_000, 0),
      title: boundedString(sc.title, 300, 'Cena').trim() || 'Cena',
      summary: boundedString(sc.summary ?? sc.description, 10000, ''),
      order_index: boundedInt(sc.order_index, 0, 1_000_000, 0),
    }))
    .filter((sc) => chapterOrders.has(sc.chapter_order));
  const timeline = (Array.isArray(data.timeline) ? data.timeline : []).slice(0, 5000)
    .filter((ev) => ev && typeof ev === 'object')
    .map((ev) => ({
      title: boundedString(ev.title, 300, 'Evento').trim() || 'Evento',
      description: boundedString(ev.description, 5000, ''),
      event_date: boundedString(ev.event_date, 120, ''),
      order_index: boundedInt(ev.order_index, 0, 1_000_000, 0),
    }));

  const chapterJson = JSON.stringify(chapters);
  const sceneJson = JSON.stringify(scenes);
  const timelineJson = JSON.stringify(timeline);
  if ([chapterJson, sceneJson, timelineJson].some((value) => Buffer.byteLength(value, 'utf8') > 1_900_000)) {
    return res.status(413).json({ error: 'Importacao grande demais para uma unica operacao. Divida o livro antes de importar.' });
  }

  const slug = await uniqueSlug(safeTitle);
  const slot = await db.prepare(`
    SELECT COALESCE(MAX(id), 0) + 1 AS next_id,
           COALESCE(MAX(order_index), -1) + 1 AS next_order
    FROM books
  `).get();
  const bookId = Number(slot.next_id);
  const coverUrl = /^https:\/\//i.test(String(b.cover_url || '')) ? boundedString(b.cover_url, 2048, '') : '';

  try {
    await db.batch([
      db.prepare(`
        INSERT INTO books (id, title, slug, synopsis, category, status, warnings, writer_notes, cover_color, spine_color, cover_url, order_index, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        bookId,
        safeTitle,
        slug,
        boundedString(b.synopsis, 20000, ''),
        boundedString(b.category, 200, ''),
        ['em_andamento', 'concluido', 'pausado'].includes(b.status) ? b.status : 'em_andamento',
        boundedString(b.warnings, 5000, ''),
        boundedString(b.writer_notes, 50000, ''),
        boundedString(b.cover_color, 64, '#4a3728'),
        boundedString(b.spine_color, 64, '#2e2015'),
        coverUrl,
        Number(slot.next_order)
      ),
      db.prepare(`
        INSERT INTO chapters (book_id, title, content, order_index, status, scheduled_for, word_count, published_at, created_at, updated_at)
        SELECT ?,
          json_extract(j.value, '$.title'),
          json_extract(j.value, '$.content'),
          CAST(json_extract(j.value, '$.order_index') AS INTEGER),
          json_extract(j.value, '$.status'),
          json_extract(j.value, '$.scheduled_for'),
          CAST(json_extract(j.value, '$.word_count') AS INTEGER),
          json_extract(j.value, '$.published_at'),
          datetime('now'), datetime('now')
        FROM json_each(?) AS j
      `).bind(bookId, chapterJson),
      db.prepare(`
        INSERT INTO scenes (chapter_id, title, summary, order_index, created_at)
        SELECT ch.id,
          json_extract(j.value, '$.title'),
          json_extract(j.value, '$.summary'),
          CAST(json_extract(j.value, '$.order_index') AS INTEGER),
          datetime('now')
        FROM json_each(?) AS j
        JOIN chapters ch
          ON ch.book_id = ?
         AND ch.order_index = CAST(json_extract(j.value, '$.chapter_order') AS INTEGER)
      `).bind(sceneJson, bookId),
      db.prepare(`
        INSERT INTO timeline_events (book_id, title, description, event_date, order_index, created_at)
        SELECT ?,
          json_extract(j.value, '$.title'),
          json_extract(j.value, '$.description'),
          json_extract(j.value, '$.event_date'),
          CAST(json_extract(j.value, '$.order_index') AS INTEGER),
          datetime('now')
        FROM json_each(?) AS j
      `).bind(bookId, timelineJson),
    ]);

    const book = await db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
    return res.status(201).json({ book });
  } catch (err) {
    console.error('book import failed', err);
    return res.status(500).json({ error: 'Nao foi possivel importar o livro.' });
  }
});
module.exports = router;
