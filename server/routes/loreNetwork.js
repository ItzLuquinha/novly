const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const L = require('../loreSystem');
const router = express.Router();

router.get('/writer/lore/:type/:id/meta', requireAuth, requireRole('escritor'), async (req,res) => {
  if (!L.validType(req.params.type) || !(await L.entity(req.params.type, req.params.id))) return res.status(404).json({error:'Entidade nao encontrada.'});
  const [reveals, chapters] = await Promise.all([L.revealMap(req.params.type, req.params.id), L.chaptersForEntity(req.params.type, req.params.id)]);
  res.json({ reveals, chapters });
});
router.put('/writer/lore/:type/:id/reveals/:field', requireAuth, requireRole('escritor'), async (req,res) => {
  const type=req.params.type, id=req.params.id, field=String(req.params.field||'').slice(0,80);
  if (!L.validType(type) || !(await L.entity(type,id))) return res.status(404).json({error:'Entidade nao encontrada.'});
  const chapterId = req.body?.chapter_id ? L.boundedInt(req.body.chapter_id,1,2147483647,null) : null;
  if (chapterId) {
    const ch=await db.prepare('SELECT id,book_id FROM chapters WHERE id=?').get(chapterId);
    if (!ch || !(await L.linkedToBook(type,id,ch.book_id))) return res.status(400).json({error:'O capitulo precisa pertencer a um livro associado a esta ficha.'});
  }
  if (!chapterId) await db.prepare('DELETE FROM lore_field_reveals WHERE entity_type=? AND entity_id=? AND field_key=?').run(type,id,field);
  else await db.prepare(`INSERT INTO lore_field_reveals(entity_type,entity_id,field_key,reveal_chapter_id) VALUES(?,?,?,?)
    ON CONFLICT(entity_type,entity_id,field_key) DO UPDATE SET reveal_chapter_id=excluded.reveal_chapter_id`).run(type,id,field,chapterId);
  res.json({ok:true});
});

router.get('/writer/books/:bookId/story-bible', requireAuth, requireRole('escritor'), async (req,res) => {
  const book=await db.prepare('SELECT id,title,slug FROM books WHERE id=?').get(req.params.bookId); if(!book) return res.status(404).json({error:'Livro nao encontrado.'});
  const [entities,relationships,chapters,locations]=await Promise.all([
    L.bookEntities(book.id), L.relationshipsForBook(book.id),
    db.prepare('SELECT id,title,order_index,status FROM chapters WHERE book_id=? ORDER BY order_index').all(book.id),
    db.prepare(`SELECT ll.*,p.name AS place_name,c.order_index AS chapter_order FROM lore_locations ll LEFT JOIN places p ON p.id=ll.place_id JOIN chapters c ON c.id=ll.chapter_id WHERE ll.book_id=?`).all(book.id)
  ]);
  res.json({book,entities,relationships,chapters,locations});
});
router.post('/writer/books/:bookId/relationships', requireAuth, requireRole('escritor'), async (req,res) => {
  const bookId=Number(req.params.bookId); const {source_type,target_type}=req.body||{};
  const sourceId=L.boundedInt(req.body?.source_id,1,2147483647,0), targetId=L.boundedInt(req.body?.target_id,1,2147483647,0);
  const label=L.boundedString(req.body?.label,120,'').trim(); const reveal=req.body?.reveal_chapter_id?L.boundedInt(req.body.reveal_chapter_id,1,2147483647,null):null;
  if(!label || !L.validType(source_type)||!L.validType(target_type)||!sourceId||!targetId) return res.status(400).json({error:'Relacao invalida.'});
  if(source_type===target_type&&sourceId===targetId) return res.status(400).json({error:'Uma entidade nao pode se relacionar consigo mesma.'});
  if(!(await L.linkedToBook(source_type,sourceId,bookId))||!(await L.linkedToBook(target_type,targetId,bookId))) return res.status(400).json({error:'As duas entidades precisam pertencer ao livro.'});
  if(reveal){const c=await db.prepare('SELECT id FROM chapters WHERE id=? AND book_id=?').get(reveal,bookId); if(!c)return res.status(400).json({error:'Capitulo de revelacao invalido.'});}
  const r=await db.prepare(`INSERT INTO lore_relationships(book_id,source_type,source_id,target_type,target_id,label,reveal_chapter_id) VALUES(?,?,?,?,?,?,?)`).run(bookId,source_type,sourceId,target_type,targetId,label,reveal);
  res.status(201).json({relationship:(await L.relationshipsForBook(bookId)).find(x=>x.id===r.lastInsertRowid)});
});
router.delete('/writer/relationships/:id', requireAuth, requireRole('escritor'), async(req,res)=>{await db.prepare('DELETE FROM lore_relationships WHERE id=?').run(req.params.id);res.json({ok:true});});

