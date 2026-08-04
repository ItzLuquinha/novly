const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

router.use(requireAuth, requireRole('escritor'));

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
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'O evento precisa de um titulo.' });
  }

  const maxOrder = db.prepare('SELECT COALESCE(MAX(order_index), -1) as m FROM timeline_events WHERE book_id = ?')
    .get(req.params.bookId).m;

  const result = db.prepare(`
    INSERT INTO timeline_events (book_id, title, description, event_date, chapter_id, order_index, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    req.params.bookId,
    title.trim(),
    description || '',
    event_date || '',
    chapter_id || null,
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
    if (req.body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(req.body[key]);
    }
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
