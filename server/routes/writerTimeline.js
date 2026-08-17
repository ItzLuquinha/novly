const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { positiveInt, boundedString } = require('../security');

const router = express.Router();

router.use(requireAuth, requireRole('escritor'));

function chapterIdForBook(value, bookId) {
  if (value === undefined || value === null || value === '') return { chapterId: null };
  const chapterId = positiveInt(value);
  if (!chapterId) return { error: 'Capitulo invalido.' };
  const chapter = db.prepare('SELECT id FROM chapters WHERE id = ? AND book_id = ?').get(chapterId, bookId);
  if (!chapter) return { error: 'O capitulo precisa pertencer ao mesmo livro do evento.' };
  return { chapterId };
}

router.get('/books/:bookId/timeline', (req, res) => {
  const events = db.prepare(`
    SELECT te.*, c.title as chapter_title FROM timeline_events te
    LEFT JOIN chapters c ON c.id = te.chapter_id
    WHERE te.book_id = ? ORDER BY te.order_index ASC
  `).all(req.params.bookId);
  res.json({ events });
});

router.post('/books/:bookId/timeline', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.bookId);
  if (!book) return res.status(404).json({ error: 'Livro nao encontrado.' });

  const { title, description, event_date, chapter_id } = req.body;
  const safeTitle = boundedString(title, 300, '').trim();
  if (!safeTitle) {
    return res.status(400).json({ error: 'O evento precisa de um titulo.' });
  }
  const chapterCheck = chapterIdForBook(chapter_id, Number(req.params.bookId));
  if (chapterCheck.error) return res.status(400).json({ error: chapterCheck.error });

  const maxOrder = db.prepare('SELECT COALESCE(MAX(order_index), -1) as m FROM timeline_events WHERE book_id = ?')
    .get(req.params.bookId).m;

  const result = db.prepare(`
    INSERT INTO timeline_events (book_id, title, description, event_date, chapter_id, order_index, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    req.params.bookId,
    safeTitle,
    boundedString(description, 5000, ''),
    boundedString(event_date, 120, ''),
    chapterCheck.chapterId,
    maxOrder + 1
  );

  const event = db.prepare(`
    SELECT te.*, c.title as chapter_title FROM timeline_events te
    LEFT JOIN chapters c ON c.id = te.chapter_id WHERE te.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ event });
});

const editableFields = ['title', 'description', 'event_date', 'chapter_id'];

router.patch('/timeline/:id', (req, res) => {
  const event = db.prepare('SELECT * FROM timeline_events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Evento nao encontrado.' });

  const fields = [];
  const values = [];
  for (const key of editableFields) {
    if (req.body[key] === undefined) continue;
    if (key === 'chapter_id') {
      const chapterCheck = chapterIdForBook(req.body[key], event.book_id);
      if (chapterCheck.error) return res.status(400).json({ error: chapterCheck.error });
      fields.push('chapter_id = ?'); values.push(chapterCheck.chapterId);
      continue;
    }
    if (key === 'title') {
      const safeTitle = boundedString(req.body[key], 300, '').trim();
      if (!safeTitle) return res.status(400).json({ error: 'O evento precisa de um titulo.' });
      fields.push('title = ?'); values.push(safeTitle);
      continue;
    }
    fields.push(`${key} = ?`);
    values.push(boundedString(req.body[key], key === 'description' ? 5000 : 120, ''));
  }
  if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar.' });

  values.push(req.params.id);
  db.prepare(`UPDATE timeline_events SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare(`
    SELECT te.*, c.title as chapter_title FROM timeline_events te
    LEFT JOIN chapters c ON c.id = te.chapter_id WHERE te.id = ?
  `).get(req.params.id);
  res.json({ event: updated });
});

router.delete('/timeline/:id', (req, res) => {
  const event = db.prepare('SELECT * FROM timeline_events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Evento nao encontrado.' });
  db.prepare('DELETE FROM timeline_events WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/timeline/:id/reorder', (req, res) => {
  const { direction } = req.body;
  if (!['up', 'down'].includes(direction)) {
    return res.status(400).json({ error: 'Direcao invalida.' });
  }
  const event = db.prepare('SELECT * FROM timeline_events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Evento nao encontrado.' });

  const neighbor = direction === 'up'
    ? db.prepare('SELECT * FROM timeline_events WHERE book_id = ? AND order_index < ? ORDER BY order_index DESC LIMIT 1')
        .get(event.book_id, event.order_index)
    : db.prepare('SELECT * FROM timeline_events WHERE book_id = ? AND order_index > ? ORDER BY order_index ASC LIMIT 1')
        .get(event.book_id, event.order_index);

  if (!neighbor) return res.json({ ok: true });

  db.prepare('UPDATE timeline_events SET order_index = ? WHERE id = ?').run(neighbor.order_index, event.id);
  db.prepare('UPDATE timeline_events SET order_index = ? WHERE id = ?').run(event.order_index, neighbor.id);

  res.json({ ok: true });
});

module.exports = router;
