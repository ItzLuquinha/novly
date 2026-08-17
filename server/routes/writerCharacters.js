const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { removeManagedUploadUrl } = require('../security');

const router = express.Router();

router.use(requireAuth, requireRole('escritor'));

async function validateCharacterBook(characterId, bookId) {
  const entity = await db.prepare('SELECT id FROM characters WHERE id = ?').get(characterId);
  if (!entity) return { error: [404, 'Personagem nao encontrado.'] };
  const book = await db.prepare('SELECT id FROM books WHERE id = ?').get(bookId);
  if (!book) return { error: [404, 'Livro nao encontrado.'] };
  return { entity, book };
}

async function validateCharacterChapter(characterId, chapterId) {
  const entity = await db.prepare('SELECT id FROM characters WHERE id = ?').get(characterId);
  if (!entity) return { error: [404, 'Personagem nao encontrado.'] };
  const chapter = await db.prepare('SELECT id, book_id FROM chapters WHERE id = ?').get(chapterId);
  if (!chapter) return { error: [404, 'Capitulo nao encontrado.'] };
  const linkedToBook = await db.prepare('SELECT 1 FROM character_books WHERE character_id = ? AND book_id = ?').get(characterId, chapter.book_id);
  if (!linkedToBook) return { error: [400, 'Associe o personagem ao livro do capitulo antes de vincular o capitulo.'] };
  return { entity, chapter };
}

async function withAssociations(character) {
  const books = await db.prepare(`
    SELECT b.id, b.title, b.slug FROM character_books cb
    JOIN books b ON b.id = cb.book_id WHERE cb.character_id = ?
  `).all(character.id);

  const chapters = await db.prepare(`
    SELECT c.id, c.title, c.book_id FROM character_chapters cc
    JOIN chapters c ON c.id = cc.chapter_id WHERE cc.character_id = ?
  `).all(character.id);

  return { ...character, books, chapters };
}

router.get('/characters', async (req, res) => {
  const characters = await db.prepare('SELECT * FROM characters ORDER BY name ASC').all();
  res.json({ characters: characters.map(withAssociations) });
});

router.get('/characters/:id', async (req, res) => {
  const character = await db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id);
  if (!character) return res.status(404).json({ error: 'Personagem nao encontrado.' });
  res.json({ character: await withAssociations(character) });
});

router.post('/characters', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'O personagem precisa de um nome.' });
  }

  const result = await db.prepare(`
    INSERT INTO characters (name, created_at, updated_at) VALUES (?, datetime('now'), datetime('now'))
  `).run(name.trim());

  const character = await db.prepare('SELECT * FROM characters WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ character: await withAssociations(character) });
});

const editableFields = [
  'name', 'nicknames', 'age', 'description', 'appearance', 'personality',
  'goals', 'fears', 'likes', 'relationships', 'history', 'trivia', 'notes',
  'photo_color', 'photo_url',
];

router.patch('/characters/:id', async (req, res) => {
  const character = await db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id);
  if (!character) return res.status(404).json({ error: 'Personagem nao encontrado.' });

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
  await db.prepare(`UPDATE characters SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  if (req.body.photo_url !== undefined && req.body.photo_url !== character.photo_url) await removeManagedUploadUrl(character.photo_url);

  const updated = await db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id);
  res.json({ character: await withAssociations(updated) });
});

router.delete('/characters/:id', async (req, res) => {
  const character = await db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id);
  if (!character) return res.status(404).json({ error: 'Personagem nao encontrado.' });
  await db.prepare('DELETE FROM characters WHERE id = ?').run(req.params.id);
  await removeManagedUploadUrl(character.photo_url);
  res.json({ ok: true });
});

router.post('/characters/:id/books/:bookId', async (req, res) => {
  const check = await validateCharacterBook(req.params.id, req.params.bookId);
  if (check.error) return res.status(check.error[0]).json({ error: check.error[1] });
  await db.prepare('INSERT OR IGNORE INTO character_books (character_id, book_id) VALUES (?, ?)')
    .run(req.params.id, req.params.bookId);
  res.json({ ok: true });
});

router.delete('/characters/:id/books/:bookId', async (req, res) => {
  const check = await validateCharacterBook(req.params.id, req.params.bookId);
  if (check.error) return res.status(check.error[0]).json({ error: check.error[1] });
  await db.batch([
    db.prepare(`DELETE FROM character_chapters WHERE character_id = ? AND chapter_id IN (SELECT id FROM chapters WHERE book_id = ?)`)
      .bind(req.params.id, req.params.bookId),
    db.prepare('DELETE FROM character_books WHERE character_id = ? AND book_id = ?')
      .bind(req.params.id, req.params.bookId),
  ]);
  res.json({ ok: true });
});

router.post('/characters/:id/chapters/:chapterId', async (req, res) => {
  const check = await validateCharacterChapter(req.params.id, req.params.chapterId);
  if (check.error) return res.status(check.error[0]).json({ error: check.error[1] });
  await db.prepare('INSERT OR IGNORE INTO character_chapters (character_id, chapter_id) VALUES (?, ?)')
    .run(req.params.id, req.params.chapterId);
  res.json({ ok: true });
});

router.delete('/characters/:id/chapters/:chapterId', async (req, res) => {
  const entity = await db.prepare('SELECT id FROM characters WHERE id = ?').get(req.params.id);
  if (!entity) return res.status(404).json({ error: 'Personagem nao encontrado.' });
  await db.prepare('DELETE FROM character_chapters WHERE character_id = ? AND chapter_id = ?')
    .run(req.params.id, req.params.chapterId);
  res.json({ ok: true });
});

module.exports = router;
