import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import './StoryBible.css';

export default function RevealControl({ type, entityId, field, meta, onChanged }) {
  const current = meta?.reveals?.[field]?.reveal_chapter_id || '';
  const [value, setValue] = useState(current);
  const [busy,setBusy]=useState(false);
  useEffect(()=>setValue(current),[current]);
  async function change(e){const v=e.target.value;setValue(v);setBusy(true);try{await api.setLoreReveal(type,entityId,field,v?Number(v):null);onChanged?.();}finally{setBusy(false);}}
  if(!meta) return null;
  return <select className="reveal-control" title="Quando esta informacao fica visivel para a leitora" value={value} onChange={change} disabled={busy}>
    <option value="">Visivel desde o inicio</option>
    {meta.chapters.map(c=><option key={c.id} value={c.id}>Revelar apos · {c.book_title} / {c.title}</option>)}
  </select>;
}
