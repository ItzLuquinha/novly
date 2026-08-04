import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import './BookLore.css';

export default function BookObjects() {
  const { slug } = useParams();
  const [objects, setObjects] = useState(null);
  const [bookTitle, setBookTitle] = useState('');

  useEffect(() => {
    api.book(slug).then((data) => setBookTitle(data.book.title)).catch(() => {});
    api.bookObjects(slug).then((data) => setObjects(data.objects)).catch(() => setObjects([]));
  }, [slug]);

  return (
    <div className="book-lore-page">
      <Link className="book-lore-back" to={`/biblioteca/${slug}`}>Voltar ao livro</Link>
      <h1 className="book-lore-title">Objetos de {bookTitle}</h1>

      {objects?.length === 0 && (
        <p className="book-lore-empty">Nenhum objeto catalogado para este livro ainda.</p>
      )}

      {objects?.map((o) => (
        <div className="book-lore-entry" key={o.id}>
          <div className="book-lore-avatar place" style={{ background: o.photo_color }} />
          <div style={{ flex: 1 }}>
            <div className="book-lore-entry-name">{o.name}</div>
            {o.category && (
              <div className="book-lore-entry-field">
                <div className="book-lore-entry-field-label">Categoria</div>
                <div className="book-lore-entry-field-value">{o.category}</div>
              </div>
            )}
            {o.description && (
              <div className="book-lore-entry-field">
                <div className="book-lore-entry-field-label">Descricao</div>
                <div className="book-lore-entry-field-value">{o.description}</div>
              </div>
            )}
            {o.significance && (
              <div className="book-lore-entry-field">
                <div className="book-lore-entry-field-label">Significado na historia</div>
                <div className="book-lore-entry-field-value">{o.significance}</div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
