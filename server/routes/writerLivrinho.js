const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const L = require('../loreSystem');

const router = express.Router();
router.use(requireAuth, requireRole('escritor'));

function clip(value, max = 1800) {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function cleanRow(row, fields) {
  const out = {};
  for (const field of fields) {
    if (row[field] !== undefined && row[field] !== null && String(row[field]).trim() !== '') out[field] = row[field];
  }
  return out;
}

router.get('/livrinho/context/:chapterId', async (req, res) => {
  const chapter = await db.prepare(`
    SELECT c.id,c.book_id,c.title,c.content,c.order_index,c.status,c.word_count,c.updated_at,
           b.title AS book_title,b.slug AS book_slug,b.synopsis,b.category,b.status AS book_status,b.writer_notes
    FROM chapters c JOIN books b ON b.id=c.book_id
    WHERE c.id=?
  `).get(req.params.chapterId);
  if (!chapter) return res.status(404).json({ error: 'Capitulo nao encontrado.' });

  const [chapterList, scenes, characters, places, objects, relationships, timeline, locations, kanban] = await Promise.all([
    db.prepare(`SELECT id,title,order_index,status,word_count,content FROM chapters WHERE book_id=? ORDER BY order_index`).all(chapter.book_id),
    db.prepare(`SELECT id,title,summary,order_index FROM scenes WHERE chapter_id=? ORDER BY order_index`).all(chapter.id),
    db.prepare(`SELECT c.* FROM character_books cb JOIN characters c ON c.id=cb.character_id WHERE cb.book_id=? ORDER BY c.name LIMIT 60`).all(chapter.book_id),
    db.prepare(`SELECT p.* FROM place_books pb JOIN places p ON p.id=pb.place_id WHERE pb.book_id=? ORDER BY p.name LIMIT 60`).all(chapter.book_id),
    db.prepare(`SELECT o.* FROM object_books ob JOIN objects o ON o.id=ob.object_id WHERE ob.book_id=? ORDER BY o.name LIMIT 60`).all(chapter.book_id),
    L.relationshipsForBook(chapter.book_id),
    db.prepare(`SELECT te.id,te.title,te.description,te.event_date,te.chapter_id,te.order_index,c.title AS chapter_title FROM timeline_events te LEFT JOIN chapters c ON c.id=te.chapter_id WHERE te.book_id=? ORDER BY te.order_index LIMIT 80`).all(chapter.book_id),
    db.prepare(`SELECT ll.entity_type,ll.entity_id,ll.place_id,ll.location_note,ll.chapter_id,c.title AS chapter_title,c.order_index AS chapter_order,p.name AS place_name FROM lore_locations ll JOIN chapters c ON c.id=ll.chapter_id LEFT JOIN places p ON p.id=ll.place_id WHERE ll.book_id=? ORDER BY c.order_index,ll.id`).all(chapter.book_id),
    db.prepare(`SELECT id,title,description,status,chapter_id,order_index FROM kanban_cards WHERE book_id=? ORDER BY status,order_index LIMIT 80`).all(chapter.book_id),
  ]);

  const previous = chapterList
    .filter((c) => Number(c.order_index) < Number(chapter.order_index))
    .slice(-6)
    .map((c) => ({
      id: c.id,
      title: c.title,
      order_index: c.order_index,
      status: c.status,
      word_count: c.word_count,
      ending_excerpt: String(c.content || '').slice(-1200),
    }));

  const compactCharacters = characters.map((c) => cleanRow(c, [
    'id','name','nicknames','age','description','appearance','personality','goals','fears','likes','relationships','history','trivia','notes','gender'
  ])).map((c) => ({ ...c, description: clip(c.description, 900), history: clip(c.history, 900), notes: clip(c.notes, 700) }));
  const compactPlaces = places.map((p) => cleanRow(p, [
    'id','name','description','history','notes','region','parent_place_id','atmosphere','population','dangers','rules','residents'
  ])).map((p) => ({ ...p, description: clip(p.description, 900), history: clip(p.history, 900), notes: clip(p.notes, 700) }));
  const compactObjects = objects.map((o) => cleanRow(o, [
    'id','name','category','description','significance','notes','owner_current','previous_owners','current_location','origin','creator','powers','limitations','condition','history'
  ])).map((o) => ({ ...o, description: clip(o.description, 900), history: clip(o.history, 900), notes: clip(o.notes, 700) }));

  // Resolve each character/object to its last known location at the current chapter.
  const entityNames = new Map([
    ...characters.map((x) => [`character:${x.id}`, x.name]),
    ...objects.map((x) => [`object:${x.id}`, x.name]),
  ]);
  const latestLocation = new Map();
  for (const loc of locations) {
    if (Number(loc.chapter_order) > Number(chapter.order_index)) continue;
    const key = `${loc.entity_type}:${loc.entity_id}`;
    const prev = latestLocation.get(key);
    if (!prev || Number(loc.chapter_order) >= Number(prev.chapter_order)) latestLocation.set(key, loc);
  }
  const currentLocations = [...latestLocation.entries()].map(([key, loc]) => ({
    entity_type: loc.entity_type,
    entity_id: loc.entity_id,
    entity_name: entityNames.get(key) || 'Removido',
    place_id: loc.place_id,
    place_name: loc.place_name || 'Local desconhecido',
    note: loc.location_note || '',
    since_chapter: loc.chapter_title,
  }));

  res.json({
    generated_at: new Date().toISOString(),
    book: {
      id: chapter.book_id,
      title: chapter.book_title,
      slug: chapter.book_slug,
      synopsis: clip(chapter.synopsis, 2200),
      category: chapter.category || '',
      status: chapter.book_status,
      writer_notes: clip(chapter.writer_notes, 1800),
    },
    chapter: {
      id: chapter.id,
      title: chapter.title,
      order_index: chapter.order_index,
      status: chapter.status,
      word_count: chapter.word_count,
      content: clip(chapter.content, 9000),
    },
    previous_chapters: previous,
    scenes: scenes.map((s) => ({ ...s, summary: clip(s.summary, 900) })),
    story_bible: {
      characters: compactCharacters,
      places: compactPlaces,
      objects: compactObjects,
      relationships: relationships.slice(0, 100).map((r) => ({
        source_type: r.source_type, source_name: r.source_name, label: r.label,
        target_type: r.target_type, target_name: r.target_name,
        reveal_chapter_title: r.reveal_chapter_title || null,
      })),
      current_locations: currentLocations,
    },
    timeline: timeline.map((e) => ({ ...e, description: clip(e.description, 900) })),
    planning: kanban.map((k) => ({ ...k, description: clip(k.description, 700) })),
  });
});


router.get('/livrinho/search/:chapterId', async (req, res) => {
  const chapter = await db.prepare('SELECT id,book_id FROM chapters WHERE id=?').get(req.params.chapterId);
  if (!chapter) return res.status(404).json({ error: 'Capitulo nao encontrado.' });
  const raw = String(req.query.q || '').slice(0, 700).toLowerCase();
  const stop = new Set(['para','como','mais','menos','isso','essa','esse','esta','este','onde','quando','quem','qual','quais','sobre','entre','porque','por que','capitulo','livro','personagem','personagens','coisa','coisas','uma','uns','umas','dos','das','com','sem','que','the','and']);
  const terms = [...new Set(raw.match(/[\p{L}\p{N}]{4,}/gu) || [])]
    .filter((term) => !stop.has(term.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))).slice(0, 5);
  if (!terms.length) return res.json({ matches: [] });

  const clauses = terms.map(() => `lower(c.content) LIKE ?`).join(' OR ');
  const params = [chapter.book_id, ...terms.map((t) => `%${t}%`)];
  const rows = await db.prepare(`SELECT c.id,c.title,c.order_index,c.content FROM chapters c WHERE c.book_id=? AND (${clauses}) ORDER BY c.order_index LIMIT 12`).all(...params);
  const matches = rows.map((row) => {
    const normalized = String(row.content || '').toLowerCase();
    let idx = -1;
    for (const term of terms) { const found = normalized.indexOf(term); if (found >= 0 && (idx < 0 || found < idx)) idx = found; }
    const start = Math.max(0, (idx < 0 ? 0 : idx) - 420);
    return { id: row.id, title: row.title, order_index: row.order_index, excerpt: String(row.content || '').slice(start, start + 1100) };
  });
  res.json({ terms, matches });
});

module.exports = router;
