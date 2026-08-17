import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import RelationshipGraph from './RelationshipGraph.jsx';
import './StoryBible.css';

export default function StoryConnections({ type, entity, books=[] }){
  const [bookId,setBookId]=useState(''); const [data,setData]=useState(null); const [target,setTarget]=useState(''); const [label,setLabel]=useState(''); const [reveal,setReveal]=useState('');
  useEffect(()=>{if(!bookId&&books[0])setBookId(String(books[0].id));},[books,bookId]);
  async function load(){if(!bookId)return setData(null); try{setData(await api.writerStoryBible(bookId));}catch{setData(null)}}
  useEffect(()=>{load()},[bookId]);
  const targets=(data?.entities||[]).filter(e=>!(e.type===type&&Number(e.id)===Number(entity.id)));
  async function add(e){e.preventDefault();if(!target||!label.trim())return;const [target_type,target_id]=target.split(':');await api.createLoreRelationship(bookId,{source_type:type,source_id:Number(entity.id),target_type,target_id:Number(target_id),label:label.trim(),reveal_chapter_id:reveal?Number(reveal):null});setTarget('');setLabel('');setReveal('');load()}
  async function remove(id){await api.deleteLoreRelationship(id);load()}
  if(!books.length)return null;
  return <section className="story-panel"><h2 className="lore-section-heading">Mapa de relacoes</h2><p className="lore-appearance-hint">Conecte esta ficha a personagens, lugares e objetos. A relacao pode ser um spoiler independente.</p>
    {books.length>1&&<select className="lore-add-tag-select" value={bookId} onChange={e=>setBookId(e.target.value)}>{books.map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select>}
    {data&&<><RelationshipGraph entities={data.entities} relationships={data.relationships} focus={{type,id:entity.id}} onDelete={remove} writer/><form className="relation-form" onSubmit={add}>
      <select value={target} onChange={e=>setTarget(e.target.value)} required><option value="">Conectar com...</option>{targets.map(t=><option key={`${t.type}:${t.id}`} value={`${t.type}:${t.id}`}>{t.type==='character'?'Personagem':t.type==='place'?'Lugar':'Objeto'} · {t.name}</option>)}</select>
      <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="ex.: possui, irmã de..." maxLength={120}/>
      <select value={reveal} onChange={e=>setReveal(e.target.value)}><option value="">Visivel desde o inicio</option>{data.chapters.map(c=><option key={c.id} value={c.id}>Revela após {c.title}</option>)}</select>
      <span/><button type="submit">Adicionar relacao</button>
    </form></>}
  </section>
}
