const db = require('./db');
const { boundedString, boundedInt } = require('./security');

const TYPES = new Set(['character', 'place', 'object']);
const TABLES = { character: 'characters', place: 'places', object: 'objects' };
const BOOK_LINKS = { character: ['character_books', 'character_id'], place: ['place_books', 'place_id'], object: ['object_books', 'object_id'] };

function validType(type) { return TYPES.has(type); }
async function entity(type, id) {
  if (!validType(type)) return null;
  return db.prepare(`SELECT id, name FROM ${TABLES[type]} WHERE id = ?`).get(id);
}
async function linkedToBook(type, id, bookId) {
  if (!validType(type)) return false;
  const [table, key] = BOOK_LINKS[type];
  return !!(await db.prepare(`SELECT 1 FROM ${table} WHERE ${key} = ? AND book_id = ?`).get(id, bookId));
}
async function completedIds(userId) {
  const rows = await db.prepare('SELECT chapter_id FROM reading_stats WHERE user_id = ?').all(userId);
  return new Set(rows.map(r => Number(r.chapter_id)));
}
async function revealMap(type, entityId) {
  const rows = await db.prepare(`SELECT lfr.field_key, lfr.reveal_chapter_id, c.title AS reveal_chapter_title, c.book_id
    FROM lore_field_reveals lfr LEFT JOIN chapters c ON c.id=lfr.reveal_chapter_id
    WHERE lfr.entity_type=? AND lfr.entity_id=?`).all(type, entityId);
  return Object.fromEntries(rows.map(r => [r.field_key, r]));
}
async function maskEntityForReader(type, row, userId) {
  const reveals = await revealMap(type, row.id);
  const completed = await completedIds(userId);
  const locked_fields = {};
  const out = { ...row };
  for (const [field, reveal] of Object.entries(reveals)) {
    if (reveal.reveal_chapter_id && !completed.has(Number(reveal.reveal_chapter_id))) {
      out[field] = '???';
      locked_fields[field] = { chapter_id: reveal.reveal_chapter_id, chapter_title: reveal.reveal_chapter_title };
    }
  }
  out.locked_fields = locked_fields;
  return out;
}
async function bookEntities(bookId) {
  const [characters, places, objects] = await Promise.all([
    db.prepare(`SELECT c.id,c.name,'character' AS type FROM character_books x JOIN characters c ON c.id=x.character_id WHERE x.book_id=? ORDER BY c.name`).all(bookId),
    db.prepare(`SELECT p.id,p.name,'place' AS type FROM place_books x JOIN places p ON p.id=x.place_id WHERE x.book_id=? ORDER BY p.name`).all(bookId),
    db.prepare(`SELECT o.id,o.name,'object' AS type FROM object_books x JOIN objects o ON o.id=x.object_id WHERE x.book_id=? ORDER BY o.name`).all(bookId),
  ]);
  return [...characters, ...places, ...objects];
}
async function relationshipsForBook(bookId, user=null) {
  const rows = await db.prepare(`SELECT lr.*, c.title AS reveal_chapter_title
    FROM lore_relationships lr LEFT JOIN chapters c ON c.id=lr.reveal_chapter_id
    WHERE lr.book_id=? ORDER BY lr.id`).all(bookId);
  let visible = rows;
  if (user && user.role !== 'escritor') {
    const completed = await completedIds(user.id);
    visible = rows.filter(r => !r.reveal_chapter_id || completed.has(Number(r.reveal_chapter_id)));
  }
  const entities = await bookEntities(bookId);
  const names = new Map(entities.map(e => [`${e.type}:${e.id}`, e.name]));
  return visible.map(r => ({ ...r, source_name: names.get(`${r.source_type}:${r.source_id}`) || 'Removido', target_name: names.get(`${r.target_type}:${r.target_id}`) || 'Removido' }));
}
async function chaptersForEntity(type, id) {
  if (!validType(type)) return [];
  const [linkTable, linkKey] = BOOK_LINKS[type];
  return db.prepare(`SELECT c.id,c.title,c.book_id,b.title AS book_title,c.order_index,c.status
    FROM ${linkTable} x JOIN books b ON b.id=x.book_id JOIN chapters c ON c.book_id=b.id
    WHERE x.${linkKey}=? ORDER BY b.order_index,c.order_index`).all(id);
}

module.exports = { validType, entity, linkedToBook, completedIds, revealMap, maskEntityForReader, bookEntities, relationshipsForBook, chaptersForEntity, boundedString, boundedInt };
