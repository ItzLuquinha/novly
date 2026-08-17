const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

function getBook(slug, user) {
  const book = db.prepare('SELECT * FROM books WHERE slug = ?').get(slug);
  if (!book) return { error: [404, 'Livro nao encontrado.'] };
  if (!book.published_at && user.role !== 'escritor') return { error: [403, 'Este livro ainda nao foi publicado.'] };
  return { book };
}

router.get('/:slug/characters', requireAuth, (req, res) => {
  const result = getBook(req.params.slug, req.user);
  if (result.error) return res.status(result.error[0]).json({ error: result.error[1] });
  const fields = req.user.role === 'escritor'
    ? 'c.*'
    : 'c.id,c.name,c.nicknames,c.age,c.description,c.appearance,c.personality,c.goals,c.fears,c.likes,c.relationships,c.history,c.trivia,c.photo_color,c.photo_url,c.body_type,c.height_cm,c.gender,c.skin_tone,c.hair_color,c.hair_style,c.eye_color,c.outfit_color,c.outfit_style';
  const characters = db.prepare(`SELECT ${fields} FROM character_books cb JOIN characters c ON c.id=cb.character_id WHERE cb.book_id=? ORDER BY c.name ASC`).all(result.book.id);
  res.json({ characters });
});

router.get('/:slug/places', requireAuth, (req, res) => {
  const result = getBook(req.params.slug, req.user);
  if (result.error) return res.status(result.error[0]).json({ error: result.error[1] });
  const fields = req.user.role === 'escritor' ? 'p.*' : 'p.id,p.name,p.description,p.history,p.photo_color';
  const places = db.prepare(`SELECT ${fields} FROM place_books pb JOIN places p ON p.id=pb.place_id WHERE pb.book_id=? ORDER BY p.name ASC`).all(result.book.id);
  const withEvents = places.map((p) => ({
    ...p,
    events: db.prepare(`SELECT pe.id,pe.place_id,pe.title,pe.description,pe.order_index FROM place_events pe WHERE pe.place_id=? ORDER BY pe.order_index ASC`).all(p.id),
  }));
  res.json({ places: withEvents });
});

router.get('/:slug/objects', requireAuth, (req, res) => {
  const result = getBook(req.params.slug, req.user);
  if (result.error) return res.status(result.error[0]).json({ error: result.error[1] });
  const fields = req.user.role === 'escritor' ? 'o.*' : 'o.id,o.name,o.category,o.description,o.significance,o.photo_color';
  const objects = db.prepare(`SELECT ${fields} FROM object_books ob JOIN objects o ON o.id=ob.object_id WHERE ob.book_id=? ORDER BY o.name ASC`).all(result.book.id);
  res.json({ objects });
});

router.get('/:slug/timeline', requireAuth, (req, res) => {
  const result = getBook(req.params.slug, req.user);
  if (result.error) return res.status(result.error[0]).json({ error: result.error[1] });
  const events = db.prepare(`
    SELECT te.*, c.title as chapter_title, c.status as chapter_status FROM timeline_events te
    LEFT JOIN chapters c ON c.id=te.chapter_id WHERE te.book_id=? ORDER BY te.order_index ASC
  `).all(result.book.id);
  const visible = req.user.role === 'escritor' ? events : events.filter((e) => !e.chapter_id || e.chapter_status === 'publicado');
  res.json({ events: visible });
});

module.exports = router;
