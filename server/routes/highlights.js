const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { getChapterAccessById, positiveInt, boundedInt, boundedString } = require('../security');

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
  const access = getChapterAccessById(req.body?.chapter_id, req.user);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });
  const chapter = access.chapter;
  const bookId = positiveInt(req.body?.book_id);
  if (!bookId || bookId !== chapter.book_id) return res.status(400).json({ error: 'Livro e capitulo nao correspondem.' });

  const text = boundedString(req.body?.text, 10_000, '').trim();
  if (!text) return res.status(400).json({ error: 'Selecione um trecho para destacar.' });
  const normalizedContent = chapter.content.replace(/\s+/g, ' ').trim();
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  if (!normalizedContent.includes(normalizedText)) return res.status(400).json({ error: 'O trecho destacado nao pertence a este capitulo.' });

  const max = chapter.content.length;
  const charStart = req.body?.char_start == null ? null : boundedInt(req.body.char_start, 0, max, 0);
  const charEnd = req.body?.char_end == null ? null : boundedInt(req.body.char_end, 0, max, 0);
  if (charStart !== null && charEnd !== null && charEnd < charStart) return res.status(400).json({ error: 'Intervalo invalido.' });

  const result = db.prepare(`
    INSERT INTO highlights (user_id, chapter_id, book_id, text, char_start, char_end, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(req.user.id, chapter.id, chapter.book_id, text, charStart, charEnd, boundedString(req.body?.note, 5000, ''));
  const highlight = db.prepare('SELECT * FROM highlights WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ highlight });
});

router.patch('/:id/note', requireAuth, (req, res) => {
  const highlight = db.prepare('SELECT * FROM highlights WHERE id = ?').get(req.params.id);
  if (!highlight || highlight.user_id !== req.user.id) return res.status(403).json({ error: 'Sem permissao.' });
  db.prepare('UPDATE highlights SET note = ? WHERE id = ?').run(boundedString(req.body?.note, 5000, ''), req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  const highlight = db.prepare('SELECT * FROM highlights WHERE id = ?').get(req.params.id);
  if (!highlight) return res.status(404).json({ error: 'Destaque nao encontrado.' });
  if (highlight.user_id !== req.user.id && req.user.role !== 'escritor') return res.status(403).json({ error: 'Sem permissao.' });
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare("DELETE FROM likes WHERE target_type = 'highlight' AND target_id = ?").run(highlight.id);
    db.prepare("DELETE FROM favorites WHERE target_type = 'highlight' AND target_id = ?").run(highlight.id);
    db.prepare('DELETE FROM highlights WHERE id = ?').run(highlight.id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  res.json({ ok: true });
});

module.exports = router;
