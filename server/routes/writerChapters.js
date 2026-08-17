const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { dateKey } = require('../timezone');

const router = express.Router();

router.use(requireAuth, requireRole('escritor'));

function countWords(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function todayWordsForUser(userId) {
  const today = dateKey();
  return db.prepare('SELECT words_written, started_at FROM writing_sessions WHERE user_id = ? AND words_written > 0')
    .all(userId)
    .reduce((sum, row) => sum + (dateKey(row.started_at) === today ? (row.words_written || 0) : 0), 0);
}

router.get('/books/:bookId/chapters', (req, res) => {
  const chapters = db.prepare(`
    SELECT * FROM chapters WHERE book_id = ? ORDER BY order_index ASC
  `).all(req.params.bookId);
  res.json({ chapters });
});

router.post('/books/:bookId/chapters', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.bookId);
  if (!book) return res.status(404).json({ error: 'Livro nao encontrado.' });

  const { title } = req.body;
  const maxOrder = db.prepare('SELECT COALESCE(MAX(order_index), -1) as m FROM chapters WHERE book_id = ?')
    .get(req.params.bookId).m;

  const result = db.prepare(`
    INSERT INTO chapters (book_id, title, content, order_index, status, word_count, created_at, updated_at)
    VALUES (?, ?, '', ?, 'rascunho', 0, datetime('now'), datetime('now'))
  `).run(req.params.bookId, title?.trim() || 'Capitulo sem titulo', maxOrder + 1);

  const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ chapter });
});

router.get('/chapters/:id', (req, res) => {
  const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id);
  if (!chapter) return res.status(404).json({ error: 'Capitulo nao encontrado.' });

  const versionCount = db.prepare('SELECT COUNT(*) as c FROM chapter_versions WHERE chapter_id = ?')
    .get(req.params.id).c;

  res.json({ chapter, version_count: versionCount });
});

router.get('/chapters/:id/lore', (req, res) => {
  const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id);
  if (!chapter) return res.status(404).json({ error: 'Capitulo nao encontrado.' });

  const linkedCharacters = db.prepare(`
    SELECT c.id, c.name, c.photo_color FROM character_chapters cc
    JOIN characters c ON c.id = cc.character_id
    WHERE cc.chapter_id = ? ORDER BY c.name ASC
  `).all(req.params.id);

  const bookCharacters = db.prepare(`
    SELECT c.id, c.name, c.photo_color FROM character_books cb
    JOIN characters c ON c.id = cb.character_id
    WHERE cb.book_id = ? ORDER BY c.name ASC
  `).all(chapter.book_id);

  const linkedPlaces = db.prepare(`
    SELECT p.id, p.name, p.photo_color FROM place_chapters pc
    JOIN places p ON p.id = pc.place_id
    WHERE pc.chapter_id = ? ORDER BY p.name ASC
  `).all(req.params.id);

  const bookPlaces = db.prepare(`
    SELECT p.id, p.name, p.photo_color FROM place_books pb
    JOIN places p ON p.id = pb.place_id
    WHERE pb.book_id = ? ORDER BY p.name ASC
  `).all(chapter.book_id);

  const linkedObjects = db.prepare(`
    SELECT o.id, o.name, o.photo_color FROM object_chapters oc
    JOIN objects o ON o.id = oc.object_id
    WHERE oc.chapter_id = ? ORDER BY o.name ASC
  `).all(req.params.id);

  const bookObjects = db.prepare(`
    SELECT o.id, o.name, o.photo_color FROM object_books ob
    JOIN objects o ON o.id = ob.object_id
    WHERE ob.book_id = ? ORDER BY o.name ASC
  `).all(chapter.book_id);

  res.json({
    linked_characters: linkedCharacters,
    book_characters: bookCharacters,
    linked_places: linkedPlaces,
    book_places: bookPlaces,
    linked_objects: linkedObjects,
    book_objects: bookObjects,
  });
});

