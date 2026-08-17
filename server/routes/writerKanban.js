const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { positiveInt, boundedString } = require('../security');

const router = express.Router();

router.use(requireAuth, requireRole('escritor'));

async function chapterIdForBook(value, bookId) {
  if (value === undefined || value === null || value === '') return { chapterId: null };
  const chapterId = positiveInt(value);
  if (!chapterId) return { error: 'Capitulo invalido.' };
  const chapter = await db.prepare('SELECT id FROM chapters WHERE id = ? AND book_id = ?').get(chapterId, bookId);
  if (!chapter) return { error: 'O capitulo precisa pertencer ao mesmo livro do cartao.' };
  return { chapterId };
}

router.get('/books/:bookId/kanban', async (req, res) => {
  const cards = await db.prepare(`
    SELECT kc.*, c.title as chapter_title FROM kanban_cards kc
    LEFT JOIN chapters c ON c.id = kc.chapter_id
    WHERE kc.book_id = ? ORDER BY kc.order_index ASC
  `).all(req.params.bookId);
  res.json({ cards });
});

router.post('/books/:bookId/kanban', async (req, res) => {
  const book = await db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.bookId);
  if (!book) return res.status(404).json({ error: 'Livro nao encontrado.' });

  const { title, description, chapter_id, status } = req.body;
  const safeTitle = boundedString(title, 300, '').trim();
  if (!safeTitle) {
    return res.status(400).json({ error: 'O cartao precisa de um titulo.' });
  }
  const chapterCheck = await chapterIdForBook(chapter_id, Number(req.params.bookId));
  if (chapterCheck.error) return res.status(400).json({ error: chapterCheck.error });

  const validStatus = ['ideia', 'rascunho', 'revisao', 'pronto'].includes(status) ? status : 'ideia';
  const maxOrder = (await db.prepare(`
    SELECT COALESCE(MAX(order_index), -1) as m FROM kanban_cards WHERE book_id = ? AND status = ?
  `).get(req.params.bookId, validStatus)).m;

  const result = await db.prepare(`
    INSERT INTO kanban_cards (book_id, chapter_id, title, description, status, order_index, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(req.params.bookId, chapterCheck.chapterId, safeTitle, boundedString(description, 5000, ''), validStatus, maxOrder + 1);

  const card = await db.prepare(`
    SELECT kc.*, c.title as chapter_title FROM kanban_cards kc
    LEFT JOIN chapters c ON c.id = kc.chapter_id WHERE kc.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ card });
});

router.patch('/kanban/:id', async (req, res) => {
  const card = await db.prepare('SELECT * FROM kanban_cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Cartao nao encontrado.' });

  const { title, description, chapter_id } = req.body;
  const fields = [];
  const values = [];

  if (title !== undefined) {
    const safeTitle = boundedString(title, 300, '').trim();
    if (!safeTitle) return res.status(400).json({ error: 'O cartao precisa de um titulo.' });
    fields.push('title = ?'); values.push(safeTitle);
  }
  if (description !== undefined) { fields.push('description = ?'); values.push(boundedString(description, 5000, '')); }
  if (chapter_id !== undefined) {
    const chapterCheck = await chapterIdForBook(chapter_id, card.book_id);
    if (chapterCheck.error) return res.status(400).json({ error: chapterCheck.error });
    fields.push('chapter_id = ?'); values.push(chapterCheck.chapterId);
  }

  if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar.' });

  fields.push("updated_at = datetime('now')");
  values.push(req.params.id);
  await db.prepare(`UPDATE kanban_cards SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const updated = await db.prepare(`
    SELECT kc.*, c.title as chapter_title FROM kanban_cards kc
    LEFT JOIN chapters c ON c.id = kc.chapter_id WHERE kc.id = ?
  `).get(req.params.id);
  res.json({ card: updated });
});

router.post('/kanban/:id/move', async (req, res) => {
  const card = await db.prepare('SELECT * FROM kanban_cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Cartao nao encontrado.' });

  const { status } = req.body;
  if (!['ideia', 'rascunho', 'revisao', 'pronto'].includes(status)) {
    return res.status(400).json({ error: 'Status invalido.' });
  }

  const maxOrder = (await db.prepare(`
    SELECT COALESCE(MAX(order_index), -1) as m FROM kanban_cards WHERE book_id = ? AND status = ?
  `).get(card.book_id, status)).m;

  await db.prepare(`
    UPDATE kanban_cards SET status = ?, order_index = ?, updated_at = datetime('now') WHERE id = ?
  `).run(status, maxOrder + 1, req.params.id);

  const updated = await db.prepare(`
    SELECT kc.*, c.title as chapter_title FROM kanban_cards kc
    LEFT JOIN chapters c ON c.id = kc.chapter_id WHERE kc.id = ?
  `).get(req.params.id);
  res.json({ card: updated });
});

router.delete('/kanban/:id', async (req, res) => {
  const card = await db.prepare('SELECT * FROM kanban_cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Cartao nao encontrado.' });
  await db.prepare('DELETE FROM kanban_cards WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
