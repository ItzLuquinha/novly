const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

router.use(requireAuth, requireRole('escritor'));

async function validateObjectBook(objectId, bookId) {
  const entity = await db.prepare('SELECT id FROM objects WHERE id = ?').get(objectId);
  if (!entity) return { error: [404, 'Objeto nao encontrado.'] };
  const book = await db.prepare('SELECT id FROM books WHERE id = ?').get(bookId);
  if (!book) return { error: [404, 'Livro nao encontrado.'] };
  return { entity, book };
}

async function validateObjectChapter(objectId, chapterId) {
  const entity = await db.prepare('SELECT id FROM objects WHERE id = ?').get(objectId);
  if (!entity) return { error: [404, 'Objeto nao encontrado.'] };
  const chapter = await db.prepare('SELECT id, book_id FROM chapters WHERE id = ?').get(chapterId);
  if (!chapter) return { error: [404, 'Capitulo nao encontrado.'] };
  const linkedToBook = await db.prepare('SELECT 1 FROM object_books WHERE object_id = ? AND book_id = ?').get(objectId, chapter.book_id);
  if (!linkedToBook) return { error: [400, 'Associe o objeto ao livro do capitulo antes de vincular o capitulo.'] };
  return { entity, chapter };
}

async function withAssociations(object) {
  const books = await db.prepare(`
    SELECT b.id, b.title, b.slug FROM object_books ob
    JOIN books b ON b.id = ob.book_id WHERE ob.object_id = ?
  `).all(object.id);

  const chapters = await db.prepare(`
    SELECT c.id, c.title, c.book_id FROM object_chapters oc
    JOIN chapters c ON c.id = oc.chapter_id WHERE oc.object_id = ?
  `).all(object.id);

  return { ...object, books, chapters };
}

router.get('/objects', async (req, res) => {
  const objects = await db.prepare('SELECT * FROM objects ORDER BY name ASC').all();
  res.json({ objects: await Promise.all(objects.map(withAssociations)) });
});

router.get('/objects/:id', async (req, res) => {
  const object = await db.prepare('SELECT * FROM objects WHERE id = ?').get(req.params.id);
  if (!object) return res.status(404).json({ error: 'Objeto nao encontrado.' });
  res.json({ object: await withAssociations(object) });
});

router.post('/objects', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'O objeto precisa de um nome.' });
  }

  const result = await db.prepare(`
    INSERT INTO objects (name, created_at, updated_at) VALUES (?, datetime('now'), datetime('now'))
  `).run(name.trim());

  const object = await db.prepare('SELECT * FROM objects WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ object: await withAssociations(object) });
});

const editableFields = ['name', 'category', 'description', 'significance', 'notes', 'photo_color', 'owner_current', 'previous_owners', 'current_location', 'origin', 'creator', 'powers', 'limitations', 'condition', 'history'];

router.patch('/objects/:id', async (req, res) => {
  const object = await db.prepare('SELECT * FROM objects WHERE id = ?').get(req.params.id);
  if (!object) return res.status(404).json({ error: 'Objeto nao encontrado.' });

  const fields = [];
  const values = [];
  for (const key of editableFields) {
    if (req.body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }
  if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar.' });

  fields.push("updated_at = datetime('now')");
  values.push(req.params.id);
  await db.prepare(`UPDATE objects SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const updated = await db.prepare('SELECT * FROM objects WHERE id = ?').get(req.params.id);
  res.json({ object: await withAssociations(updated) });
});

router.delete('/objects/:id', async (req, res) => {
  const object = await db.prepare('SELECT * FROM objects WHERE id = ?').get(req.params.id);
  if (!object) return res.status(404).json({ error: 'Objeto nao encontrado.' });
  await db.batch([
    db.prepare("DELETE FROM lore_field_reveals WHERE entity_type='object' AND entity_id=?").bind(req.params.id),
    db.prepare("DELETE FROM lore_relationships WHERE (source_type='object' AND source_id=?) OR (target_type='object' AND target_id=?)").bind(req.params.id, req.params.id),
    db.prepare("DELETE FROM lore_locations WHERE entity_type='object' AND entity_id=?").bind(req.params.id),
    db.prepare('DELETE FROM objects WHERE id = ?').bind(req.params.id),
  ]);
  res.json({ ok: true });
});

router.post('/objects/:id/books/:bookId', async (req, res) => {
  const check = await validateObjectBook(req.params.id, req.params.bookId);
  if (check.error) return res.status(check.error[0]).json({ error: check.error[1] });
  await db.prepare('INSERT OR IGNORE INTO object_books (object_id, book_id) VALUES (?, ?)')
    .run(req.params.id, req.params.bookId);
  res.json({ ok: true });
});

router.delete('/objects/:id/books/:bookId', async (req, res) => {
  const check = await validateObjectBook(req.params.id, req.params.bookId);
  if (check.error) return res.status(check.error[0]).json({ error: check.error[1] });
  await db.batch([
    db.prepare(`DELETE FROM object_chapters WHERE object_id = ? AND chapter_id IN (SELECT id FROM chapters WHERE book_id = ?)`)
      .bind(req.params.id, req.params.bookId),
    db.prepare('DELETE FROM object_books WHERE object_id = ? AND book_id = ?')
      .bind(req.params.id, req.params.bookId),
  ]);
  res.json({ ok: true });
});

router.post('/objects/:id/chapters/:chapterId', async (req, res) => {
  const check = await validateObjectChapter(req.params.id, req.params.chapterId);
  if (check.error) return res.status(check.error[0]).json({ error: check.error[1] });
  await db.prepare('INSERT OR IGNORE INTO object_chapters (object_id, chapter_id) VALUES (?, ?)')
    .run(req.params.id, req.params.chapterId);
  res.json({ ok: true });
});

router.delete('/objects/:id/chapters/:chapterId', async (req, res) => {
  const entity = await db.prepare('SELECT id FROM objects WHERE id = ?').get(req.params.id);
  if (!entity) return res.status(404).json({ error: 'Objeto nao encontrado.' });
  await db.prepare('DELETE FROM object_chapters WHERE object_id = ? AND chapter_id = ?')
    .run(req.params.id, req.params.chapterId);
  res.json({ ok: true });
});

module.exports = router;
