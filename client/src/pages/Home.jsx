import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { api } from '../lib/api';
import './Home.css';

export default function Home() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.homeSummary().then(setSummary).catch(() => {});
  }, []);

  const greeting = user?.role === 'escritor' ? 'Bem vindo de volta' : 'Bem vinda de volta';
  const hasContent = summary && (
    summary.continue_reading || summary.last_updated_book || summary.last_comment ||
    summary.recent_chapter || summary.next_scheduled
  );

  return (
    <div className="home-page">
      <h1 className="home-greeting">{greeting}, {user?.username}.</h1>
      <p className="home-sub">
        {user?.role === 'escritor'
          ? 'Pronto para escrever algo memoravel hoje?'
          : 'Pronto para continuar a historia?'}
      </p>

      <div className="home-grid" data-tour="home-grid">
        {summary?.continue_reading && (
          <div
            className="home-card clickable"
            onClick={() => navigate(`/biblioteca/${summary.continue_reading.book_slug}/${summary.continue_reading.chapter_id}`)}
          >
            <div className="home-card-label">Continuar lendo</div>
            <div className="home-card-title">{summary.continue_reading.book_title}</div>
            <div className="home-card-body">{summary.continue_reading.chapter_title}</div>
          </div>
        )}

        {summary?.recent_chapter && (
          <div
            className="home-card clickable"
            onClick={() => navigate(`/biblioteca/${summary.recent_chapter.book_slug}/${summary.recent_chapter.id}`)}
          >
            <div className="home-card-label">Capitulo recente</div>
            <div className="home-card-title">{summary.recent_chapter.title}</div>
            <div className="home-card-body">{summary.recent_chapter.book_title}</div>
          </div>
        )}

        {summary?.last_updated_book && (
          <div
            className="home-card clickable"
            onClick={() => navigate(`/biblioteca/${summary.last_updated_book.slug}`)}
          >
            <div className="home-card-label">Ultimo livro atualizado</div>
            <div className="home-card-title">{summary.last_updated_book.title}</div>
          </div>
        )}

        {summary?.last_comment && (
          <div
            className="home-card clickable"
            onClick={() => navigate(`/biblioteca/${summary.last_comment.book_slug}/${summary.last_comment.chapter_id}`)}
          >
            <div className="home-card-label">Ultimo comentario</div>
            <div className="home-card-body">"{summary.last_comment.content}"</div>
          </div>
        )}

        {summary?.next_scheduled && (
          <div className="home-card">
            <div className="home-card-label">Proximo lancamento</div>
            <div className="home-card-title">{summary.next_scheduled.title}</div>
            <div className="home-card-body">{summary.next_scheduled.book_title}</div>
          </div>
        )}

        {summary?.favorite_highlight && (
          <div className="home-card">
            <div className="home-card-label">Trecho destacado</div>
            <p className="home-card-quote">{summary.favorite_highlight.text}</p>
          </div>
        )}

        {summary && !hasContent && (
          <div className="home-empty-state">
            Nada por aqui ainda.
          </div>
        )}
      </div>
    </div>
  );
}
