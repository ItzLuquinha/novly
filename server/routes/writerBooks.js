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
  const { title, synopsis, category, warnings, writer_notes, cover_color, spine_color } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'O livro precisa de um titulo.' });
  }

  const slug = uniqueSlug(title.trim());
  const maxOrder = db.prepare('SELECT COALESCE(MAX(order_index), -1) as m FROM books').get().m;

  const result = db.prepare(`
    INSERT INTO books (title, slug, synopsis, category, warnings, writer_notes, cover_color, spine_color, order_index, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    title.trim(),
    slug,
    synopsis || '',
    category || '',
    warnings || '',
    writer_notes || '',
    cover_color || '#4a3728',
    spine_color || '#2e2015',
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
  const allowed = ['title', 'synopsis', 'category', 'status', 'warnings', 'writer_notes', 'cover_color', 'spine_color'];

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
    db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: 'Nao foi possivel excluir o livro.' });
  }

  res.json({ ok: true });
});

module.exports = router;
