const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.get('/chapter/:chapterId', requireAuth, (req, res) => {
  const comments = db.prepare(`
    SELECT c.*, u.username, u.avatar_url, u.role as user_role
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.chapter_id = ?
    ORDER BY c.pinned DESC, c.created_at ASC
  `).all(req.params.chapterId);

  const withReplies = comments
    .filter(c => !c.parent_id)
    .map(c => ({
      ...c,
      replies: comments.filter(r => r.parent_id === c.id),
    }));

  res.json({ comments: withReplies });
});

router.post('/chapter/:chapterId', requireAuth, (req, res) => {
  const { content, anchor_text, anchor_start, anchor_end, parent_id, book_id } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'O comentario nao pode estar vazio.' });
  }

  const result = db.prepare(`
    INSERT INTO comments (user_id, book_id, chapter_id, parent_id, anchor_text, anchor_start, anchor_end, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    req.user.id,
    book_id,
    req.params.chapterId,
    parent_id || null,
    anchor_text || null,
    anchor_start ?? null,
    anchor_end ?? null,
    content.trim()
  );

  const comment = db.prepare(`
    SELECT c.*, u.username, u.avatar_url, u.role as user_role
    FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ comment });
});

router.patch('/:id/resolve', requireAuth, (req, res) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comentario nao encontrado.' });
  const newState = comment.resolved ? 0 : 1;
  db.prepare('UPDATE comments SET resolved = ? WHERE id = ?').run(newState, req.params.id);
  res.json({ resolved: !!newState });
});

router.patch('/:id/pin', requireAuth, (req, res) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comentario nao encontrado.' });
  const newState = comment.pinned ? 0 : 1;
  db.prepare('UPDATE comments SET pinned = ? WHERE id = ?').run(newState, req.params.id);
  res.json({ pinned: !!newState });
});

router.delete('/:id', requireAuth, (req, res) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comentario nao encontrado.' });
  if (comment.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Voce so pode excluir seus proprios comentarios.' });
  }
  db.prepare('DELETE FROM comments WHERE id = ? OR parent_id = ?').run(req.params.id, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
