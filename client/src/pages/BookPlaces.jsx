import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import './BookLore.css';

export default function BookPlaces() {
  const { slug } = useParams();
  const [places, setPlaces] = useState(null);
  const [bookTitle, setBookTitle] = useState('');

  useEffect(() => {
    api.book(slug).then((data) => setBookTitle(data.book.title)).catch(() => {});
    api.bookPlaces(slug).then((data) => setPlaces(data.places)).catch(() => setPlaces([]));
  }, [slug]);

  return (
    <div className="book-lore-page">
      <Link className="book-lore-back" to={`/biblioteca/${slug}`}>Voltar ao livro</Link>
      <h1 className="book-lore-title">Lugares de {bookTitle}</h1>

      {places?.length === 0 && (
        <p className="book-lore-empty">Nenhum lugar catalogado para este livro ainda.</p>
      )}

      {places?.map((p) => (
        <div className="book-lore-entry" key={p.id}>
          <div className="book-lore-avatar place" style={{ background: p.photo_color }} />
          <div style={{ flex: 1 }}>
            <div className="book-lore-entry-name">{p.name}</div>
            {p.description && (
              <div className="book-lore-entry-field">
                <div className="book-lore-entry-field-label">Descricao</div>
                <div className="book-lore-entry-field-value">{p.description}</div>
              </div>
            )}
            {p.history && (
              <div className="book-lore-entry-field">
                <div className="book-lore-entry-field-label">Historia do local</div>
                <div className="book-lore-entry-field-value">{p.history}</div>
              </div>
            )}
            {p.events.length > 0 && (
              <div className="book-lore-events">
                <div className="book-lore-entry-field-label">Eventos</div>
                {p.events.map((ev) => (
                  <div className="book-lore-event" key={ev.id}>
                    <div className="book-lore-event-title">{ev.title}</div>
                    {ev.description && (
                      <div className="book-lore-event-description">{ev.description}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
