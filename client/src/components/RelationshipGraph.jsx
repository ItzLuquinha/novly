import { useMemo } from 'react';
import './StoryBible.css';
const TYPE_LABEL={character:'Personagem',place:'Lugar',object:'Objeto'};
const TYPE_CLASS={character:'char',place:'place',object:'obj'};
export default function RelationshipGraph({entities=[],relationships=[],focus=null,onDelete=null,slug=null,writer=false}){
  const shown=useMemo(()=>focus?relationships.filter(r=>(r.source_type===focus.type&&Number(r.source_id)===Number(focus.id))||(r.target_type===focus.type&&Number(r.target_id)===Number(focus.id))):relationships,[relationships,focus]);
  const ids=new Set();shown.forEach(r=>{ids.add(`${r.source_type}:${r.source_id}`);ids.add(`${r.target_type}:${r.target_id}`)});if(focus)ids.add(`${focus.type}:${focus.id}`);
  const nodes=entities.filter(e=>ids.has(`${e.type}:${e.id}`));
  const pos=new Map(nodes.map((n,i)=>{const a=(Math.PI*2*i/Math.max(nodes.length,1))-Math.PI/2;return[`${n.type}:${n.id}`,{x:260+Math.cos(a)*190,y:160+Math.sin(a)*110}]}));
  if(!shown.length)return <div className="story-empty">Nenhuma relacao catalogada ainda.</div>;
  const href=n=>slug?`/biblioteca/${slug}/${n.type==='character'?'personagens':n.type==='place'?'lugares':'objetos'}#${n.type}-${n.id}`:writer?`/escritor/${n.type==='character'?'personagens':n.type==='place'?'lugares':'objetos'}/${n.id}`:null;
  return <div className="relationship-graph">
    <div className="relationship-canvas"><svg viewBox="0 0 520 320" role="img" aria-label="Mapa de relacoes">
      <g className="graph-lines">{shown.map(r=>{const a=pos.get(`${r.source_type}:${r.source_id}`),b=pos.get(`${r.target_type}:${r.target_id}`);if(!a||!b)return null;return <g key={r.id}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><rect className="graph-label-bg" x={(a.x+b.x)/2-48} y={(a.y+b.y)/2-10} width="96" height="20" rx="10"/><text className="graph-label" x={(a.x+b.x)/2} y={(a.y+b.y)/2+4} textAnchor="middle">{r.label.slice(0,18)}</text></g>})}</g>
      <g>{nodes.map(n=>{const p=pos.get(`${n.type}:${n.id}`),active=focus&&n.type===focus.type&&Number(n.id)===Number(focus.id);const content=<g className={`graph-node ${TYPE_CLASS[n.type]}${active?' focus':''}`}><circle cx={p.x} cy={p.y} r="37"/><text className="graph-type" x={p.x} y={p.y-7} textAnchor="middle">{TYPE_LABEL[n.type]}</text><text className="graph-name" x={p.x} y={p.y+10} textAnchor="middle">{n.name.length>15?n.name.slice(0,14)+'…':n.name}</text></g>;return href(n)?<a key={`${n.type}:${n.id}`} href={href(n)}>{content}</a>:<g key={`${n.type}:${n.id}`}>{content}</g>})}</g>
    </svg></div>
    <div className="relationship-edges">{shown.map(r=><div className="relationship-edge" key={r.id}><strong>{r.source_name}</strong><span className="relation-arrow">→</span><em>{r.label}</em><span className="relation-arrow">→</span><strong>{r.target_name}</strong>{r.reveal_chapter_title&&<small>revela em {r.reveal_chapter_title}</small>}{onDelete&&<button onClick={()=>onDelete(r.id)} aria-label="Excluir relacao">×</button>}</div>)}</div>
  </div>;
}
