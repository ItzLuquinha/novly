const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.get('/:slug/characters', requireAuth, (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE slug = ?').get(req.params.slug);
  if (!book) return res.status(404).json({ error: 'Livro nao encontrado.' });
  if (!book.published_at && req.user.role !== 'escritor') {
    return res.status(403).json({ error: 'Este livro ainda nao foi publicado.' });
  }

  const characters = db.prepare(`
    SELECT c.* FROM character_books cb
    JOIN characters c ON c.id = cb.character_id
    WHERE cb.book_id = ?
    ORDER BY c.name ASC
  `).all(book.id);

  res.json({ characters });
});

router.get('/:slug/places', requireAuth, (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE slug = ?').get(req.params.slug);
  if (!book) return res.status(404).json({ error: 'Livro nao encontrado.' });
  if (!book.published_at && req.user.role !== 'escritor') {
    return res.status(403).json({ error: 'Este livro ainda nao foi publicado.' });
  }

  const places = db.prepare(`
    SELECT p.* FROM place_books pb
    JOIN places p ON p.id = pb.place_id
    WHERE pb.book_id = ?
    ORDER BY p.name ASC
  `).all(book.id);

  const withEvents = places.map((p) => ({
    ...p,
    events: db.prepare('SELECT * FROM place_events WHERE place_id = ? ORDER BY order_index ASC').all(p.id),
  }));

  res.json({ places: withEvents });
});

router.get('/:slug/objects', requireAuth, (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE slug = ?').get(req.params.slug);
  if (!book) return res.status(404).json({ error: 'Livro nao encontrado.' });
  if (!book.published_at && req.user.role !== 'escritor') {
    return res.status(403).json({ error: 'Este livro ainda nao foi publicado.' });
  }

  const objects = db.prepare(`
    SELECT o.* FROM object_books ob
    JOIN objects o ON o.id = ob.object_id
    WHERE ob.book_id = ?
    ORDER BY o.name ASC
  `).all(book.id);

  res.json({ objects });
});

router.get('/:slug/timeline', requireAuth, (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE slug = ?').get(req.params.slug);
  if (!book) return res.status(404).json({ error: 'Livro nao encontrado.' });
  if (!book.published_at && req.user.role !== 'escritor') {
    return res.status(403).json({ error: 'Este livro ainda nao foi publicado.' });
  }

  const isWriter = req.user.role === 'escritor';
  const events = db.prepare(`
    SELECT te.*, c.title as chapter_title, c.status as chapter_status FROM timeline_events te
    LEFT JOIN chapters c ON c.id = te.chapter_id
    WHERE te.book_id = ?
    ORDER BY te.order_index ASC
  `).all(book.id);

  const visible = isWriter
    ? events
    : events.filter((e) => !e.chapter_id || e.chapter_status === 'publicado');

  res.json({ events: visible });
});

module.exports = router;
