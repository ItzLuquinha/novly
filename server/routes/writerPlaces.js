const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

router.use(requireAuth, requireRole('escritor'));

function validatePlaceBook(placeId, bookId) {
  const entity = db.prepare('SELECT id FROM places WHERE id = ?').get(placeId);
  if (!entity) return { error: [404, 'Lugar nao encontrado.'] };
  const book = db.prepare('SELECT id FROM books WHERE id = ?').get(bookId);
  if (!book) return { error: [404, 'Livro nao encontrado.'] };
  return { entity, book };
}

function validatePlaceChapter(placeId, chapterId) {
  const entity = db.prepare('SELECT id FROM places WHERE id = ?').get(placeId);
  if (!entity) return { error: [404, 'Lugar nao encontrado.'] };
  const chapter = db.prepare('SELECT id, book_id FROM chapters WHERE id = ?').get(chapterId);
  if (!chapter) return { error: [404, 'Capitulo nao encontrado.'] };
  const linkedToBook = db.prepare('SELECT 1 FROM place_books WHERE place_id = ? AND book_id = ?').get(placeId, chapter.book_id);
  if (!linkedToBook) return { error: [400, 'Associe o lugar ao livro do capitulo antes de vincular o capitulo.'] };
  return { entity, chapter };
}

function withAssociations(place) {
  const books = db.prepare(`
    SELECT b.id, b.title, b.slug FROM place_books pb
    JOIN books b ON b.id = pb.book_id WHERE pb.place_id = ?
  `).all(place.id);

  const events = db.prepare(`
    SELECT * FROM place_events WHERE place_id = ? ORDER BY order_index ASC
  `).all(place.id);

  return { ...place, books, events };
}

router.get('/places', (req, res) => {
  const places = db.prepare('SELECT * FROM places ORDER BY name ASC').all();
  res.json({ places: places.map(withAssociations) });
});

router.get('/places/:id', (req, res) => {
  const place = db.prepare('SELECT * FROM places WHERE id = ?').get(req.params.id);
  if (!place) return res.status(404).json({ error: 'Lugar nao encontrado.' });
  res.json({ place: withAssociations(place) });
});

router.post('/places', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'O lugar precisa de um nome.' });
  }

  const result = db.prepare(`
    INSERT INTO places (name, created_at, updated_at) VALUES (?, datetime('now'), datetime('now'))
  `).run(name.trim());

  const place = db.prepare('SELECT * FROM places WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ place: withAssociations(place) });
});

const editableFields = ['name', 'description', 'history', 'notes', 'photo_color'];

router.patch('/places/:id', (req, res) => {
  const place = db.prepare('SELECT * FROM places WHERE id = ?').get(req.params.id);
  if (!place) return res.status(404).json({ error: 'Lugar nao encontrado.' });

  const fields = [];
  const values = [];
  for (const key of editableFields) {
    if (req.body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }
  if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar.' });

  fields.push("updated_at = datetime('now')");
  values.push(req.params.id);
  db.prepare(`UPDATE places SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM places WHERE id = ?').get(req.params.id);
  res.json({ place: withAssociations(updated) });
});

router.delete('/places/:id', (req, res) => {
  const place = db.prepare('SELECT * FROM places WHERE id = ?').get(req.params.id);
  if (!place) return res.status(404).json({ error: 'Lugar nao encontrado.' });
  db.prepare('DELETE FROM places WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/places/:id/books/:bookId', (req, res) => {
  const check = validatePlaceBook(req.params.id, req.params.bookId);
  if (check.error) return res.status(check.error[0]).json({ error: check.error[1] });
  db.prepare('INSERT OR IGNORE INTO place_books (place_id, book_id) VALUES (?, ?)')
    .run(req.params.id, req.params.bookId);
  res.json({ ok: true });
});

router.delete('/places/:id/books/:bookId', (req, res) => {
  const check = validatePlaceBook(req.params.id, req.params.bookId);
  if (check.error) return res.status(check.error[0]).json({ error: check.error[1] });
  db.exec('BEGIN IMMEDIATE');
  try {
    // Removing an entity from a book also removes chapter links from that same book.
    db.prepare(`DELETE FROM place_chapters WHERE place_id = ? AND chapter_id IN (SELECT id FROM chapters WHERE book_id = ?)`)
      .run(req.params.id, req.params.bookId);
    db.prepare('DELETE FROM place_books WHERE place_id = ? AND book_id = ?')
      .run(req.params.id, req.params.bookId);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  res.json({ ok: true });
});

router.post('/places/:id/chapters/:chapterId', (req, res) => {
  const check = validatePlaceChapter(req.params.id, req.params.chapterId);
  if (check.error) return res.status(check.error[0]).json({ error: check.error[1] });
  db.prepare('INSERT OR IGNORE INTO place_chapters (place_id, chapter_id) VALUES (?, ?)')
    .run(req.params.id, req.params.chapterId);
  res.json({ ok: true });
});

router.delete('/places/:id/chapters/:chapterId', (req, res) => {
  const entity = db.prepare('SELECT id FROM places WHERE id = ?').get(req.params.id);
  if (!entity) return res.status(404).json({ error: 'Lugar nao encontrado.' });
  db.prepare('DELETE FROM place_chapters WHERE place_id = ? AND chapter_id = ?')
    .run(req.params.id, req.params.chapterId);
  res.json({ ok: true });
});

router.post('/places/:id/events', (req, res) => {
  const place = db.prepare('SELECT * FROM places WHERE id = ?').get(req.params.id);
  if (!place) return res.status(404).json({ error: 'Lugar nao encontrado.' });

  const { title, description } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'O evento precisa de um titulo.' });
  }

  const maxOrder = db.prepare('SELECT COALESCE(MAX(order_index), -1) as m FROM place_events WHERE place_id = ?')
    .get(req.params.id).m;

  const result = db.prepare(`
    INSERT INTO place_events (place_id, title, description, order_index, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(req.params.id, title.trim(), description || '', maxOrder + 1);

  const event = db.prepare('SELECT * FROM place_events WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ event });
});

router.delete('/places/:id/events/:eventId', (req, res) => {
  db.prepare('DELETE FROM place_events WHERE id = ? AND place_id = ?').run(req.params.eventId, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
