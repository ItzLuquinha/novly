const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const highlights = db.prepare(`
    SELECT h.*, c.title as chapter_title, b.title as book_title, b.slug as book_slug
    FROM highlights h
    JOIN chapters c ON c.id = h.chapter_id
    JOIN books b ON b.id = h.book_id
    WHERE h.user_id = ?
    ORDER BY h.created_at DESC
  `).all(req.user.id);
  res.json({ highlights });
});

router.post('/', requireAuth, (req, res) => {
  const { chapter_id, book_id, text, char_start, char_end, note } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Selecione um trecho para destacar.' });
  }

  const result = db.prepare(`
    INSERT INTO highlights (user_id, chapter_id, book_id, text, char_start, char_end, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(req.user.id, chapter_id, book_id, text.trim(), char_start ?? null, char_end ?? null, note || '');

  const highlight = db.prepare('SELECT * FROM highlights WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ highlight });
});

router.patch('/:id/note', requireAuth, (req, res) => {
  const { note } = req.body;
  const highlight = db.prepare('SELECT * FROM highlights WHERE id = ?').get(req.params.id);
  if (!highlight || highlight.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Sem permissao.' });
  }
  db.prepare('UPDATE highlights SET note = ? WHERE id = ?').run(note || '', req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  const highlight = db.prepare('SELECT * FROM highlights WHERE id = ?').get(req.params.id);
  if (!highlight || highlight.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Sem permissao.' });
  }
  db.prepare('DELETE FROM highlights WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
