import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import './Favorites.css';

export default function Favorites() {
  const [highlights, setHighlights] = useState(null);

  useEffect(() => {
    api.highlights().then((data) => setHighlights(data.highlights)).catch(() => setHighlights([]));
  }, []);

  return (
    <div className="favorites-page">
      <h1 className="favorites-title">Palavras que ficaram</h1>

      {highlights && highlights.length === 0 && (
        <p className="favorites-empty">Nenhum trecho destacado ainda. Selecione uma frase durante a leitura para comecar sua colecao.</p>
      )}

      {highlights?.map((h) => (
        <div className="highlight-card" key={h.id}>
          <p className="highlight-text">{h.text}</p>
          <div className="highlight-source">
            <Link to={`/biblioteca/${h.book_slug}/${h.chapter_id}`}>
              {h.book_title} - {h.chapter_title}
            </Link>
            <span>{new Date(h.created_at + 'Z').toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
