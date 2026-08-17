import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { api, mediaUrl } from '../lib/api';
import './Book.css';

export default function Book() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [book, setBook] = useState(null);
  const [error, setError] = useState('');
  const [coverOpen, setCoverOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.book(slug).then((data) => setBook(data.book)).catch((e) => setError(e.message));
  }, [slug]);

  function openChapter(chapter) {
    if (chapter.status !== 'publicado' && user?.role !== 'escritor') return;
    navigate(`/biblioteca/${slug}/${chapter.id}`);
  }

  if (error) {
    return (
      <div className="book-page">
        <p className="book-synopsis">{error}</p>
      </div>
    );
  }

  if (!book) return null;

  return (
    <div className="book-page">
      <div className="book-hero">
        <button
          type="button"
          className="book-cover"
          title="Ampliar capa"
          aria-label="Ampliar capa do livro"
          onClick={() => setCoverOpen(true)}
          style={book.cover_url
            ? { backgroundImage: `url(${mediaUrl(book.cover_url)})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: `linear-gradient(160deg, ${book.spine_color}, ${book.cover_color})` }}
        />
        <div className="book-info">
          <div className="book-category">{book.category}</div>
          <h1 className="book-title">{book.title}</h1>
          <p className="book-synopsis">{book.synopsis}</p>

          <div className="book-stats-row">
            <div className="book-stat">
              <span className="book-stat-value">{book.published_chapter_count}</span>
              <span className="book-stat-label">Capitulos</span>
            </div>
            <div className="book-stat">
              <span className="book-stat-value">{book.total_word_count.toLocaleString('pt-BR')}</span>
              <span className="book-stat-label">Palavras</span>
            </div>
            <div className="book-stat">
              <span className="book-stat-value">{book.estimated_minutes} min</span>
              <span className="book-stat-label">Leitura</span>
            </div>
            <div className="book-stat">
              <span className="book-stat-value">{book.percent_complete}%</span>
              <span className="book-stat-label">Concluido</span>
            </div>
          </div>

          {user?.role === 'escritor' && book.writer_notes && (
            <div className="book-notes">
              <div className="book-notes-label">Notas do escritor</div>
              <p className="book-notes-text">{book.writer_notes}</p>
            </div>
          )}

          {book.reader_guide && (
            <div className="book-notes book-guide">
              <div className="book-notes-label">Guia do livro</div>
              <p className="book-notes-text" style={{ whiteSpace: 'pre-wrap' }}>{book.reader_guide}</p>
            </div>
          )}

          <div className="book-lore-links">
            <Link to={`/biblioteca/${slug}/personagens`}>Personagens</Link>
            <Link to={`/biblioteca/${slug}/lugares`}>Lugares</Link>
            <Link to={`/biblioteca/${slug}/objetos`}>Objetos</Link>
            <Link to={`/biblioteca/${slug}/linha-do-tempo`}>Linha do tempo</Link>
          </div>
        </div>
      </div>

      <h2 className="chapters-heading">Capitulos</h2>
      <div className="chapter-list">
        {book.chapters.map((chapter, i) => {
          const locked = chapter.status !== 'publicado' && user?.role !== 'escritor';
          return (
            <div
              key={chapter.id}
              className={`chapter-row${locked ? ' locked' : ''}`}
              onClick={() => openChapter(chapter)}
            >
              <span className="chapter-number">{String(i + 1).padStart(2, '0')}</span>
              <span className="chapter-row-title">{chapter.title}</span>
              {chapter.status !== 'publicado' && (
                <span className="chapter-status-badge">
                  {chapter.status === 'rascunho' ? 'Rascunho' : 'Agendado'}
                </span>
              )}
              <span className="chapter-row-meta">{chapter.word_count} palavras</span>
            </div>
          );
        })}
      </div>

      {coverOpen && (
        <div
          className="cover-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Capa ampliada"
          onClick={() => setCoverOpen(false)}
        >
          <button
            type="button"
            className="cover-lightbox-close"
            aria-label="Fechar"
            onClick={() => setCoverOpen(false)}
          >
            ×
          </button>
          <div
            className="cover-lightbox-card"
            onClick={(e) => e.stopPropagation()}
            style={book.cover_url
              ? { backgroundImage: `url(${mediaUrl(book.cover_url)})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { background: `linear-gradient(160deg, ${book.spine_color}, ${book.cover_color})` }}
          >
            {book.cover_url ? (
              <img
                className="cover-lightbox-img"
                src={mediaUrl(book.cover_url)}
                alt={`Capa de ${book.title}`}
              />
            ) : (
              <div className="cover-lightbox-fallback">
                <span>{book.title}</span>
              </div>
            )}
          </div>
          <p className="cover-lightbox-hint">Clique fora para fechar</p>
        </div>
      )}
    </div>
  );
}
