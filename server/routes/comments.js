const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { getChapterAccessById, positiveInt, boundedInt, boundedString } = require('../security');

const router = express.Router();

router.get('/chapter/:chapterId', requireAuth, async (req, res) => {
  const access = await getChapterAccessById(req.params.chapterId, req.user);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  const comments = await db.prepare(`
    SELECT c.*, u.username, u.avatar_url, u.role as user_role
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.chapter_id = ?
    ORDER BY c.pinned DESC, c.created_at ASC
  `).all(access.chapter.id);

  const withReplies = comments.filter((c) => !c.parent_id).map((c) => ({
    ...c,
    replies: comments.filter((r) => r.parent_id === c.id),
  }));
  res.json({ comments: withReplies });
});

router.post('/chapter/:chapterId', requireAuth, async (req, res) => {
  const access = await getChapterAccessById(req.params.chapterId, req.user);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });
  const chapter = access.chapter;

  const content = boundedString(req.body?.content, 5000, '').trim();
  if (!content) return res.status(400).json({ error: 'O comentario nao pode estar vazio.' });

  const suppliedBookId = positiveInt(req.body?.book_id);
  if (suppliedBookId && suppliedBookId !== chapter.book_id) {
    return res.status(400).json({ error: 'Livro e capitulo nao correspondem.' });
  }

  let parentId = null;
  if (req.body?.parent_id) {
    parentId = positiveInt(req.body.parent_id);
    const parent = parentId ? await db.prepare('SELECT id, chapter_id FROM comments WHERE id = ?').get(parentId) : null;
    if (!parent || parent.chapter_id !== chapter.id) return res.status(400).json({ error: 'Comentario pai invalido.' });
  }

  const contentLength = chapter.content.length;
  const anchorText = boundedString(req.body?.anchor_text, 2000, '').trim();
  if (anchorText) {
    const normalizedContent = chapter.content.replace(/\s+/g, ' ').trim();
    const normalizedAnchor = anchorText.replace(/\s+/g, ' ').trim();
    if (!normalizedContent.includes(normalizedAnchor)) {
      return res.status(400).json({ error: 'O trecho comentado nao pertence a este capitulo.' });
    }
  }
  const hasStart = req.body?.anchor_start != null;
  const hasEnd = req.body?.anchor_end != null;
  if (hasStart !== hasEnd) return res.status(400).json({ error: 'Informe inicio e fim do trecho juntos.' });
  const anchorStart = hasStart ? boundedInt(req.body.anchor_start, 0, contentLength, 0) : null;
  const anchorEnd = hasEnd ? boundedInt(req.body.anchor_end, 0, contentLength, 0) : null;
  if (anchorStart !== null && anchorEnd !== null && anchorEnd < anchorStart) {
    return res.status(400).json({ error: 'Intervalo do comentario invalido.' });
  }

  const result = await db.prepare(`
    INSERT INTO comments (user_id, book_id, chapter_id, parent_id, anchor_text, anchor_start, anchor_end, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    req.user.id,
    chapter.book_id,
    chapter.id,
    parentId,
    anchorText || null,
    anchorStart,
    anchorEnd,
    content
  );

  const comment = await db.prepare(`
    SELECT c.*, u.username, u.avatar_url, u.role as user_role
    FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json({ comment });
});

router.patch('/:id/resolve', requireAuth, requireRole('escritor'), async (req, res) => {
  const comment = await db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comentario nao encontrado.' });
  const newState = comment.resolved ? 0 : 1;
  await db.prepare('UPDATE comments SET resolved = ? WHERE id = ?').run(newState, req.params.id);
  res.json({ resolved: !!newState });
});

router.patch('/:id/pin', requireAuth, requireRole('escritor'), async (req, res) => {
  const comment = await db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comentario nao encontrado.' });
  const newState = comment.pinned ? 0 : 1;
  await db.prepare('UPDATE comments SET pinned = ? WHERE id = ?').run(newState, req.params.id);
  res.json({ pinned: !!newState });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const comment = await db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comentario nao encontrado.' });
  if (comment.user_id !== req.user.id && req.user.role !== 'escritor') {
    return res.status(403).json({ error: 'Sem permissao para excluir este comentario.' });
  }
  await db.batch([
    db.prepare("DELETE FROM likes WHERE target_type = 'comment' AND target_id IN (SELECT id FROM comments WHERE id = ? OR parent_id = ?)").bind(req.params.id, req.params.id),
    db.prepare('DELETE FROM comments WHERE id = ? OR parent_id = ?').bind(req.params.id, req.params.id),
  ]);
  res.json({ ok: true });
});

module.exports = router;
