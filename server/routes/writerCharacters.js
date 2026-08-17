const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { removeManagedUploadUrl } = require('../security');

const router = express.Router();

router.use(requireAuth, requireRole('escritor'));

function validateCharacterBook(characterId, bookId) {
  const entity = db.prepare('SELECT id FROM characters WHERE id = ?').get(characterId);
  if (!entity) return { error: [404, 'Personagem nao encontrado.'] };
  const book = db.prepare('SELECT id FROM books WHERE id = ?').get(bookId);
  if (!book) return { error: [404, 'Livro nao encontrado.'] };
  return { entity, book };
}

function validateCharacterChapter(characterId, chapterId) {
  const entity = db.prepare('SELECT id FROM characters WHERE id = ?').get(characterId);
  if (!entity) return { error: [404, 'Personagem nao encontrado.'] };
  const chapter = db.prepare('SELECT id, book_id FROM chapters WHERE id = ?').get(chapterId);
  if (!chapter) return { error: [404, 'Capitulo nao encontrado.'] };
  const linkedToBook = db.prepare('SELECT 1 FROM character_books WHERE character_id = ? AND book_id = ?').get(characterId, chapter.book_id);
  if (!linkedToBook) return { error: [400, 'Associe o personagem ao livro do capitulo antes de vincular o capitulo.'] };
  return { entity, chapter };
}

function withAssociations(character) {
  const books = db.prepare(`
    SELECT b.id, b.title, b.slug FROM character_books cb
    JOIN books b ON b.id = cb.book_id WHERE cb.character_id = ?
  `).all(character.id);

  const chapters = db.prepare(`
    SELECT c.id, c.title, c.book_id FROM character_chapters cc
    JOIN chapters c ON c.id = cc.chapter_id WHERE cc.character_id = ?
  `).all(character.id);

  return { ...character, books, chapters };
}

router.get('/characters', (req, res) => {
  const characters = db.prepare('SELECT * FROM characters ORDER BY name ASC').all();
  res.json({ characters: characters.map(withAssociations) });
});

router.get('/characters/:id', (req, res) => {
  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id);
  if (!character) return res.status(404).json({ error: 'Personagem nao encontrado.' });
  res.json({ character: withAssociations(character) });
});

router.post('/characters', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'O personagem precisa de um nome.' });
  }

  const result = db.prepare(`
    INSERT INTO characters (name, created_at, updated_at) VALUES (?, datetime('now'), datetime('now'))
  `).run(name.trim());

  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ character: withAssociations(character) });
});

const editableFields = [
  'name', 'nicknames', 'age', 'description', 'appearance', 'personality',
  'goals', 'fears', 'likes', 'relationships', 'history', 'trivia', 'notes',
  'photo_color', 'photo_url',
];

router.patch('/characters/:id', (req, res) => {
  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id);
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
  db.prepare(`UPDATE characters SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  if (req.body.photo_url !== undefined && req.body.photo_url !== character.photo_url) removeManagedUploadUrl(character.photo_url);

  const updated = db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id);
  res.json({ character: withAssociations(updated) });
});

router.delete('/characters/:id', (req, res) => {
  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id);
  if (!character) return res.status(404).json({ error: 'Personagem nao encontrado.' });
  db.prepare('DELETE FROM characters WHERE id = ?').run(req.params.id);
  removeManagedUploadUrl(character.photo_url);
  res.json({ ok: true });
});

router.post('/characters/:id/books/:bookId', (req, res) => {
  const check = validateCharacterBook(req.params.id, req.params.bookId);
  if (check.error) return res.status(check.error[0]).json({ error: check.error[1] });
  db.prepare('INSERT OR IGNORE INTO character_books (character_id, book_id) VALUES (?, ?)')
    .run(req.params.id, req.params.bookId);
  res.json({ ok: true });
});

router.delete('/characters/:id/books/:bookId', (req, res) => {
  const check = validateCharacterBook(req.params.id, req.params.bookId);
  if (check.error) return res.status(check.error[0]).json({ error: check.error[1] });
  db.exec('BEGIN IMMEDIATE');
  try {
    // Removing an entity from a book also removes chapter links from that same book.
    db.prepare(`DELETE FROM character_chapters WHERE character_id = ? AND chapter_id IN (SELECT id FROM chapters WHERE book_id = ?)`)
      .run(req.params.id, req.params.bookId);
    db.prepare('DELETE FROM character_books WHERE character_id = ? AND book_id = ?')
      .run(req.params.id, req.params.bookId);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  res.json({ ok: true });
});

router.post('/characters/:id/chapters/:chapterId', (req, res) => {
  const check = validateCharacterChapter(req.params.id, req.params.chapterId);
  if (check.error) return res.status(check.error[0]).json({ error: check.error[1] });
  db.prepare('INSERT OR IGNORE INTO character_chapters (character_id, chapter_id) VALUES (?, ?)')
    .run(req.params.id, req.params.chapterId);
  res.json({ ok: true });
});

router.delete('/characters/:id/chapters/:chapterId', (req, res) => {
  const entity = db.prepare('SELECT id FROM characters WHERE id = ?').get(req.params.id);
  if (!entity) return res.status(404).json({ error: 'Personagem nao encontrado.' });
  db.prepare('DELETE FROM character_chapters WHERE character_id = ? AND chapter_id = ?')
    .run(req.params.id, req.params.chapterId);
  res.json({ ok: true });
});

module.exports = router;
