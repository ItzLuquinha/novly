import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import './Lore.css';

export default function WriterObjects() {
  const [objects, setObjects] = useState(null);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.writerObjects().then((data) => setObjects(data.objects)).catch(() => {});
  }, []);

  async function handleCreate() {
    const name = window.prompt('Nome do objeto:');
    if (!name || !name.trim()) return;
    setCreating(true);
    try {
      const res = await api.createObject(name.trim());
      navigate(`/escritor/objetos/${res.object.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="lore-page">
      <div className="lore-header">
        <h1 className="lore-title">Objetos</h1>
        <button className="lore-new-btn" onClick={handleCreate} disabled={creating}>
          Novo objeto
        </button>
      </div>

      <div className="lore-grid">
        {objects?.length === 0 && (
          <p className="lore-empty">Nenhum objeto criado ainda.</p>
        )}
        {objects?.map((o) => (
          <div key={o.id} className="lore-card" onClick={() => navigate(`/escritor/objetos/${o.id}`)}>
            <div className="lore-card-avatar" style={{ background: o.photo_color, borderRadius: '4px' }} />
            <div className="lore-card-name">{o.name}</div>
            <div className="lore-card-meta">{o.description || 'Sem descricao ainda.'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