router.put('/chapters/:id', (req, res) => {
  const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id);
  if (!chapter) return res.status(404).json({ error: 'Capitulo nao encontrado.' });

  const expectedRevision = Number(req.body?.expected_revision);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    return res.status(428).json({ error: 'Recarregue o capitulo antes de salvar novamente.' });
  }
  if (expectedRevision !== Number(chapter.revision || 0)) {
    return res.status(409).json({ error: 'Este capitulo foi alterado em outra aba ou sessao.', current_revision: chapter.revision });
  }

  const newTitle = req.body.title !== undefined ? String(req.body.title).slice(0, 300) : chapter.title;
  const newContent = req.body.content !== undefined ? String(req.body.content) : chapter.content;
  if (newContent.length > 5_000_000) return res.status(413).json({ error: 'Capitulo grande demais para salvar de uma vez.' });
  const wordCount = countWords(newContent);
  const delta = Math.max(0, wordCount - (chapter.word_count || 0));

  const update = db.prepare(`
    UPDATE chapters SET title = ?, content = ?, word_count = ?, revision = revision + 1, updated_at = datetime('now')
    WHERE id = ? AND revision = ?
  `).run(newTitle, newContent, wordCount, req.params.id, expectedRevision);
  if (!update.changes) {
    const current = db.prepare('SELECT revision FROM chapters WHERE id = ?').get(req.params.id);
    return res.status(409).json({ error: 'Conflito de edicao. Recarregue antes de continuar.', current_revision: current?.revision });
  }

  // Prevent abandoned tabs or a session that crossed the configured local midnight
  // from attributing today's words to yesterday.
  db.prepare(`UPDATE writing_sessions SET ended_at = datetime('now') WHERE user_id = ? AND ended_at IS NULL AND started_at < datetime('now', '-8 hours')`).run(req.user.id);
  const currentDay = dateKey();
  const openRows = db.prepare('SELECT id, started_at FROM writing_sessions WHERE user_id = ? AND ended_at IS NULL').all(req.user.id);
  for (const row of openRows) {
    if (dateKey(row.started_at) !== currentDay) {
      db.prepare(`UPDATE writing_sessions SET ended_at = datetime('now') WHERE id = ?`).run(row.id);
    }
  }

  if (delta > 0) {
    const openSession = db.prepare(`
      SELECT * FROM writing_sessions WHERE user_id = ? AND chapter_id = ? AND ended_at IS NULL
      ORDER BY started_at DESC LIMIT 1
    `).get(req.user.id, req.params.id);
    if (openSession) {
      db.prepare('UPDATE writing_sessions SET words_written = words_written + ? WHERE id = ?').run(delta, openSession.id);
    } else {
      db.prepare(`INSERT INTO writing_sessions (user_id, chapter_id, book_id, words_written, started_at) VALUES (?, ?, ?, ?, datetime('now'))`)
        .run(req.user.id, req.params.id, chapter.book_id, delta);
    }
  }

  const updated = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id);
  res.json({ chapter: updated, today_words: todayWordsForUser(req.user.id) });
});

router.post('/chapters/:id/snapshot', (req, res) => {
  const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id);
  if (!chapter) return res.status(404).json({ error: 'Capitulo nao encontrado.' });

  const { label } = req.body;
  const result = db.prepare(`
    INSERT INTO chapter_versions (chapter_id, title, content, word_count, label, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(chapter.id, chapter.title, chapter.content, chapter.word_count, label || '');

  const version = db.prepare('SELECT * FROM chapter_versions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ version });
});

router.get('/chapters/:id/versions', (req, res) => {
  const versions = db.prepare(`
    SELECT id, title, word_count, label, created_at FROM chapter_versions
    WHERE chapter_id = ? ORDER BY created_at DESC
  `).all(req.params.id);
  res.json({ versions });
});

router.get('/chapters/:id/versions/:versionId', (req, res) => {
  const version = db.prepare('SELECT * FROM chapter_versions WHERE id = ? AND chapter_id = ?')
    .get(req.params.versionId, req.params.id);
  if (!version) return res.status(404).json({ error: 'Versao nao encontrada.' });
  res.json({ version });
});

router.post('/chapters/:id/versions/:versionId/restore', (req, res) => {
  const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id);
  if (!chapter) return res.status(404).json({ error: 'Capitulo nao encontrado.' });

  const version = db.prepare('SELECT * FROM chapter_versions WHERE id = ? AND chapter_id = ?')
    .get(req.params.versionId, req.params.id);
  if (!version) return res.status(404).json({ error: 'Versao nao encontrada.' });

  db.prepare(`
    INSERT INTO chapter_versions (chapter_id, title, content, word_count, label, created_at)
    VALUES (?, ?, ?, ?, 'antes da restauracao', datetime('now'))
  `).run(chapter.id, chapter.title, chapter.content, chapter.word_count);

  db.prepare(`
    UPDATE chapters SET title = ?, content = ?, word_count = ?, revision = revision + 1, updated_at = datetime('now')
    WHERE id = ?
  `).run(version.title, version.content, version.word_count, chapter.id);

  const updated = db.prepare('SELECT * FROM chapters WHERE id = ?').get(chapter.id);
  res.json({ chapter: updated });
});

router.post('/chapters/:id/publish', (req, res) => {
  const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id);
  if (!chapter) return res.status(404).json({ error: 'Capitulo nao encontrado.' });

  db.prepare(`
    UPDATE chapters SET status = 'publicado', scheduled_for = NULL, published_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(req.params.id);

  const updated = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id);
  res.json({ chapter: updated });
});

router.post('/chapters/:id/unpublish', (req, res) => {
  const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id);
  if (!chapter) return res.status(404).json({ error: 'Capitulo nao encontrado.' });

  db.prepare(`
    UPDATE chapters SET status = 'rascunho', scheduled_for = NULL, published_at = NULL, updated_at = datetime('now')
    WHERE id = ?
  `).run(req.params.id);

  const updated = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id);
  res.json({ chapter: updated });
});

