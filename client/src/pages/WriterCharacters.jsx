import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import './Lore.css';

export default function WriterCharacters() {
  const [characters, setCharacters] = useState(null);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.writerCharacters().then((data) => setCharacters(data.characters)).catch(() => {});
  }, []);

  async function handleCreate() {
    const name = window.prompt('Nome do personagem:');
    if (!name || !name.trim()) return;
    setCreating(true);
    try {
      const res = await api.createCharacter(name.trim());
      navigate(`/escritor/personagens/${res.character.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="lore-page">
      <div className="lore-header">
        <h1 className="lore-title">Personagens</h1>
        <button className="lore-new-btn" onClick={handleCreate} disabled={creating}>
          Novo personagem
        </button>
      </div>

      <div className="lore-grid">
        {characters?.length === 0 && (
          <p className="lore-empty">Nenhum personagem criado ainda.</p>
        )}
        {characters?.map((c) => (
          <div key={c.id} className="lore-card" onClick={() => navigate(`/escritor/personagens/${c.id}`)}>
            <div className="lore-card-avatar" style={{ background: c.photo_color }} />
            <div className="lore-card-name">{c.name}</div>
            <div className="lore-card-meta">{c.description || 'Sem descricao ainda.'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
