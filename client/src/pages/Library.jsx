import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import './Library.css';

export default function Library() {
  const [books, setBooks] = useState(null);
  const [error, setError] = useState('');
  const [justCompleted, setJustCompleted] = useState(null);
  const navigate = useNavigate();
  const seenCompletedRef = useRef(null);

  useEffect(() => {
    api.library().then((data) => {
      setBooks(data.books);

      if (seenCompletedRef.current === null) {
        seenCompletedRef.current = new Set(
          data.books.filter((b) => b.is_completed).map((b) => b.id)
        );
        return;
      }

      const newlyCompleted = data.books.find(
        (b) => b.is_completed && !seenCompletedRef.current.has(b.id)
      );
      if (newlyCompleted) {
        setJustCompleted(newlyCompleted);
        seenCompletedRef.current.add(newlyCompleted.id);
        setTimeout(() => setJustCompleted(null), 3400);
      }
    }).catch((e) => setError(e.message));
  }, []);

  function openBook(slug) {
    navigate(`/biblioteca/${slug}`);
  }

  const inProgress = books?.filter((b) => !b.is_completed) || [];
  const completed = books?.filter((b) => b.is_completed) || [];

  function renderBook(book) {
    const readChapters = book.chapters.filter((c) => c.status === 'publicado' && c.is_read).length;

    return (
      <div className="book-spine-wrap" key={book.id}>
        <div
          className="book-spine"
          style={book.cover_url
            ? { backgroundImage: `url(${book.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: `linear-gradient(135deg, ${book.spine_color}, ${book.cover_color})` }}
          onClick={() => openBook(book.slug)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && openBook(book.slug)}
        >
          {readChapters > 0 && <div className="book-spine-ribbon" />}
          <div>
            <div className="book-spine-title">{book.title}</div>
            <div className="book-spine-meta">{book.category}</div>
          </div>
          <div>
            <div className="book-spine-meta" style={{ marginBottom: 4 }}>
              {book.published_chapter_count} capitulos - {book.estimated_minutes} min
            </div>
            <div className="book-progress-track">
              <div className="book-progress-fill" style={{ width: `${book.percent_complete}%` }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="library-page">
      <div className="library-header">
        <h1 className="library-title">Biblioteca</h1>
      </div>

      {error && <p className="library-empty">{error}</p>}

      {books && books.length === 0 && (
        <p className="library-empty">Nenhum livro publicado ainda. A primeira historia esta a caminho.</p>
      )}

      {inProgress.length > 0 && (
        <div className="shelf" data-tour="library-shelf">
          {inProgress.map(renderBook)}
        </div>
      )}

      {completed.length > 0 && (
        <>
          <h2 className="library-section-heading">Historias concluidas</h2>
          <div className="shelf completed-shelf">
            {completed.map(renderBook)}
          </div>
        </>
      )}

      {justCompleted && (
        <div className="completion-toast">
          <div className="completion-toast-book" style={{ background: `linear-gradient(135deg, ${justCompleted.spine_color}, ${justCompleted.cover_color})` }} />
          <div>
            <div className="completion-toast-title">Historia concluida</div>
            <div className="completion-toast-book-name">{justCompleted.title} acabou de ir para a estante de historias concluidas.</div>
          </div>
        </div>
      )}
    </div>
  );
}
