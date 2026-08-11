import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, mediaUrl } from '../lib/api';
import './BookLore.css';

export default function BookCharacters() {
  const { slug } = useParams();
  const [characters, setCharacters] = useState(null);
  const [bookTitle, setBookTitle] = useState('');

  useEffect(() => {
    api.book(slug).then((data) => setBookTitle(data.book.title)).catch(() => {});
    api.bookCharacters(slug).then((data) => setCharacters(data.characters)).catch(() => setCharacters([]));
  }, [slug]);

  return (
    <div className="book-lore-page">
      <Link className="book-lore-back" to={`/biblioteca/${slug}`}>Voltar ao livro</Link>
      <h1 className="book-lore-title">Personagens de {bookTitle}</h1>

      {characters?.length === 0 && (
        <p className="book-lore-empty">Nenhum personagem catalogado para este livro ainda.</p>
      )}

      {characters?.map((c) => (
        <div className="book-lore-entry" key={c.id}>
          {c.photo_url ? (
            <img className="book-lore-photo" src={mediaUrl(c.photo_url)} alt={c.name} />
          ) : (
            <div className="book-lore-avatar" style={{ background: c.photo_color }} />
          )}
          <div style={{ flex: 1 }}>
            <div className="book-lore-entry-name">{c.name}</div>
            {c.nicknames && (
              <div className="book-lore-entry-field">
                <div className="book-lore-entry-field-label">Apelidos</div>
                <div className="book-lore-entry-field-value">{c.nicknames}</div>
              </div>
            )}
            {c.description && (
              <div className="book-lore-entry-field">
                <div className="book-lore-entry-field-label">Descricao</div>
                <div className="book-lore-entry-field-value">{c.description}</div>
              </div>
            )}
            {c.appearance && (
              <div className="book-lore-entry-field">
                <div className="book-lore-entry-field-label">Aparencia</div>
                <div className="book-lore-entry-field-value">{c.appearance}</div>
              </div>
            )}
            {c.personality && (
              <div className="book-lore-entry-field">
                <div className="book-lore-entry-field-label">Personalidade</div>
                <div className="book-lore-entry-field-value">{c.personality}</div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
