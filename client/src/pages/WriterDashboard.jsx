import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import WritingHeatmap from '../components/WritingHeatmap.jsx';
import WritingCalendar from '../components/WritingCalendar.jsx';
import WriterFeather from '../components/WriterFeather.jsx';
import './WriterDashboard.css';

export default function WriterDashboard() {
  const [stats, setStats] = useState(null);
  const [books, setBooks] = useState(null);
  const [showNewBook, setShowNewBook] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSynopsis, setNewSynopsis] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const navigate = useNavigate();

  function load() {
    api.writerDashboard().then(setStats).catch(() => {});
    api.writerBooks().then((data) => setBooks(data.books)).catch(() => {});
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreateBook(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await api.createBook({
        title: newTitle.trim(),
        synopsis: newSynopsis.trim(),
        category: newCategory.trim(),
      });
      setShowNewBook(false);
      setNewTitle('');
      setNewSynopsis('');
      setNewCategory('');
      navigate(`/escritor/livros/${res.book.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteBook(book, e) {
    e.stopPropagation();
    const confirmed = window.confirm(
      `Excluir "${book.title}" para sempre? Isso apaga todos os capitulos, comentarios, destaques e historico de versoes deste livro. Nao pode ser desfeito.`
    );
    if (!confirmed) return;
    await api.deleteBook(book.id);
    load();
  }


  async function handleImportBook(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await api.importBook(data);
      navigate(`/escritor/livros/${res.book.id}`);
    } catch (err) {
      window.alert(err.message || 'Falha ao importar o livro.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  const dailyPercent = stats ? Math.min(100, Math.round((stats.words_today / stats.daily_goal) * 100)) : 0;

  return (
    <div className="writer-dashboard">
      <div className="writer-header">
        <h1 className="writer-title">Painel do escritor</h1>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <label className="writer-new-book-btn" style={{ cursor: 'pointer', margin: 0 }}>
            {importing ? 'Importando...' : 'Importar livro'}
            <input type="file" accept=".json,application/json" onChange={handleImportBook} disabled={importing} style={{ display: 'none' }} />
          </label>
          <button className="writer-new-book-btn" onClick={() => setShowNewBook(true)} data-tour="dashboard-novo-livro">
            Novo livro
          </button>
        </div>
      </div>

      {stats && (
        <div className="dashboard-grid" data-tour="dashboard-stats">
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-value">{stats.book_count}</div>
            <div className="dashboard-stat-label">Livros</div>
          </div>
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-value">{stats.chapters_published}</div>
            <div className="dashboard-stat-label">Capitulos publicados</div>
          </div>
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-value">{stats.chapters_draft}</div>
            <div className="dashboard-stat-label">Em rascunho</div>
          </div>
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-value">{stats.streak_days}</div>
            <div className="dashboard-stat-label">Dias seguidos escrevendo</div>
          </div>
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-value">{stats.words_today}</div>
            <div className="dashboard-stat-label">Palavras hoje</div>
            <div className="dashboard-goal-bar-track">
              <div className="dashboard-goal-bar-fill" style={{ width: `${dailyPercent}%` }} />
            </div>
            <div className="dashboard-goal-label">meta: {stats.daily_goal}</div>
          </div>
          <div className="dashboard-stat-card">
            <WriterFeather percent={dailyPercent} />
          </div>
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-value">{stats.words_this_week}</div>
            <div className="dashboard-stat-label">Palavras esta semana</div>
          </div>
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-value">{stats.words_this_month}</div>
            <div className="dashboard-stat-label">Palavras este mes</div>
          </div>
          {stats.next_scheduled && (
            <div className="dashboard-stat-card">
              <div className="dashboard-stat-value" style={{ fontSize: '1.1rem' }}>
                {stats.next_scheduled.title}
              </div>
              <div className="dashboard-stat-label">Proxima publicacao agendada</div>
            </div>
          )}
        </div>
      )}

      <div className="dashboard-productivity-row">
        <div className="dashboard-productivity-card">
          <h3 className="dashboard-productivity-heading">Producao no ano</h3>
          <WritingHeatmap />
        </div>
        <div className="dashboard-productivity-card">
          <h3 className="dashboard-productivity-heading">Calendario de escrita</h3>
          <WritingCalendar />
        </div>
      </div>

      <h2 className="writer-shelf-heading">Seus livros</h2>
      <div className="writer-book-list">
        {books?.map((book) => (
          <div
            key={book.id}
            className="writer-book-row"
            onClick={() => navigate(`/escritor/livros/${book.id}`)}
          >
            <div
              className="writer-book-swatch"
              style={book.cover_url
                ? { backgroundImage: `url(${book.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : { background: `linear-gradient(160deg, ${book.spine_color}, ${book.cover_color})` }}
            />
            <div className="writer-book-row-title">{book.title}</div>
            {!book.published_at && (
              <span className="writer-book-status-badge">Nao publicado</span>
            )}
            <div className="writer-book-row-meta">
              {book.chapter_counts.published || 0} publicados - {book.chapter_counts.draft || 0} rascunhos
            </div>
            <button
              className="writer-book-row-delete"
              onClick={(e) => handleDeleteBook(book, e)}
            >
              Excluir
            </button>
          </div>
        ))}
      </div>

      {showNewBook && (
        <div className="writer-modal-backdrop" onClick={() => setShowNewBook(false)}>
          <div className="writer-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="writer-modal-title">Comecar um novo livro</h3>
            <form onSubmit={handleCreateBook}>
              <div className="writer-modal-field">
                <label htmlFor="new-title">Titulo</label>
                <input
                  id="new-title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="writer-modal-field">
                <label htmlFor="new-category">Categoria</label>
                <input
                  id="new-category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Romance, Drama, Fantasia..."
                />
              </div>
              <div className="writer-modal-field">
                <label htmlFor="new-synopsis">Sinopse</label>
                <textarea
                  id="new-synopsis"
                  value={newSynopsis}
                  onChange={(e) => setNewSynopsis(e.target.value)}
                />
              </div>
              <div className="writer-modal-actions">
                <button type="button" className="cancel" onClick={() => setShowNewBook(false)}>
                  Cancelar
                </button>
                <button type="submit" className="confirm" disabled={creating}>
                  {creating ? 'Criando...' : 'Criar livro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
