const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

router.use(requireAuth, requireRole('escritor'));

router.get('/books/:bookId/kanban', (req, res) => {
  const cards = db.prepare(`
    SELECT kc.*, c.title as chapter_title FROM kanban_cards kc
    LEFT JOIN chapters c ON c.id = kc.chapter_id
    WHERE kc.book_id = ? ORDER BY kc.order_index ASC
  `).all(req.params.bookId);
  res.json({ cards });
});

router.post('/books/:bookId/kanban', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.bookId);
  if (!book) return res.status(404).json({ error: 'Livro nao encontrado.' });

  const { title, description, chapter_id, status } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'O cartao precisa de um titulo.' });
  }

  const validStatus = ['ideia', 'rascunho', 'revisao', 'pronto'].includes(status) ? status : 'ideia';
  const maxOrder = db.prepare(`
    SELECT COALESCE(MAX(order_index), -1) as m FROM kanban_cards WHERE book_id = ? AND status = ?
  `).get(req.params.bookId, validStatus).m;

  const result = db.prepare(`
    INSERT INTO kanban_cards (book_id, chapter_id, title, description, status, order_index, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(req.params.bookId, chapter_id || null, title.trim(), description || '', validStatus, maxOrder + 1);

  const card = db.prepare(`
    SELECT kc.*, c.title as chapter_title FROM kanban_cards kc
    LEFT JOIN chapters c ON c.id = kc.chapter_id WHERE kc.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ card });
});

router.patch('/kanban/:id', (req, res) => {
  const card = db.prepare('SELECT * FROM kanban_cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Cartao nao encontrado.' });

  const { title, description, chapter_id } = req.body;
  const fields = [];
  const values = [];

  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (chapter_id !== undefined) { fields.push('chapter_id = ?'); values.push(chapter_id || null); }

  if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar.' });

  fields.push("updated_at = datetime('now')");
  values.push(req.params.id);
  db.prepare(`UPDATE kanban_cards SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare(`
    SELECT kc.*, c.title as chapter_title FROM kanban_cards kc
    LEFT JOIN chapters c ON c.id = kc.chapter_id WHERE kc.id = ?
  `).get(req.params.id);
  res.json({ card: updated });
});

router.post('/kanban/:id/move', (req, res) => {
  const card = db.prepare('SELECT * FROM kanban_cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Cartao nao encontrado.' });

  const { status } = req.body;
  if (!['ideia', 'rascunho', 'revisao', 'pronto'].includes(status)) {
    return res.status(400).json({ error: 'Status invalido.' });
  }

  const maxOrder = db.prepare(`
    SELECT COALESCE(MAX(order_index), -1) as m FROM kanban_cards WHERE book_id = ? AND status = ?
  `).get(card.book_id, status).m;

  db.prepare(`
    UPDATE kanban_cards SET status = ?, order_index = ?, updated_at = datetime('now') WHERE id = ?
  `).run(status, maxOrder + 1, req.params.id);

  const updated = db.prepare(`
    SELECT kc.*, c.title as chapter_title FROM kanban_cards kc
    LEFT JOIN chapters c ON c.id = kc.chapter_id WHERE kc.id = ?
  `).get(req.params.id);
  res.json({ card: updated });
});

router.delete('/kanban/:id', (req, res) => {
  const card = db.prepare('SELECT * FROM kanban_cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Cartao nao encontrado.' });
  db.prepare('DELETE FROM kanban_cards WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