router.put('/writer/books/:bookId/locations', requireAuth, requireRole('escritor'), async(req,res)=>{
  const bookId=Number(req.params.bookId), chapterId=L.boundedInt(req.body?.chapter_id,1,2147483647,0), entityId=L.boundedInt(req.body?.entity_id,1,2147483647,0), placeId=req.body?.place_id?L.boundedInt(req.body.place_id,1,2147483647,null):null;
  const type=req.body?.entity_type, note=L.boundedString(req.body?.location_note,500,'');
  if(!['character','object'].includes(type)||!chapterId||!entityId) return res.status(400).json({error:'Localizacao invalida.'});
  if(!(await db.prepare('SELECT 1 FROM chapters WHERE id=? AND book_id=?').get(chapterId,bookId))||!(await L.linkedToBook(type,entityId,bookId))) return res.status(400).json({error:'Capitulo ou entidade nao pertence ao livro.'});
  if(placeId&&!(await L.linkedToBook('place',placeId,bookId))) return res.status(400).json({error:'Lugar nao pertence ao livro.'});
  await db.prepare(`INSERT INTO lore_locations(book_id,chapter_id,entity_type,entity_id,place_id,location_note,updated_at) VALUES(?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(book_id,chapter_id,entity_type,entity_id) DO UPDATE SET place_id=excluded.place_id,location_note=excluded.location_note,updated_at=datetime('now')`).run(bookId,chapterId,type,entityId,placeId,note);
  res.json({ok:true});
});
router.delete('/writer/books/:bookId/locations', requireAuth, requireRole('escritor'), async(req,res)=>{await db.prepare('DELETE FROM lore_locations WHERE book_id=? AND chapter_id=? AND entity_type=? AND entity_id=?').run(req.params.bookId,req.body?.chapter_id,req.body?.entity_type,req.body?.entity_id);res.json({ok:true});});

router.get('/books/:slug/story-bible', requireAuth, async(req,res)=>{
  const book=await db.prepare('SELECT id,title,slug,published_at FROM books WHERE slug=?').get(req.params.slug); if(!book)return res.status(404).json({error:'Livro nao encontrado.'}); if(!book.published_at&&req.user.role!=='escritor')return res.status(403).json({error:'Livro ainda nao publicado.'});
  const entities=await L.bookEntities(book.id), relationships=await L.relationshipsForBook(book.id,req.user);
  let chapters=await db.prepare(`SELECT id,title,order_index,status FROM chapters WHERE book_id=? AND status='publicado' ORDER BY order_index`).all(book.id);
  let allowed=null; if(req.user.role!=='escritor'){allowed=await L.completedIds(req.user.id);chapters=chapters.filter(c=>allowed.has(Number(c.id)));}
  const rows=await db.prepare(`SELECT ll.*,p.name AS place_name,c.order_index AS chapter_order FROM lore_locations ll LEFT JOIN places p ON p.id=ll.place_id JOIN chapters c ON c.id=ll.chapter_id WHERE ll.book_id=?`).all(book.id);
  const locations=rows.filter(r=>req.user.role==='escritor'||allowed.has(Number(r.chapter_id)));
  const names=new Map(entities.map(e=>[`${e.type}:${e.id}`,e.name]));
  res.json({book,entities,relationships,chapters,locations:locations.map(r=>({...r,entity_name:names.get(`${r.entity_type}:${r.entity_id}`)||'Removido'}))});
});
module.exports=router;
