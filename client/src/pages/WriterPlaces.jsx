import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import './Lore.css';

export default function WriterPlaces() {
  const [places, setPlaces] = useState(null);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.writerPlaces().then((data) => setPlaces(data.places)).catch(() => {});
  }, []);

  async function handleCreate() {
    const name = window.prompt('Nome do lugar:');
    if (!name || !name.trim()) return;
    setCreating(true);
    try {
      const res = await api.createPlace(name.trim());
      navigate(`/escritor/lugares/${res.place.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="lore-page">
      <div className="lore-header">
        <h1 className="lore-title">Lugares</h1>
        <button className="lore-new-btn" onClick={handleCreate} disabled={creating}>
          Novo lugar
        </button>
      </div>

      <div className="lore-grid">
        {places?.length === 0 && (
          <p className="lore-empty">Nenhum lugar criado ainda.</p>
        )}
        {places?.map((p) => (
          <div key={p.id} className="lore-card" onClick={() => navigate(`/escritor/lugares/${p.id}`)}>
            <div className="lore-card-avatar" style={{ background: p.photo_color, borderRadius: '4px' }} />
            <div className="lore-card-name">{p.name}</div>
            <div className="lore-card-meta">{p.description || 'Sem descricao ainda.'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