router.post('/chapters/:id/schedule', (req, res) => {
  const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id);
  if (!chapter) return res.status(404).json({ error: 'Capitulo nao encontrado.' });

  const { scheduled_for } = req.body;
  const when = new Date(scheduled_for);
  if (!scheduled_for || Number.isNaN(when.getTime())) return res.status(400).json({ error: 'Informe uma data valida para o agendamento.' });
  if (when.getTime() <= Date.now()) return res.status(400).json({ error: 'O agendamento precisa estar no futuro.' });

  db.prepare(`
    UPDATE chapters SET status = 'agendado', scheduled_for = ?, published_at = NULL, updated_at = datetime('now')
    WHERE id = ?
  `).run(when.toISOString(), req.params.id);

  const updated = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id);
  res.json({ chapter: updated });
});

router.delete('/chapters/:id', (req, res) => {
  const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id);
  if (!chapter) return res.status(404).json({ error: 'Capitulo nao encontrado.' });

  db.exec('BEGIN');
  try {
    db.prepare('UPDATE users SET favorite_chapter_id = NULL WHERE favorite_chapter_id = ?').run(req.params.id);
    db.prepare('DELETE FROM reading_progress WHERE chapter_id = ?').run(req.params.id);
    db.prepare('DELETE FROM reading_stats WHERE chapter_id = ?').run(req.params.id);
    db.prepare('DELETE FROM reading_activity WHERE chapter_id = ?').run(req.params.id);
    const commentIds = db.prepare('SELECT id FROM comments WHERE chapter_id = ?').all(req.params.id).map((r) => r.id);
    const highlightIds = db.prepare('SELECT id FROM highlights WHERE chapter_id = ?').all(req.params.id).map((r) => r.id);
    for (const id of commentIds) db.prepare("DELETE FROM likes WHERE target_type = 'comment' AND target_id = ?").run(id);
    for (const id of highlightIds) {
      db.prepare("DELETE FROM likes WHERE target_type = 'highlight' AND target_id = ?").run(id);
      db.prepare("DELETE FROM favorites WHERE target_type = 'highlight' AND target_id = ?").run(id);
    }
    db.prepare('DELETE FROM comments WHERE chapter_id = ?').run(req.params.id);
    db.prepare('DELETE FROM highlights WHERE chapter_id = ?').run(req.params.id);
    db.prepare('DELETE FROM bookmarks WHERE chapter_id = ?').run(req.params.id);
    db.prepare(`DELETE FROM likes WHERE target_type = 'chapter' AND target_id = ?`).run(req.params.id);
    db.prepare(`DELETE FROM favorites WHERE target_type = 'chapter' AND target_id = ?`).run(req.params.id);
    db.prepare('DELETE FROM chapter_versions WHERE chapter_id = ?').run(req.params.id);
    db.prepare('DELETE FROM scenes WHERE chapter_id = ?').run(req.params.id);
    db.prepare('DELETE FROM character_chapters WHERE chapter_id = ?').run(req.params.id);
    db.prepare('DELETE FROM place_chapters WHERE chapter_id = ?').run(req.params.id);
    db.prepare('DELETE FROM object_chapters WHERE chapter_id = ?').run(req.params.id);
    db.prepare('DELETE FROM special_notes WHERE chapter_id = ?').run(req.params.id);
    db.prepare('UPDATE timeline_events SET chapter_id = NULL WHERE chapter_id = ?').run(req.params.id);
    db.prepare('DELETE FROM writing_sessions WHERE chapter_id = ?').run(req.params.id);
    db.prepare('DELETE FROM kanban_cards WHERE chapter_id = ?').run(req.params.id);
    db.prepare('DELETE FROM chapters WHERE id = ?').run(req.params.id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: 'Nao foi possivel excluir o capitulo.' });
  }

  res.json({ ok: true });
});

router.post('/chapters/:id/reorder', (req, res) => {
  const { direction } = req.body;
  if (!['up', 'down'].includes(direction)) {
    return res.status(400).json({ error: 'Direcao invalida.' });
  }
  const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id);
  if (!chapter) return res.status(404).json({ error: 'Capitulo nao encontrado.' });

  const neighbor = direction === 'up'
    ? db.prepare('SELECT * FROM chapters WHERE book_id = ? AND order_index < ? ORDER BY order_index DESC LIMIT 1')
        .get(chapter.book_id, chapter.order_index)
    : db.prepare('SELECT * FROM chapters WHERE book_id = ? AND order_index > ? ORDER BY order_index ASC LIMIT 1')
        .get(chapter.book_id, chapter.order_index);

  if (!neighbor) return res.json({ ok: true });

  db.prepare('UPDATE chapters SET order_index = ? WHERE id = ?').run(neighbor.order_index, chapter.id);
  db.prepare('UPDATE chapters SET order_index = ? WHERE id = ?').run(chapter.order_index, neighbor.id);

  res.json({ ok: true });
});

router.post('/sessions/end', (req, res) => {
  db.prepare(`
    UPDATE writing_sessions SET ended_at = datetime('now')
    WHERE user_id = ? AND ended_at IS NULL
  `).run(req.user.id);
  res.json({ ok: true });
});

module.exports = router;
