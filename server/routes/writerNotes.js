const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

router.use(requireAuth, requireRole('escritor'));

router.get('/notes', (req, res) => {
  const notes = db.prepare(`
    SELECT sn.*, c.title as chapter_title FROM special_notes sn
    LEFT JOIN chapters c ON c.id = sn.chapter_id
    ORDER BY sn.special_date ASC
  `).all();
  res.json({ notes });
});

router.post('/notes', (req, res) => {
  const { message, special_date, chapter_id } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'O bilhete precisa de uma mensagem.' });
  }
  if (!special_date || !/^\d{2}-\d{2}$/.test(special_date)) {
    return res.status(400).json({ error: 'A data precisa estar no formato MM-DD.' });
  }

  const result = db.prepare(`
    INSERT INTO special_notes (message, special_date, chapter_id, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `).run(message.trim(), special_date, chapter_id || null);

  const note = db.prepare(`
    SELECT sn.*, c.title as chapter_title FROM special_notes sn
    LEFT JOIN chapters c ON c.id = sn.chapter_id WHERE sn.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ note });
});

router.patch('/notes/:id', (req, res) => {
  const note = db.prepare('SELECT * FROM special_notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Bilhete nao encontrado.' });

  const { message, special_date, chapter_id } = req.body;
  const fields = [];
  const values = [];

  if (message !== undefined) { fields.push('message = ?'); values.push(message); }
  if (special_date !== undefined) {
    if (!/^\d{2}-\d{2}$/.test(special_date)) {
      return res.status(400).json({ error: 'A data precisa estar no formato MM-DD.' });
    }
    fields.push('special_date = ?');
    values.push(special_date);
  }
  if (chapter_id !== undefined) { fields.push('chapter_id = ?'); values.push(chapter_id || null); }

  if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar.' });

  values.push(req.params.id);
  db.prepare(`UPDATE special_notes SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare(`
    SELECT sn.*, c.title as chapter_title FROM special_notes sn
    LEFT JOIN chapters c ON c.id = sn.chapter_id WHERE sn.id = ?
  `).get(req.params.id);
  res.json({ note: updated });
});

router.delete('/notes/:id', (req, res) => {
  const note = db.prepare('SELECT * FROM special_notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Bilhete nao encontrado.' });
  db.prepare('DELETE FROM special_notes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
